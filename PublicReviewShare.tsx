import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Compass, Star, Clock, Loader2 } from 'lucide-react'
import { supabase } from '@infra/supabase'
import { supabaseStorage } from '@infra/storage/SupabaseStorage'
import { formatDate, cx } from '@lib/format'
import type { PublicReview, Media } from '@domain/types'

interface MediaWithUrls extends Media { previewUrl?: string; thumbnailUrl?: string }

/**
 * Anonymous-readable public review page.
 *
 * Relies on the RLS policy "review_shares: public read by slug" + a public
 * read on the underlying `public_reviews` row via the share's foreign key.
 * For Phase 6 we keep this simple: the anon read works via a `rpc` or two
 * direct queries scoped to a known share_slug.
 */
export default function PublicReviewShare() {
  const { slug } = useParams<{ slug: string }>()
  const [review, setReview] = useState<PublicReview | null>(null)
  const [hero, setHero] = useState<MediaWithUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    void (async () => {
      setLoading(true)
      try {
        // 1. Look up the share by slug
        const shareRes = await supabase.from('review_shares')
          .select('public_review_id, is_active')
          .eq('share_slug', slug).maybeSingle()
        if (!shareRes.data || !shareRes.data.is_active) {
          setError('This review is no longer available.')
          return
        }
        // 2. Bump view count (RPC)
        void supabase.rpc('bump_review_share_view', { p_slug: slug }).then()

        // 3. Fetch the review
        const reviewRes = await supabase.from('public_reviews')
          .select('*').eq('id', shareRes.data.public_review_id).maybeSingle()
        if (!reviewRes.data) {
          setError('Review not found.')
          return
        }
        const r = dbToReview(reviewRes.data)
        setReview(r)

        // 4. Fetch hero media if present
        if (r.heroMediaId) {
          const mediaRes = await supabase.from('media')
            .select('*').eq('id', r.heroMediaId).maybeSingle()
          if (mediaRes.data) {
            const m = dbToMedia(mediaRes.data)
            if (m.previewPath) {
              try { (m as any).previewUrl = await supabaseStorage.getSignedUrl(m.previewPath, { expiresIn: 3600 }) } catch {}
            }
            setHero(m as MediaWithUrls)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  if (loading) return <Center><Loader2 size={16} className="animate-spin" /> Loading…</Center>
  if (error)   return <Center><span className="text-danger">{error}</span></Center>
  if (!review) return null

  return (
    <article className="min-h-full bg-paper">
      {hero?.previewUrl && (
        <div className="relative h-72 md:h-96 bg-paperDeep overflow-hidden">
          <img src={hero.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-10">
        {review.visitPurpose && (
          <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold mb-2">
            {review.visitPurpose}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tightish mb-3 font-serif">{review.title}</h1>
        {review.summary && <p className="text-lg text-inkSoft mb-6">{review.summary}</p>}

        {(review.ratingOverall || review.priceLevel) && (
          <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-paperEdge">
            {review.ratingOverall && (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={16} className={cx(
                    n <= (review.ratingOverall ?? 0) ? 'text-accent fill-current' : 'text-paperEdge',
                  )} />
                ))}
                <span className="text-sm text-inkSoft ml-1">{review.ratingOverall}/5</span>
              </div>
            )}
            {review.priceLevel && (
              <div className="text-sm font-semibold">{'$'.repeat(review.priceLevel)}</div>
            )}
            {review.bestTimeToVisit && (
              <div className="inline-flex items-center gap-1 text-xs text-inkSoft">
                <Clock size={12} /> {review.bestTimeToVisit}
              </div>
            )}
          </div>
        )}

        <div className="prose prose-sm max-w-none">
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{review.bodyMarkdown}</div>
        </div>

        {(review.ratingFood || review.ratingValue || review.ratingAtmosphere) && (
          <div className="mt-8 grid grid-cols-3 gap-3">
            {review.ratingFood       && <Rating label="Food"       value={review.ratingFood} />}
            {review.ratingValue      && <Rating label="Value"      value={review.ratingValue} />}
            {review.ratingAtmosphere && <Rating label="Atmosphere" value={review.ratingAtmosphere} />}
          </div>
        )}

        {review.recommendedFor && review.recommendedFor.length > 0 && (
          <div className="mt-8">
            <div className="text-xs uppercase tracking-wider2 text-inkFaint font-semibold mb-2">Recommended for</div>
            <div className="flex flex-wrap gap-1.5">
              {review.recommendedFor.map((r) => (
                <span key={r} className="px-2.5 py-1 bg-accentSoft/40 text-accentDeep text-xs rounded-full">{r}</span>
              ))}
            </div>
          </div>
        )}

        {review.accessibilityNotes && (
          <div className="mt-6 bg-panel border border-paperEdge rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider2 text-inkFaint font-semibold mb-1">Accessibility</div>
            <div className="text-sm leading-relaxed">{review.accessibilityNotes}</div>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-paperEdge text-xs text-inkSoft flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass size={11} /> Published with Atlas
          </div>
          <div>{review.publishedAt ? formatDate(review.publishedAt) : formatDate(review.createdAt)}</div>
        </footer>
      </div>
    </article>
  )
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-panel border border-paperEdge rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold mb-1">{label}</div>
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map((n) => (
          <Star key={n} size={12} className={cx(n <= value ? 'text-accent fill-current' : 'text-paperEdge')} />
        ))}
      </div>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full flex items-center justify-center gap-2 py-12 text-sm text-inkSoft">{children}</div>
}

function dbToReview(r: any): PublicReview {
  return {
    id: r.id, userId: r.user_id, placeId: r.place_id, visitId: r.visit_id,
    title: r.title, bodyMarkdown: r.body_markdown, summary: r.summary,
    ratingOverall: r.rating_overall, ratingFood: r.rating_food,
    ratingValue: r.rating_value, ratingAtmosphere: r.rating_atmosphere,
    priceLevel: r.price_level, visitPurpose: r.visit_purpose,
    tags: r.tags, recommendedFor: r.recommended_for,
    bestTimeToVisit: r.best_time_to_visit, accessibilityNotes: r.accessibility_notes,
    openingHours: r.opening_hours, contact: r.contact,
    heroMediaId: r.hero_media_id, galleryMediaIds: r.gallery_media_ids,
    googlePlaceId: r.google_place_id, osmPlaceId: r.osm_place_id,
    status: r.status, language: r.language ?? 'en',
    createdAt: r.created_at, updatedAt: r.updated_at,
    publishedAt: r.published_at, deletedAt: r.deleted_at,
  }
}

function dbToMedia(r: any): Media {
  return {
    id: r.id, userId: r.user_id, kind: r.kind,
    storageProvider: r.storage_provider, originalPath: r.original_path,
    previewPath: r.preview_path, thumbnailPath: r.thumbnail_path,
    width: r.width, height: r.height, mimeType: r.mime_type,
    caption: r.caption, exif: r.exif ?? {}, isCover: false,
    createdAt: r.created_at,
  } as Media
}
