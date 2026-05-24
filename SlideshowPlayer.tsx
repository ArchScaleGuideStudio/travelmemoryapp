import { useEffect, useState, useRef } from 'react'
import { X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Media } from '@domain/types'
import { formatDate, cx } from '@lib/format'

interface MediaWithUrls extends Media { previewUrl?: string; thumbnailUrl?: string }

interface Props {
  items: MediaWithUrls[]
  startIndex?: number
  durationMs?: number
  onClose: () => void
  placeName?: string
}

/**
 * Fullscreen slideshow player.
 * - Auto-advances every `durationMs` (default 4s) when playing
 * - Spacebar to pause/play, arrows to navigate, Esc to close
 * - Smooth cross-fade between slides
 */
export function SlideshowPlayer({ items, startIndex = 0, durationMs = 4000, onClose, placeName }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Auto-advance
  useEffect(() => {
    if (!playing) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1 >= items.length ? 0 : i + 1))
    }, durationMs)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, durationMs, items.length])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft')  setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1))
      else if (e.code === 'Space')     { e.preventDefault(); setPlaying((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  // Preload neighbors
  useEffect(() => {
    const preload = (i: number) => {
      const m = items[i]
      if (m?.previewUrl) { const img = new Image(); img.src = m.previewUrl }
    }
    preload(index + 1); preload(index + 2)
  }, [index, items])

  const current = items[index]
  if (!current) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col fade-in">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 px-5 py-4 flex items-center justify-between text-paper bg-gradient-to-b from-black/60 to-transparent">
        <div className="text-xs text-paper/70">{index + 1} / {items.length}</div>
        <button onClick={onClose} className="p-2 rounded-lg text-paper/80 hover:text-paper hover:bg-paper/10">
          <X size={18} />
        </button>
      </div>

      {/* Photo area — cross-fade */}
      <div className="flex-1 relative flex items-center justify-center">
        {items.map((m, i) => (
          <img
            key={m.id}
            src={m.previewUrl ?? m.thumbnailUrl}
            alt={m.caption ?? ''}
            className={cx(
              'absolute inset-0 w-full h-full object-contain transition-opacity duration-700',
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
          />
        ))}
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 px-6 py-5 bg-gradient-to-t from-black/80 to-transparent text-paper">
        {(current.caption || placeName) && (
          <div className="max-w-2xl mx-auto text-center mb-4">
            {current.caption && <div className="text-base font-medium">{current.caption}</div>}
            {placeName && (
              <div className="text-xs text-paper/60 mt-1">
                {placeName}{current.takenAt && ` · ${formatDate(current.takenAt)}`}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="p-2.5 rounded-full bg-paper/10 hover:bg-paper/20 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="p-3 rounded-full bg-paper text-ink hover:opacity-90"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={index === items.length - 1}
            className="p-2.5 rounded-full bg-paper/10 hover:bg-paper/20 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1 mt-4">
          {items.slice(0, Math.min(items.length, 30)).map((_, i) => (
            <div
              key={i}
              className={cx(
                'h-1 rounded-full transition-all',
                i === index ? 'bg-paper w-6' : 'bg-paper/30 w-1',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
