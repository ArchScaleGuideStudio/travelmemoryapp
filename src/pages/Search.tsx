import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, MapPin, Map, FileText, Camera, Loader2 } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { useDebounced } from '@hooks/useDebounced'
import { SearchService, SearchHit } from '@services/SearchService'
import { EmptyState } from '@components/shared/EmptyState'
import { formatDate, cx } from '@lib/format'

const TYPE_META = {
  place:  { icon: MapPin,  label: 'Place',  route: (h: SearchHit) => `/places/${h.id}` },
  trip:   { icon: Map,     label: 'Trip',   route: (h: SearchHit) => `/trips/${h.id}` },
  visit:  { icon: MapPin,  label: 'Visit',  route: (h: SearchHit) => `/places/${h.id}` },
  note:   { icon: FileText, label: 'Note',  route: (h: SearchHit) => `/places/${h.id}` },
  media:  { icon: Camera,  label: 'Photo',  route: (h: SearchHit) => `/places/${h.id}` },
} as const

export default function Search() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const debounced = useDebounced(query, 350)

  useEffect(() => {
    if (!user || debounced.trim().length < 2) { setHits([]); return }
    setLoading(true)
    SearchService.search(user.id, debounced)
      .then(setHits)
      .catch(() => setHits([]))
      .finally(() => setLoading(false))
  }, [debounced, user?.id])

  const grouped = groupByType(hits)

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3 sticky top-0 z-10">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 relative">
          <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkFaint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, trips, notes, photo captions…"
            className="w-full pl-10 pr-3 py-2.5 bg-paper border border-paperEdge rounded-lg text-sm outline-none focus:border-ink"
          />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {query.trim().length < 2 ? (
          <EmptyState
            icon={<SearchIcon size={18} />}
            title="Search your atlas"
            subtitle="Type at least 2 characters. Searches city names, trip titles, notes, and photo captions."
          />
        ) : loading && hits.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-inkSoft">
            <Loader2 size={15} className="animate-spin" /> Searching…
          </div>
        ) : hits.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={18} />}
            title="No matches"
            subtitle={`Nothing matches “${query}” in your atlas yet.`}
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([type, list]) => {
              const meta = TYPE_META[type as keyof typeof TYPE_META]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <section key={type}>
                  <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold mb-2 px-3">
                    {meta.label}{list.length > 1 ? 's' : ''}
                  </div>
                  <div className="bg-panel border border-paperEdge rounded-xl divide-y divide-paperEdge">
                    {list.map((h, idx) => (
                      <Link
                        key={`${h.type}-${h.id}-${idx}`}
                        to={meta.route(h)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-paperDeep/40 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-paperDeep flex items-center justify-center text-inkSoft shrink-0">
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate group-hover:text-accent">{h.title}</div>
                          {(h.subtitle || h.date) && (
                            <div className="text-xs text-inkSoft truncate">
                              {h.subtitle}{h.date && ` · ${formatDate(h.date)}`}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function groupByType(hits: SearchHit[]): Record<string, SearchHit[]> {
  const out: Record<string, SearchHit[]> = {}
  for (const h of hits) {
    if (!out[h.type]) out[h.type] = []
    out[h.type].push(h)
  }
  return out
}
