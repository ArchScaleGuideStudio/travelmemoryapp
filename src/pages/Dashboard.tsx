import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Map, Calendar, Plus, Settings as SettingsIcon, Trash2, MapPin, Image as ImageIcon, Search, FolderHeart } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { PlacesService } from '@services/PlacesService'
import { MediaService } from '@services/MediaService'
import { EmptyState } from '@components/shared/EmptyState'
import { OnThisDayCard } from '@components/shared/OnThisDayCard'
import { formatDate, cx } from '@lib/format'
import type { Place, Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string }

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [places, setPlaces] = useState<Place[]>([])
  const [coversByPlace, setCoversByPlace] = useState<Record<string, MediaWithUrls | undefined>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      try {
        const list = await PlacesService.listWithHydrated(user.id)
        setPlaces(list)
        // Fetch covers in parallel for the first 12 places
        const covers: Record<string, MediaWithUrls | undefined> = {}
        await Promise.all(
          list.slice(0, 12).map(async (p) => {
            if (!p.coverMediaId) return
            try { covers[p.id] = await MediaService.get(p.coverMediaId) ?? undefined } catch {}
          }),
        )
        setCoversByPlace(covers)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  const stats = computeStats(places)

  return (
    <div className="min-h-full p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-ink text-paper flex items-center justify-center">
            <Compass size={17} />
          </div>
          <div className="text-base font-semibold tracking-tightish">Atlas</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/recently-deleted" className="text-inkSoft hover:text-ink" title="Recently deleted">
            <Trash2 size={15} />
          </Link>
          <Link to="/settings" className="text-inkSoft hover:text-ink" title="Settings">
            <SettingsIcon size={15} />
          </Link>
          <span className="text-inkSoft text-xs hidden sm:block">{user?.email}</span>
          <button onClick={signOut} className="text-inkSoft hover:text-ink text-xs">Sign out</button>
        </div>
      </header>

      {/* Welcome + stats */}
      <div className="mb-10">
        <div className="text-xs uppercase tracking-wider2 text-inkFaint font-medium mb-2">Welcome back</div>
        <h1 className="text-3xl font-semibold tracking-tightish mb-1">Your atlas</h1>
        <p className="text-inkSoft">A vault for the places you've been and the memories you've made there.</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Places" value={stats.places} />
        <Stat label="Countries" value={stats.countries} />
        <Stat label="Photos" value={stats.photos} />
        <Stat label="Favourites" value={stats.favourites} />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-10">
        <NavCard to="/places/new" icon={<Plus size={18} />} label="Add a place"     accent />
        <NavCard to="/map"        icon={<Map size={18} />}  label="World map" />
        <NavCard to="/timeline"   icon={<Calendar size={18} />} label="Timeline" />
        <NavCard to="/gallery"    icon={<ImageIcon size={18} />} label="Gallery" />
        <NavCard to="/albums"     icon={<FolderHeart size={18} />} label="Albums" />
        <NavCard to="/search"     icon={<Search size={18} />} label="Search" />
      </div>

      {/* On this day */}
      <OnThisDayCard />

      {/* Places grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-panel border border-paperEdge rounded-xl animate-pulse" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <EmptyState
          icon={<MapPin size={20} />}
          title="Begin your atlas"
          subtitle="Add your first place and start writing the memory."
          action={
            <Link
              to="/places/new"
              className="inline-flex items-center gap-2 bg-ink text-paper px-5 py-2.5 rounded-lg font-medium text-sm hover:opacity-90"
            >
              <Plus size={15} /> Add your first place
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold tracking-tightish">Recently visited</h2>
            <Link to="/timeline" className="text-xs text-inkSoft hover:text-ink">See all →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {places.slice(0, 8).map((p) => (
              <PlaceCard key={p.id} place={p} cover={coversByPlace[p.id]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PlaceCard({ place, cover }: { place: Place; cover?: MediaWithUrls }) {
  return (
    <Link to={`/places/${place.id}`} className="group block float-in">
      <div className="aspect-[4/5] bg-paperDeep rounded-xl overflow-hidden mb-2 relative">
        {cover?.thumbnailUrl ? (
          <img src={cover.thumbnailUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-inkFaint">
            <ImageIcon size={24} />
          </div>
        )}
        {place.isFavourite && (
          <div className="absolute top-2 right-2 bg-accent text-paper text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded">
            ★
          </div>
        )}
      </div>
      <div className="px-1">
        <div className="text-sm font-semibold truncate group-hover:text-accent transition-colors">
          {place.city?.name ?? place.customName ?? 'Untitled'}
        </div>
        <div className="text-xs text-inkSoft truncate">
          {place.country?.name ?? '—'}{place.lastVisitedAt && ` · ${formatDate(place.lastVisitedAt)}`}
        </div>
      </div>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-panel border border-paperEdge rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium mb-1">{label}</div>
      <div className="text-2xl font-semibold tracking-tightish">{value}</div>
    </div>
  )
}

function NavCard({ to, icon, label, accent }: { to: string; icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={cx(
        'flex items-center gap-2.5 px-4 py-3.5 rounded-xl transition-opacity',
        accent ? 'bg-ink text-paper hover:opacity-90'
               : 'bg-panel border border-paperEdge hover:border-inkFaint',
      )}
    >
      {icon}<span className="text-sm font-medium">{label}</span>
    </Link>
  )
}

function computeStats(places: Place[]) {
  const countries = new Set(places.map((p) => p.country?.isoA2).filter(Boolean))
  const favourites = places.filter((p) => p.isFavourite).length
  return { places: places.length, countries: countries.size, photos: '—', favourites }
}
