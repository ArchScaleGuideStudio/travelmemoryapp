import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Globe, Loader2, Star } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { PublicReviewsService } from '@services/PublicReviewsService'
import { EmptyState } from '@components/shared/EmptyState'
import { Button } from '@components/shared/Button'
import { formatDate, cx } from '@lib/format'
import type { PublicReview } from '@domain/types'

export default function PublicReviewsList() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'ready' | 'published'>('all')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    PublicReviewsService.list(user.id)
      .then(setReviews)
      .finally(() => setLoading(false))
  }, [user?.id])

  const filtered = filter === 'all' ? reviews : reviews.filter((r) => r.status === filter)

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-accent" />
            <h1 className="text-base font-semibold">Public reviews</h1>
          </div>
          <div className="text-xs text-inkSoft">Content you've authored for Google Maps, your website, and beyond</div>
        </div>
        <Link
          to="/public-reviews/new"
          className="inline-flex items-center gap-1.5 bg-ink text-paper px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
        >
          <Plus size={13} /> New review
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6">
          {(['all', 'draft', 'ready', 'published'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cx(
                'px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors',
                filter === s ? 'bg-ink text-paper' : 'bg-panel text-inkSoft border border-paperEdge hover:border-inkFaint',
              )}
            >
              {s}
              {s !== 'all' && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {reviews.filter((r) => r.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <Center><Loader2 size={16} className="animate-spin" /> Loading…</Center>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Globe size={18} />}
            title="No public reviews yet"
            subtitle="Public reviews are separate from your private journal — content with ratings and details you can publish to Google Maps and other platforms."
            action={<Link to="/public-reviews/new"><Button icon={<Plus size={13} />}>Write a review</Button></Link>}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/public-reviews/${r.id}`}
                className="block bg-panel border border-paperEdge rounded-xl p-4 hover:border-inkFaint group transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-base font-semibold tracking-tightish group-hover:text-accent transition-colors">
                    {r.title || 'Untitled review'}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.summary && <div className="text-sm text-ink mb-2">{r.summary}</div>}
                <div className="flex items-center gap-3 text-xs text-inkSoft">
                  {r.ratingOverall && (
                    <span className="inline-flex items-center gap-1">
                      <Star size={11} className="fill-current text-accent" /> {r.ratingOverall}/5
                    </span>
                  )}
                  {r.priceLevel && <span>{'$'.repeat(r.priceLevel)}</span>}
                  {r.visitPurpose && <span className="capitalize">{r.visitPurpose}</span>}
                  <span>· Updated {formatDate(r.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    draft:     { label: 'Draft',     tone: 'bg-paperDeep text-inkSoft' },
    ready:     { label: 'Ready',     tone: 'bg-accentSoft text-accentDeep' },
    published: { label: 'Published', tone: 'bg-success/20 text-success' },
    archived:  { label: 'Archived',  tone: 'bg-paperDeep text-inkFaint' },
  }
  const m = map[status] ?? map.draft
  return (
    <span className={cx('text-[10px] uppercase tracking-wider2 font-semibold px-2 py-0.5 rounded', m.tone)}>
      {m.label}
    </span>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-inkSoft">{children}</div>
}
