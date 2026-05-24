import { Image as ImageIcon, Play } from 'lucide-react'
import type { Media } from '@domain/types'
import { cx } from '@lib/format'

interface MediaWithUrls extends Media {
  thumbnailUrl?: string
  previewUrl?: string
}

interface Props {
  items: MediaWithUrls[]
  onSelect: (index: number) => void
  size?: 'sm' | 'md' | 'lg'
}

export function PhotoGrid({ items, onSelect, size = 'md' }: Props) {
  if (items.length === 0) return null
  const gridCols = size === 'sm' ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8'
                  : size === 'lg' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                  : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'

  return (
    <div className={cx('grid gap-1.5', gridCols)}>
      {items.map((m, i) => (
        <button
          key={m.id}
          onClick={() => onSelect(i)}
          className="aspect-square bg-paperDeep rounded-md overflow-hidden group relative"
        >
          {m.thumbnailUrl ? (
            <img
              src={m.thumbnailUrl}
              alt={m.caption ?? m.originalFilename ?? 'Photo'}
              loading="lazy"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-inkFaint">
              <ImageIcon size={18} />
            </div>
          )}
          {m.kind === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-9 h-9 rounded-full bg-black/55 text-paper flex items-center justify-center">
                <Play size={14} fill="currentColor" />
              </div>
            </div>
          )}
          {m.kind === 'video' && m.durationSeconds && (
            <div className="absolute bottom-1 right-1 bg-black/70 text-paper text-[9px] font-mono px-1 py-0.5 rounded">
              {formatDuration(m.durationSeconds)}
            </div>
          )}
          {m.isCover && (
            <div className="absolute top-1 right-1 bg-ink/80 text-paper text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded">
              Cover
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
