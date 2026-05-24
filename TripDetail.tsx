import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Image as ImageIcon, Loader2, BookOpen } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { TripsService } from '@services/TripsService'
import { VisitsService } from '@services/VisitsService'
import { MediaService } from '@services/MediaService'
import { MemoryBookService } from '@services/MemoryBookService'
import { EmptyState } from '@components/shared/EmptyState'
import { Button } from '@components/shared/Button'
import { formatDateRange } from '@lib/format'
import type { Trip, Visit, Place, Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string }

interface VisitRow {
  visit: Visit
  place: Place
  cover?: MediaWithUrls
}

export default function TripDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [rows, setRows] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !user) return
    void (async () => {
      setLoading(true)
      try {
        const t = await TripsService.get(id)
        setTrip(t)
        if (!t) return
        const vs = await VisitsService.listForTrip(id)
        const rowsWithCover: VisitRow[] = vs.map((v) => ({ visit: v, place: v.place!, cover: undefined }))
        await Promise.all(rowsWithCover.map(async (r) => {
          if (r.place?.coverMediaId) {
            try { r.cover = await MediaService.get(r.place.coverMediaId) ?? undefined } catch {}
          }
        }))
        setRows(rowsWithCover)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, user?.id])

  if (loading) return <Center><Loader2 size={16} className="animate-spin" /> Loading trip…</Center>
  if (!trip) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider2 text-inkFaint mb-1">Not found</div>
          <Link to="/" className="text-sm text-accent">← Back to atlas</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold">Trip</div>
          <h1 className="text-base font-semibold tracking-tightish">{trip.name}</h1>
          <div className="text-xs text-inkSoft">{formatDateRange(trip.startDate, trip.endDate)} · {rows.length} place{rows.length === 1 ? '' : 's'}</div>
        </div>
        {user && rows.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            icon={<BookOpen size={13} />}
            onClick={() => MemoryBookService.openForTrip(trip.id, user.id).catch((e) => alert(e.message))}
          >
            Print as book
          </Button>
        )}
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {trip.description && (
          <div className="mb-6 text-sm text-ink leading-relaxed">{trip.description}</div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<MapPin size={18} />}
            title="No places in this trip yet"
            subtitle="Add visits to this trip to see them here in order."
          />
        ) : (
          <ol className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.visit.id} className="relative">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-ink text-paper text-xs font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    {i < rows.length - 1 && <div className="w-px flex-1 bg-paperEdge my-1" />}
                  </div>
                  <Link
                    to={`/places/${r.place.id}`}
                    className="flex-1 bg-panel border border-paperEdge rounded-xl p-4 hover:border-inkFaint transition-colors group flex gap-4"
                  >
                    <div className="w-20 h-20 rounded-lg bg-paperDeep overflow-hidden shrink-0">
                      {r.cover?.thumbnailUrl ? (
                        <img src={r.cover.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-inkFaint">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold">
                        {r.place.country?.name ?? ''}
                      </div>
                      <div className="text-base font-semibold tracking-tightish group-hover:text-accent transition-colors truncate">
                        {r.place.city?.name ?? r.place.customName}
                      </div>
                      <div className="text-xs text-inkSoft mt-1 flex items-center gap-1">
                        <Calendar size={11} /> {formatDateRange(r.visit.arrivalDate, r.visit.departureDate)}
                      </div>
                      {r.visit.summaryNotes && (
                        <div className="text-xs text-ink mt-2 line-clamp-2">{r.visit.summaryNotes}</div>
                      )}
                    </div>
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full flex items-center justify-center gap-2 text-sm text-inkSoft">{children}</div>
}
