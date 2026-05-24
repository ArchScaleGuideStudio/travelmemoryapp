import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Loader2 } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { AlbumsService } from '@services/AlbumsService'
import { MediaService } from '@services/MediaService'
import { PhotoGrid } from '@components/gallery/PhotoGrid'
import { Lightbox } from '@components/gallery/Lightbox'
import { SlideshowPlayer } from '@components/slideshow/SlideshowPlayer'
import { EmptyState } from '@components/shared/EmptyState'
import { Button } from '@components/shared/Button'
import { Image as ImageIcon } from 'lucide-react'
import type { Album, Media } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string; previewUrl?: string }

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [album, setAlbum] = useState<Album | null>(null)
  const [items, setItems] = useState<MediaWithUrls[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!id || !user) return
    void (async () => {
      setLoading(true)
      try {
        const a = await AlbumsService.get(id)
        setAlbum(a)
        if (!a) return
        const mediaIds = await AlbumsService.listMedia(id)
        const photos = await Promise.all(mediaIds.map((mid) => MediaService.get(mid).catch(() => null)))
        setItems(photos.filter((m): m is MediaWithUrls => m !== null))
      } finally {
        setLoading(false)
      }
    })()
  }, [id, user?.id])

  if (loading) {
    return <div className="min-h-full flex items-center justify-center gap-2 text-sm text-inkSoft">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  }
  if (!album) {
    return <div className="min-h-full flex items-center justify-center">
      <Link to="/albums" className="text-sm text-accent">← Back to albums</Link>
    </div>
  }

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/albums" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-semibold">Album</div>
          <h1 className="text-base font-semibold tracking-tightish">{album.name}</h1>
          <div className="text-xs text-inkSoft">{items.length} photo{items.length === 1 ? '' : 's'}</div>
        </div>
        {items.length > 0 && (
          <Button size="sm" icon={<Play size={13} />} onClick={() => setPlaying(true)}>Play</Button>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {items.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={18} />}
            title="No photos yet"
            subtitle="Add photos to this album from the gallery or any place page."
          />
        ) : (
          <PhotoGrid items={items} onSelect={setLightboxIndex} size="sm" />
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox items={items} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      {playing && (
        <SlideshowPlayer
          items={items}
          onClose={() => setPlaying(false)}
          placeName={album.name}
        />
      )}
    </div>
  )
}
