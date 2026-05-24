import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Globe, Send, Loader2, Star } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { PublicReviewsService } from '@services/PublicReviewsService'
import { PlacesService } from '@services/PlacesService'
import { useAutoSave } from '@hooks/useAutoSave'
import { SaveStatus } from '@components/shared/SaveStatus'
import { Button } from '@components/shared/Button'
import { PublishModal } from '@components/publish/PublishModal'
import { cx } from '@lib/format'
import type { PublicReview, Place } from '@domain/types'

const VISIT_PURPOSES = ['food','lodging','attraction','shopping','transit','experience','nature','other'] as const
const RECOMMENDED_FOR_OPTIONS = ['solo travelers','families with kids','couples','groups','foodies','budget','luxury','wheelchair access']

export default function PublicReviewEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id || id === 'new'

  const [review, setReview] = useState<PublicReview | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [loading, setLoading] = useState(!isNew)

  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [summary, setSummary] = useState('')
  const [ratingOverall, setRatingOverall] = useState(0)
  const [ratingFood, setRatingFood] = useState(0)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingAtmosphere, setRatingAtmosphere] = useState(0)
  const [priceLevel, setPriceLevel] = useState<number | null>(null)
  const [visitPurpose, setVisitPurpose] = useState<string>('')
  const [recommendedFor, setRecommendedFor] = useState<string[]>([])
  const [bestTimeToVisit, setBestTimeToVisit] = useState('')
  const [accessibilityNotes, setAccessibilityNotes] = useState('')
  const [googlePlaceId, setGooglePlaceId] = useState('')

  useEffect(() => {
    if (isNew) {
      // Pull placeId from query param for new reviews
      const params = new URLSearchParams(window.location.search)
      const placeId = params.get('place_id')
      if (placeId) {
        void PlacesService.get(placeId).then(setPlace)
      }
      return
    }
    void (async () => {
      setLoading(true)
      const r = await PublicReviewsService.get(id!)
      if (r) {
        setReview(r)
        setTitle(r.title); setBody(r.bodyMarkdown); setSummary(r.summary ?? '')
        setRatingOverall(r.ratingOverall ?? 0); setRatingFood(r.ratingFood ?? 0)
        setRatingValue(r.ratingValue ?? 0); setRatingAtmosphere(r.ratingAtmosphere ?? 0)
        setPriceLevel(r.priceLevel ?? null)
        setVisitPurpose(r.visitPurpose ?? '')
        setRecommendedFor(r.recommendedFor ?? [])
        setBestTimeToVisit(r.bestTimeToVisit ?? '')
        setAccessibilityNotes(r.accessibilityNotes ?? '')
        setGooglePlaceId(r.googlePlaceId ?? '')
        if (r.placeId) await PlacesService.get(r.placeId).then(setPlace)
      }
      setLoading(false)
    })()
  }, [id, isNew])

  // Auto-save (only if we have a review row)
  const { status, lastSavedAt } = useAutoSave({
    value: {
      title, body, summary, ratingOverall, ratingFood, ratingValue, ratingAtmosphere,
      priceLevel, visitPurpose, recommendedFor, bestTimeToVisit, accessibilityNotes, googlePlaceId,
    },
    initialValue: review ? {
      title: review.title, body: review.bodyMarkdown, summary: review.summary ?? '',
      ratingOverall: review.ratingOverall ?? 0, ratingFood: review.ratingFood ?? 0,
      ratingValue: review.ratingValue ?? 0, ratingAtmosphere: review.ratingAtmosphere ?? 0,
      priceLevel: review.priceLevel ?? null,
      visitPurpose: review.visitPurpose ?? '',
      recommendedFor: review.recommendedFor ?? [],
      bestTimeToVisit: review.bestTimeToVisit ?? '',
      accessibilityNotes: review.accessibilityNotes ?? '',
      googlePlaceId: review.googlePlaceId ?? '',
    } : undefined,
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    onSave: async (v) => {
      if (!review) return
      await PublicReviewsService.update(review.id, {
        title: v.title, bodyMarkdown: v.body, summary: v.summary,
        ratingOverall: v.ratingOverall || undefined,
        ratingFood: v.ratingFood || undefined,
        ratingValue: v.ratingValue || undefined,
        ratingAtmosphere: v.ratingAtmosphere || undefined,
        priceLevel: v.priceLevel ?? undefined,
        visitPurpose: (v.visitPurpose || undefined) as any,
        recommendedFor: v.recommendedFor,
        bestTimeToVisit: v.bestTimeToVisit || undefined,
        accessibilityNotes: v.accessibilityNotes || undefined,
        googlePlaceId: v.googlePlaceId || undefined,
      })
    },
  })

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    const r = await PublicReviewsService.create({
      userId: user.id,
      placeId: place?.id,
      title: title.trim(),
      bodyMarkdown: body,
    })
    navigate(`/public-reviews/${r.id}`, { replace: true })
  }

  const [publishOpen, setPublishOpen] = useState(false)

  const handleOpenPublish = () => {
    setPublishOpen(true)
  }

  if (loading) {
    return <div className="min-h-full flex items-center justify-center gap-2 text-sm text-inkSoft">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  }

  return (
    <div className="min-h-full bg-paper pb-16">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3 sticky top-0 z-10">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-accent" />
            <h1 className="text-base font-semibold tracking-tightish">
              {isNew ? 'New public review' : 'Edit public review'}
            </h1>
          </div>
          <div className="text-xs text-inkSoft">
            {place ? `For ${place.city?.name ?? place.customName}` : 'A review you can publish to the world'}
          </div>
        </div>
        {review && <SaveStatus status={status} lastSavedAt={lastSavedAt} />}
        {review && (
          <Button size="sm" icon={<Send size={13} />} onClick={handleOpenPublish}>
            Publish
          </Button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {isNew ? (
          <div className="bg-accentSoft/40 border border-accentSoft rounded-xl p-4 text-sm">
            Start by giving your review a title. You can fill in ratings, hours, and other details after creating it.
          </div>
        ) : null}

        {/* Title */}
        <Section title="Title" subtitle="A clear, descriptive title — what is this place and what's it for">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={'e.g. "Best chai in Old Srinagar — Café Liberty"'}
            className="w-full bg-panel border border-paperEdge rounded-lg px-4 py-2.5 text-base font-semibold outline-none focus:border-ink"
          />
        </Section>

        {isNew ? (
          <Button onClick={handleCreate} disabled={!title.trim()}>Create review</Button>
        ) : (
          <>
            <Section title="Summary" subtitle="One sentence for cards and search results">
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A single-sentence pitch — what makes this place worth visiting?"
                maxLength={200}
                className="w-full bg-panel border border-paperEdge rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
              />
            </Section>

            <Section title="Ratings" subtitle="Out of 5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <RatingPicker label="Overall"     value={ratingOverall}    onChange={setRatingOverall} />
                <RatingPicker label="Food"        value={ratingFood}       onChange={setRatingFood} />
                <RatingPicker label="Value"       value={ratingValue}      onChange={setRatingValue} />
                <RatingPicker label="Atmosphere" value={ratingAtmosphere} onChange={setRatingAtmosphere} />
              </div>
            </Section>

            <Section title="Price level">
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPriceLevel(priceLevel === n ? null : n)}
                    className={cx(
                      'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                      priceLevel === n ? 'bg-ink text-paper border-ink' : 'bg-panel text-inkSoft border-paperEdge hover:border-inkFaint',
                    )}
                  >
                    {'$'.repeat(n)}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="What's this place for?" subtitle="Helps people find your review">
              <div className="flex flex-wrap gap-2">
                {VISIT_PURPOSES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setVisitPurpose(visitPurpose === p ? '' : p)}
                    className={cx(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize',
                      visitPurpose === p ? 'bg-ink text-paper border-ink' : 'bg-panel text-inkSoft border-paperEdge hover:border-inkFaint',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Recommended for">
              <div className="flex flex-wrap gap-2">
                {RECOMMENDED_FOR_OPTIONS.map((opt) => {
                  const active = recommendedFor.includes(opt)
                  return (
                    <button
                      key={opt}
                      onClick={() => setRecommendedFor(active ? recommendedFor.filter((x) => x !== opt) : [...recommendedFor, opt])}
                      className={cx(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        active ? 'bg-accent text-paper border-accent' : 'bg-panel text-inkSoft border-paperEdge hover:border-inkFaint',
                      )}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title="Best time to visit">
              <input
                value={bestTimeToVisit}
                onChange={(e) => setBestTimeToVisit(e.target.value)}
                placeholder="e.g. ‘Early morning before 9am’ or ‘Sunset’"
                className="w-full bg-panel border border-paperEdge rounded-lg px-3 py-2 text-sm outline-none focus:border-ink"
              />
            </Section>

            <Section title="The review" subtitle="The body — what you'd tell a friend who'd never been there">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write what makes this place worth knowing about. Be specific. Be honest. Markdown supported."
                rows={10}
                className="w-full bg-panel border border-paperEdge rounded-lg px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-ink resize-y"
              />
            </Section>

            <Section title="Accessibility notes" subtitle="Optional — helps people plan">
              <textarea
                value={accessibilityNotes}
                onChange={(e) => setAccessibilityNotes(e.target.value)}
                placeholder="Wheelchair access, stairs, lighting, sound levels, etc."
                rows={3}
                className="w-full bg-panel border border-paperEdge rounded-lg px-3 py-2 text-sm outline-none focus:border-ink resize-y"
              />
            </Section>

            <Section title="Google Maps Place ID" subtitle="Optional — links this review to a Google Maps location">
              <input
                value={googlePlaceId}
                onChange={(e) => setGooglePlaceId(e.target.value)}
                placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                className="w-full bg-panel border border-paperEdge rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-ink"
              />
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:text-accentDeep mt-1 inline-block"
              >
                How to find a Google Place ID →
              </a>
            </Section>
          </>
        )}
      </div>
      {review && (
        <PublishModal
          review={review}
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            void PublicReviewsService.get(review.id).then((r) => r && setReview(r))
          }}
        />
      )}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-inkSoft">{subtitle}</div>}
      </div>
      {children}
    </section>
  )
}

function RatingPicker({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium mb-1.5">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? 0 : n)}
            className="text-accent hover:scale-110 transition-transform"
          >
            <Star size={18} className={cx(value >= n ? 'fill-current' : 'text-paperEdge')} />
          </button>
        ))}
      </div>
    </div>
  )
}
