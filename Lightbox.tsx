import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Star, Trash2, Download, Loader2, Share2 } from 'lucide-react'
import type { Media } from '@domain/types'
import { MediaService } from '@services/MediaService'
import { shareContent } from '@infra/share'
import { formatDate, cx } from '@lib/format'

interface MediaWithUrls extends Media {
  thumbnailUrl?: string
  previewUrl?: string
  originalUrl?: string
  posterUrl?: string
}

interface Props {
  items: MediaWithUrls[]
  startIndex: number
  onClose: () => void
  onChange?: (index: number) => void
  onDelete?: (mediaId: string) => Promise<void>
  onSetCover?: (mediaId: string) => Promise<void>
}

export function Lightbox({ items, startIndex, onClose, onChange, onDelete, onSetCover }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const current = items[index]

  useEffect(() => { setIndex(startIndex) }, [startIndex])
  useEffect(() => { onChange?.(index) }, [index, onChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setOriginalUrl(null)
    if (!current) return
    MediaService.signedUrl(current, 'original').then(setOriginalUrl).catch(() => setOriginalUrl(null))
  }, [current?.id])

  if (!current) return null

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('Move this to Recently Deleted?')) return
    setActionBusy(true)
    try { await onDelete(current.id) } finally { setActionBusy(false) }
  }

  const handleSetCover = async () => {
    if (!onSetCover) return
    setActionBusy(true)
    try { await onSetCover(current.id) } finally { setActionBusy(false) }
  }

  const handleShare = async () => {
    if (!originalUrl) return
    await shareContent({
      title: current.caption ?? 'Photo from my atlas',
      url: originalUrl,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 flex flex-col fade-in">
      <div className="flex items-center justify-between px-4 py-3 text-paper">
        <div className="text-xs text-paper/60">{index + 1} / {items.length}</div>
        <div className="flex items-center gap-1">
          {originalUrl && (
            <IconBtn onClick={handleShare} title="Share">
              <Share2 size={16} />
            </IconBtn>
          )}
          {onSetCover && (
            <IconBtn onClick={handleSetCover} title="Set as cover" disabled={actionBusy}>
              <Star size={16} />
            </IconBtn>
          )}
          {originalUrl && (
            <a
              href={originalUrl}
              download={current.originalFilename ?? (current.kind === 'video' ? 'video' : 'photo')}
              className="p-2 rounded-lg text-paper/80 hover:text-paper hover:bg-paper/10"
              title="Download original"
            >
              <Download size={16} />
            </a>
          )}
          {onDelete && (
            <IconBtn onClick={handleDelete} title="Delete" disabled={actionBusy}>
              <Trash2 size={16} />
            </IconBtn>
          )}
          <IconBtn onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </IconBtn>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 relative">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="absolute left-2 md:left-6 z-10 p-2 rounded-full bg-paper/10 text-paper/80 hover:bg-paper/20 disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>

        {current.kind === 'video' && current.originalUrl ? (
          <video
            key={current.id}
            src={current.originalUrl}
            poster={current.posterUrl ?? current.previewUrl}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full"
          />
        ) : current.previewUrl ? (
          <img
            src={current.previewUrl}
            alt={current.caption ?? ''}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="text-paper/60 flex items-center gap-2">
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        )}

        <button
          onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
          disabled={index === items.length - 1}
          className="absolute right-2 md:right-6 z-10 p-2 rounded-full bg-paper/10 text-paper/80 hover:bg-paper/20 disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="px-6 py-4 text-paper">
        {current.caption && <div className="text-sm">{current.caption}</div>}
        <div className="text-[11px] text-paper/50 mt-1">
          {current.takenAt && <>{formatDate(current.takenAt)} · </>}
          {current.originalFilename}
          {current.kind === 'video' && current.durationSeconds && (
            <> · {Math.round(current.durationSeconds)}s</>
          )}
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick?: () => void; title?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx('p-2 rounded-lg text-paper/80 hover:text-paper hover:bg-paper/10 disabled:opacity-40')}
    >
      {children}
    </button>
  )
}
