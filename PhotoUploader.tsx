import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, Loader2, Check, AlertCircle, Image as ImageIcon, Camera } from 'lucide-react'
import { MediaService } from '@services/MediaService'
import { useAuth } from '@hooks/useAuth'
import { capture } from '@infra/capture'
import { isNative } from '@infra/platform'
import { hapticTap } from '@infra/share'
import { formatBytes, cx } from '@lib/format'

interface Props {
  placeId?: string
  visitId?: string
  visitDayId?: string
  tripId?: string
  onUploaded?: () => void
}

interface UploadJob {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  progress: number
}

/**
 * Drag-drop multi-upload on web; native picker/camera on mobile.
 * Uses the capture adapter so the same component drives both.
 */
export function PhotoUploader({ placeId, visitId, visitDayId, tripId, onUploaded }: Props) {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const native = isNative()

  const processFiles = async (files: File[]) => {
    if (!user || files.length === 0) return
    const arr = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (arr.length === 0) return

    const newJobs: UploadJob[] = arr.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      status: 'queued',
      progress: 0,
    }))
    setJobs((prev) => [...prev, ...newJobs])

    for (const job of newJobs) {
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'uploading', progress: 10 } : j))
      try {
        await MediaService.upload({
          userId: user.id, file: job.file,
          placeId, visitId, visitDayId, tripId,
        })
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'done', progress: 100 } : j))
        void hapticTap()
      } catch (err) {
        setJobs((prev) => prev.map((j) => j.id === job.id ? {
          ...j, status: 'error', error: err instanceof Error ? err.message : 'Upload failed', progress: 0,
        } : j))
      }
    }
    onUploaded?.()
    setTimeout(() => setJobs((prev) => prev.filter((j) => j.status !== 'done')), 2000)
  }

  const handlePick = async () => {
    if (native) {
      const ok = await capture.ensurePermission()
      if (ok === 'denied') {
        alert('Photo library access is needed to add photos. Enable it in Settings → Atlas.')
        return
      }
      const files = await capture.pickPhotos({ multiple: true })
      void processFiles(files)
    } else {
      inputRef.current?.click()
    }
  }

  const handleCamera = async () => {
    if (!native) return
    const ok = await capture.ensurePermission()
    if (ok === 'denied') {
      alert('Camera access is needed. Enable it in Settings → Atlas.')
      return
    }
    const file = await capture.takePhoto()
    if (file) void processFiles([file])
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files) void processFiles(Array.from(e.dataTransfer.files))
  }

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void processFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const active = jobs.filter((j) => j.status === 'uploading' || j.status === 'queued')

  return (
    <div>
      {native ? (
        // Native UI — two buttons, no drag-drop affordance
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCamera}
            className="flex flex-col items-center justify-center gap-1.5 px-4 py-5 bg-ink text-paper rounded-xl hover:opacity-90"
          >
            <Camera size={20} />
            <span className="text-sm font-medium">Take photo</span>
          </button>
          <button
            onClick={handlePick}
            className="flex flex-col items-center justify-center gap-1.5 px-4 py-5 bg-panel border border-paperEdge rounded-xl hover:border-inkFaint"
          >
            <Upload size={20} />
            <span className="text-sm font-medium">Choose photos</span>
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={handlePick}
          className={cx(
            'cursor-pointer border-2 border-dashed rounded-xl px-6 py-8 text-center transition-colors',
            dragging ? 'border-ink bg-paperDeep' : 'border-paperEdge bg-paper hover:border-inkFaint',
          )}
        >
          <Upload size={20} className="mx-auto mb-2 text-inkSoft" />
          <div className="text-sm font-medium">Drop photos here, or click to choose</div>
          <div className="text-xs text-inkFaint mt-1">JPG, PNG, HEIC, WEBP, MP4 · up to 50 MB</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onSelect}
            className="hidden"
          />
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-3 px-3 py-2 bg-panel border border-paperEdge rounded-lg text-xs">
              <div className="w-7 h-7 rounded bg-paperDeep flex items-center justify-center text-inkSoft shrink-0">
                {j.status === 'uploading' ? <Loader2 size={13} className="animate-spin" />
                  : j.status === 'done'   ? <Check size={13} className="text-success" />
                  : j.status === 'error'  ? <AlertCircle size={13} className="text-danger" />
                  : <ImageIcon size={13} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{j.file.name}</div>
                <div className="text-inkFaint">
                  {j.status === 'error' ? j.error
                    : j.status === 'done' ? 'Uploaded'
                    : `${formatBytes(j.file.size)} · ${j.status}`}
                </div>
              </div>
            </div>
          ))}
          {active.length > 0 && (
            <div className="text-[11px] text-inkFaint text-center mt-2">
              {active.length} photo{active.length === 1 ? '' : 's'} processing…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
