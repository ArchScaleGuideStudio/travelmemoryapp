import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Calendar, MapPin, Star, Trash2, Plus, Play, ImageIcon, Loader2, BookOpen, Share2,
} from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { PlacesService } from '@services/PlacesService'
import { VisitsService } from '@services/VisitsService'
import { VisitDaysService } from '@services/VisitDaysService'
import { NotesService } from '@services/NotesService'
import { MediaService } from '@services/MediaService'
import { MemoryBookService } from '@services/MemoryBookService'
import { JournalEditor } from '@components/editor/JournalEditor'
import { VisitDayEditor } from '@components/editor/VisitDayEditor'
import { PhotoUploader } from '@components/gallery/PhotoUploader'
import { PhotoGrid } from '@components/gallery/PhotoGrid'
import { Lightbox } from '@components/gallery/Lightbox'
import { EmptyState } from '@components/shared/EmptyState'
import { Button } from '@components/shared/Button'
import { formatDate, formatDateRange, addDays, daysBetween, cx } from '@lib/format'
import type { Place, Visit, VisitDay, Media, Note } from '@domain/types'

interface MediaWithUrls extends Media {
  thumbnailUrl?: string
  previewUrl?: string
}

export default function PlaceDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [place, setPlace] = useState<Place | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null)
  const [days, setDays] = useState<VisitDay[]>([])
  const [photos, setPhotos] = useState<MediaWithUrls[]>([])
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const p = await PlacesService.get(id)
      setPlace(p)
      if (!p) { setLoading(false); return }

      const vs = await VisitsService.listForPlace(id)
      setVisits(vs)
      const av = vs[0] ?? null
      setActiveVisit(av)

      if (av) {
        const [ds, ms] = await Promise.all([
          VisitDaysService.listForVisit(av.id),
          MediaService.listForVisit(av.id),
        ])
        setDays(ds)
        setPhotos(ms)
      }

      // Find or create the overview note (place-scoped)
      const notes = await NotesService.listForPlace(id)
      if (notes.length > 0) {
        setNote(notes[0])
      } else if (user) {
        const created = await NotesService.create({
          userId: user.id, placeId: id, bodyMarkdown: '',
        })
        setNote(created)
      }
    } finally {
      setLoading(false)
    }
  }, [id, user])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingShell />
  if (!place) return <NotFoundShell />

  const heroPhoto = photos.find((p) => p.id === place.coverMediaId) ?? photos[0]
  const placeName = place.city?.name ?? place.customName ?? 'Untitled place'
  const dateRange = activeVisit
    ? formatDateRange(activeVisit.arrivalDate, activeVisit.departureDate)
    : ''

  const handleAddDay = async () => {
    if (!user || !activeVisit) return
    const nextNum = days.length === 0 ? 1 : Math.max(...days.map((d) => d.dayNumber)) + 1
    const date = days.length === 0
      ? activeVisit.arrivalDate
      : addDays(days[days.length - 1].date, 1)
    const created = await VisitDaysService.create({
      userId: user.id, visitId: activeVisit.id, dayNumber: nextNum, date,
    })
    setDays([...days, created])
  }

  const handleAutoFillDays = async () => {
    if (!user || !activeVisit || !activeVisit.departureDate) return
    const total = daysBetween(activeVisit.arrivalDate, activeVisit.departureDate)
    const created: VisitDay[] = []
    for (let i = 0; i < total; i++) {
      const dayNum = days.length + i + 1
      const date = addDays(activeVisit.arrivalDate, i)
      const day = await VisitDaysService.upsertDay({
        userId: user.id, visitId: activeVisit.id, dayNumber: dayNum, date,
      })
      created.push(day)
    }
    setDays(await VisitDaysService.listForVisit(activeVisit.id))
  }

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm('Remove this day? You can restore it from Recently Deleted.')) return
    await VisitDaysService.softDelete(dayId)
    setDays(days.filter((d) => d.id !== dayId))
  }

  const handleSetCover = async (mediaId: string) => {
    if (!id) return
    await MediaService.setAsCover(mediaId, 'place', id)
    setPlace((p) => p ? { ...p, coverMediaId: mediaId } : p)
  }

  const handleDeletePhoto = async (mediaId: string) => {
    await MediaService.softDelete(mediaId)
    setPhotos(photos.filter((p) => p.id !== mediaId))
    setLightboxIndex(null)
  }

  const handleToggleFavourite = async () => {
    if (!place) return
    const next = !place.isFavourite
    setPlace({ ...place, isFavourite: next })
    await PlacesService.update(place.id, { isFavourite: next })
  }

  const handleDeletePlace = async () => {
    if (!place) return
    if (!confirm(`Move "${placeName}" to Recently Deleted? You can restore it within 30 days.`)) return
    await PlacesService.softDelete(place.id)
    navigate('/')
  }

  return (
    <div className="min-h-full bg-paper pb-16">
      {/* Hero */}
      <div className="relative h-64 sm:h-80 md:h-96 bg-paperDeep overflow-hidden">
        {heroPhoto?.previewUrl ? (
          <img src={heroPhoto.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-inkFaint">
            <ImageIcon size={42} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

        {/* Top bar overlay */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-4 text-paper">
          <Link to="/" className="p-2 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => user && MemoryBookService.openForPlace(place.id, user.id).catch((e) => alert(e.message))}>
              <BookOpen size={16} />
            </IconBtn>
            <IconBtn onClick={handleToggleFavourite} active={place.isFavourite}>
              <Star size={16} className={place.isFavourite ? 'fill-current' : ''} />
            </IconBtn>
            <IconBtn onClick={handleDeletePlace}>
              <Trash2 size={16} />
            </IconBtn>
          </div>
        </div>

        {/* Title block */}
        <div className="absolute bottom-0 inset-x-0 px-6 pb-6 text-paper">
          <div className="text-[11px] uppercase tracking-wider2 font-semibold opacity-80 mb-1">
            {[place.region?.name, place.country?.name].filter(Boolean).join(' · ')}
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tightish">{placeName}</h1>
          {dateRange && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-sm opacity-90">
              <Calendar size={13} /> {dateRange}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Quick facts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-panel border border-paperEdge rounded-xl p-4">
          <Fact label="Visits" value={String(place.visitCount)} />
          <Fact label="Photos" value={String(photos.length)} />
          <Fact label="First visited" value={place.firstVisitedAt ? formatDate(place.firstVisitedAt) : '—'} />
          <Fact label="Coordinates" value={`${place.lat.toFixed(2)}°, ${place.lng.toFixed(2)}°`} />
        </div>

        {/* Place-level note */}
        {note && (
          <section>
            <SectionHeader title="Overview" subtitle="A general impression — auto-saved" />
            <JournalEditor
              initialBody={note.bodyMarkdown}
              showTitle={false}
              placeholder="A short impression of this place. The kind of thing you'd tell a friend."
              onSave={async ({ bodyMarkdown }) => {
                await NotesService.update(note.id, { bodyMarkdown })
              }}
              minHeight={140}
            />
          </section>
        )}

        {/* Per-day journal */}
        {activeVisit && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tightish">Day by day</h2>
                <div className="text-xs text-inkSoft">Per-day entries for this visit</div>
              </div>
              <div className="flex items-center gap-2">
                {activeVisit.departureDate && days.length === 0 && (
                  <Button size="sm" variant="secondary" onClick={handleAutoFillDays}>
                    Auto-create days
                  </Button>
                )}
                <Button size="sm" onClick={handleAddDay} icon={<Plus size={13} />}>
                  Add day
                </Button>
              </div>
            </div>

            {days.length === 0 ? (
              <EmptyState
                icon={<Calendar size={18} />}
                title="No days logged yet"
                subtitle="Add per-day journal entries to capture what happened on each day of this visit."
              />
            ) : (
              <div className="space-y-3">
                {days.map((day) => (
                  <VisitDayEditor
                    key={day.id}
                    day={day}
                    onSave={(id, patch) => VisitDaysService.update(id, patch)}
                    onDelete={handleDeleteDay}
                    defaultExpanded={days.length <= 3}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Photos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tightish">Photos</h2>
              <div className="text-xs text-inkSoft">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</div>
            </div>
            {photos.length > 0 && (
              <Button size="sm" variant="secondary" icon={<Play size={13} />}
                onClick={() => alert('Slideshow lands in Phase 4')}>
                Play slideshow
              </Button>
            )}
          </div>

          {activeVisit && (
            <div className="mb-4">
              <PhotoUploader
                placeId={place.id}
                visitId={activeVisit.id}
                onUploaded={load}
              />
            </div>
          )}

          {photos.length > 0 && (
            <PhotoGrid items={photos} onSelect={setLightboxIndex} />
          )}
        </section>

        {/* Timeline of other visits */}
        {visits.length > 1 && (
          <section>
            <SectionHeader
              title="Other visits to this place"
              subtitle="Every time you've come back"
            />
            <div className="bg-panel border border-paperEdge rounded-xl divide-y divide-paperEdge">
              {visits.map((v) => (
                <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                  <MapPin size={14} className="text-inkFaint" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{formatDateRange(v.arrivalDate, v.departureDate)}</div>
                    {v.summaryNotes && <div className="text-xs text-inkSoft truncate">{v.summaryNotes}</div>}
                  </div>
                  {v.id === activeVisit?.id && (
                    <span className="text-[10px] uppercase tracking-wider2 font-semibold text-accent">Now viewing</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={handleDeletePhoto}
          onSetCover={handleSetCover}
        />
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium mb-0.5">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold tracking-tightish">{title}</h2>
      {subtitle && <div className="text-xs text-inkSoft">{subtitle}</div>}
    </div>
  )
}

function IconBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'p-2 rounded-lg backdrop-blur',
        active ? 'bg-accent text-paper' : 'bg-black/30 text-paper hover:bg-black/50',
      )}
    >
      {children}
    </button>
  )
}

function LoadingShell() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <div className="flex items-center gap-2 text-inkSoft text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading place…
      </div>
    </div>
  )
}

function NotFoundShell() {
  return (
    <div className="min-h-full flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider2 text-inkFaint mb-1">Not found</div>
        <h1 className="text-xl font-semibold mb-3">Place not found</h1>
        <Link to="/" className="text-sm text-accent hover:text-accentDeep">← Back to atlas</Link>
      </div>
    </div>
  )
}
