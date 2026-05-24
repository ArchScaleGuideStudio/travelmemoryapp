import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@infra/supabase'
import { useAuth } from '@hooks/useAuth'
import { supabaseStorage } from '@infra/storage/SupabaseStorage'
import { PhotoGrid } from '@components/gallery/PhotoGrid'
import { Lightbox } from '@components/gallery/Lightbox'
import { EmptyState } from '@components/shared/EmptyState'
import { MediaService } from '@services/MediaService'
import { cx } from '@lib/format'
import type { Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string; previewUrl?: string }

export default function Gallery() {
  const { user } = useAuth()
  const [items, setItems] = useState<MediaWithUrls[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<number | 'all'>('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('media')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .eq('kind', 'photo')
          .order('taken_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(500)
        if (error) throw error
        const list: MediaWithUrls[] = (data ?? []).map(dbToMedia)
        // Hydrate thumbnails for the first 200 (grid is virtualized at render)
        await Promise.all(
          list.slice(0, 200).map(async (m) => {
            if (!m.thumbnailPath) return
            try { m.thumbnailUrl = await supabaseStorage.getSignedUrl(m.thumbnailPath, { expiresIn: 3600 }) } catch {}
          }),
        )
        setItems(list)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  // Hydrate preview URL on demand when opening lightbox
  const openLightbox = async (i: number) => {
    const item = items[i]
    if (item && !item.previewUrl && item.previewPath) {
      try { item.previewUrl = await supabaseStorage.getSignedUrl(item.previewPath, { expiresIn: 3600 }) } catch {}
      setItems([...items])
    }
    setLightboxIndex(i)
  }

  const years = useMemo(() => {
    const s = new Set<number>()
    for (const m of items) {
      const d = m.takenAt ?? m.createdAt
      if (d) s.add(parseInt(d.slice(0, 4), 10))
    }
    return Array.from(s).sort((a, b) => b - a)
  }, [items])

  const filtered = useMemo(() => {
    if (year === 'all') return items
    return items.filter((m) => {
      const d = m.takenAt ?? m.createdAt
      return d?.startsWith(String(year))
    })
  }, [items, year])

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3 sticky top-0 z-10">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold">Gallery</h1>
          <div className="text-xs text-inkSoft">{filtered.length} photo{filtered.length === 1 ? '' : 's'}</div>
        </div>
      </header>

      {years.length > 1 && (
        <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-thin bg-panel border-b border-paperEdge">
          <Chip active={year === 'all'} onClick={() => setYear('all')}>All</Chip>
          {years.map((y) => (
            <Chip key={y} active={year === y} onClick={() => setYear(y)}>{y}</Chip>
          ))}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <Center><Loader2 size={16} className="animate-spin" /> Loading photos…</Center>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={18} />}
            title="No photos yet"
            subtitle="Upload photos from any place page and they'll all appear here."
          />
        ) : (
          <PhotoGrid items={filtered} onSelect={openLightbox} size="sm" />
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={filtered}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={async (id) => {
            await MediaService.softDelete(id)
            setItems(items.filter((m) => m.id !== id))
            setLightboxIndex(null)
          }}
        />
      )}
    </div>
  )
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'bg-ink text-paper' : 'bg-paper text-inkSoft border border-paperEdge hover:border-inkFaint',
      )}
    >
      {children}
    </button>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-inkSoft">{children}</div>
}

function dbToMedia(r: any): MediaWithUrls {
  return {
    id: r.id, userId: r.user_id, placeId: r.place_id, visitId: r.visit_id, visitDayId: r.visit_day_id, tripId: r.trip_id,
    kind: r.kind, storageProvider: r.storage_provider, originalPath: r.original_path,
    previewPath: r.preview_path, thumbnailPath: r.thumbnail_path,
    width: r.width, height: r.height, durationSeconds: r.duration_seconds, fileSizeBytes: r.file_size_bytes,
    mimeType: r.mime_type, originalFilename: r.original_filename,
    takenAt: r.taken_at, capturedLat: r.captured_lat, capturedLng: r.captured_lng,
    caption: r.caption, altText: r.alt_text,
    perceptualHash: r.perceptual_hash, contentHash: r.content_hash,
    exif: r.exif ?? {}, isCover: r.is_cover ?? false,
    createdAt: r.created_at, deletedAt: r.deleted_at,
  }
}
