import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { PlacesService } from '@services/PlacesService'
import { TripsService } from '@services/TripsService'
import { VisitsService } from '@services/VisitsService'
import { MediaService } from '@services/MediaService'
import { TimelineSidebar, YearGroup } from '@components/timeline/TimelineSidebar'
import { EmptyState } from '@components/shared/EmptyState'
import { formatDateRange } from '@lib/format'
import type { Place, Trip, Visit, Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string }

interface VisitWithRels {
  visit: Visit
  place: Place
  trip: Trip
  cover?: MediaWithUrls
}

export default function Timeline() {
  const { user } = useAuth()
  const [rows, setRows] = useState<VisitWithRels[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      try {
        const [places, trips] = await Promise.all([
          PlacesService.listWithHydrated(user.id),
          TripsService.list(user.id),
        ])
        const placeById = new Map(places.map((p) => [p.id, p]))
        const tripById = new Map(trips.map((t) => [t.id, t]))

        // Get all visits across all trips
        const visitsArrays = await Promise.all(
          trips.map((t) => VisitsService.listForTrip(t.id)),
        )
        const flat: Visit[] = visitsArrays.flat()

        // Hydrate
        const withRels: VisitWithRels[] = flat
          .map((v) => {
            const place = placeById.get(v.placeId)
            const trip = tripById.get(v.tripId)
            if (!place || !trip) return null
            return { visit: v, place, trip, cover: undefined } as VisitWithRels
          })
          .filter((x): x is VisitWithRels => x !== null)
          .sort((a, b) => b.visit.arrivalDate.localeCompare(a.visit.arrivalDate))

        // Fetch covers for first 24
        await Promise.all(
          withRels.slice(0, 24).map(async (r) => {
            const id = r.place.coverMediaId
            if (!id) return
            try { r.cover = await MediaService.get(id) ?? undefined } catch {}
          }),
        )

        setRows(withRels)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  // Build year groups for sidebar
  const yearGroups: YearGroup[] = useMemo(() => {
    const map = new Map<number, { year: number; visits: VisitWithRels[]; tripIds: Set<string> }>()
    for (const r of rows) {
      const yr = parseInt(r.visit.arrivalDate.split('-')[0] ?? '0', 10)
      if (!map.has(yr)) map.set(yr, { year: yr, visits: [], tripIds: new Set() })
      const bucket = map.get(yr)!
      bucket.visits.push(r)
      bucket.tripIds.add(r.trip.id)
    }
    return Array.from(map.values())
      .sort((a, b) => b.year - a.year)
      .map((g) => {
        const trips = new Map<string, { trip: Trip; placeCount: number }>()
        for (const v of g.visits) {
          if (!trips.has(v.trip.id)) trips.set(v.trip.id, { trip: v.trip, placeCount: 0 })
          trips.get(v.trip.id)!.placeCount += 1
        }
        return { year: g.year, count: g.visits.length, trips: Array.from(trips.values()) }
      })
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedTripId) return r.trip.id === selectedTripId
      if (selectedYear) return parseInt(r.visit.arrivalDate.split('-')[0] ?? '0', 10) === selectedYear
      return true
    })
  }, [rows, selectedYear, selectedTripId])

  return (
    <div className="min-h-full bg-paper flex flex-col">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold tracking-tightish">Timeline</h1>
          <div className="text-xs text-inkSoft">{rows.length} visit{rows.length === 1 ? '' : 's'} · {yearGroups.length} year{yearGroups.length === 1 ? '' : 's'}</div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <TimelineSidebar
          groups={yearGroups}
          selectedYear={selectedYear}
          selectedTripId={selectedTripId}
          onSelectYear={setSelectedYear}
          onSelectTrip={setSelectedTripId}
        />

        <main className="flex-1 px-6 py-8 overflow-y-auto">
          {loading ? (
            <Center><Loader2 size={16} className="animate-spin" /> Loading timeline…</Center>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={<Calendar size={18} />}
              title="No visits in this view"
              subtitle={selectedTripId ? 'This trip has no visits yet.' : 'Add a place to start your timeline.'}
            />
          ) : (
            <TimelineList rows={filteredRows} />
          )}
        </main>
      </div>
    </div>
  )
}

function TimelineList({ rows }: { rows: VisitWithRels[] }) {
  // Group consecutive rows by month for visual rhythm
  let currentMonth = ''
  return (
    <div className="max-w-3xl">
      {rows.map((r) => {
        const monthKey = r.visit.arrivalDate.slice(0, 7)
        const showHeader = monthKey !== currentMonth
        currentMonth = monthKey
        return (
          <div key={r.visit.id}>
            {showHeader && (
              <div className="text-xs uppercase tracking-wider2 text-inkFaint font-semibold py-3 sticky top-0 bg-paper z-10">
                {monthLabel(monthKey)}
              </div>
            )}
            <Link
              to={`/places/${r.place.id}`}
              className="flex gap-4 py-4 border-b border-paperEdge last:border-0 hover:bg-paperDeep/40 -mx-3 px-3 rounded-lg transition-colors group"
            >
              <div className="w-16 h-16 rounded-lg bg-paperDeep overflow-hidden shrink-0">
                {r.cover?.thumbnailUrl ? (
                  <img src={r.cover.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-inkFaint">
                    <ImageIcon size={18} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold">
                  {[r.place.region?.name, r.place.country?.name].filter(Boolean).join(' · ')}
                </div>
                <div className="text-base font-semibold tracking-tightish group-hover:text-accent transition-colors">
                  {r.place.city?.name ?? r.place.customName}
                </div>
                <div className="text-xs text-inkSoft mt-0.5 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDateRange(r.visit.arrivalDate, r.visit.departureDate)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.trip.name}</span>
                </div>
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}

function monthLabel(ym: string): string {
  const parts = ym.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[m - 1]} ${y}`
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-inkSoft">{children}</div>
}
