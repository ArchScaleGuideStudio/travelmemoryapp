import { useState } from 'react'
import { ChevronRight, Calendar } from 'lucide-react'
import { cx } from '@lib/format'
import type { Place, Trip } from '@domain/types'

interface YearGroup {
  year: number
  count: number
  trips: { trip: Trip; placeCount: number }[]
}

interface Props {
  groups: YearGroup[]
  selectedYear: number | null
  selectedTripId: string | null
  onSelectYear: (year: number | null) => void
  onSelectTrip: (tripId: string | null) => void
}

export function TimelineSidebar({ groups, selectedYear, selectedTripId, onSelectYear, onSelectTrip }: Props) {
  return (
    <aside className="w-full md:w-64 bg-panel border-r border-paperEdge px-3 py-4 scrollbar-thin overflow-y-auto">
      <div className="px-2 mb-3">
        <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium">Browse</div>
      </div>

      <button
        onClick={() => { onSelectYear(null); onSelectTrip(null) }}
        className={cx(
          'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          selectedYear === null && selectedTripId === null
            ? 'bg-ink text-paper'
            : 'text-ink hover:bg-paperDeep',
        )}
      >
        All time
      </button>

      <div className="mt-4 space-y-1">
        {groups.map((g) => (
          <YearFolder
            key={g.year}
            group={g}
            isActive={selectedYear === g.year}
            selectedTripId={selectedTripId}
            onSelectYear={() => { onSelectYear(g.year); onSelectTrip(null) }}
            onSelectTrip={onSelectTrip}
          />
        ))}
      </div>
    </aside>
  )
}

function YearFolder({
  group, isActive, selectedTripId, onSelectYear, onSelectTrip,
}: {
  group: YearGroup
  isActive: boolean
  selectedTripId: string | null
  onSelectYear: () => void
  onSelectTrip: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(isActive || group.year === new Date().getFullYear())
  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-inkFaint hover:text-ink"
        >
          <ChevronRight size={13} className={cx('transition-transform', expanded && 'rotate-90')} />
        </button>
        <button
          onClick={onSelectYear}
          className={cx(
            'flex-1 text-left px-2 py-1.5 rounded-md text-sm font-semibold flex items-center justify-between',
            isActive ? 'text-accent' : 'text-ink hover:bg-paperDeep',
          )}
        >
          <span>{group.year}</span>
          <span className="text-[10px] text-inkFaint">{group.count}</span>
        </button>
      </div>
      {expanded && group.trips.length > 0 && (
        <div className="ml-5 mt-1 space-y-0.5 border-l border-paperEdge pl-3">
          {group.trips.map(({ trip, placeCount }) => (
            <button
              key={trip.id}
              onClick={() => onSelectTrip(trip.id)}
              className={cx(
                'w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between',
                selectedTripId === trip.id
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-inkSoft hover:text-ink hover:bg-paperDeep',
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar size={11} className="shrink-0" />
                <span className="truncate">{trip.name}</span>
              </div>
              <span className="text-[10px] text-inkFaint">{placeCount}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export type { YearGroup }
