/**
 * Extract a poster frame and metadata from a video File.
 *
 * Uses an HTMLVideoElement to seek to ~1 second in (or 10% of duration,
 * whichever is smaller) and draw to a canvas. Returns:
 *   - posterBlob: webp poster image
 *   - width, height, durationSeconds, hasAudio
 *
 * Pure browser API — works in WebView too (iOS and Android).
 * On some iOS versions, drawImage of a cross-origin video can fail; we wrap
 * the whole thing in try/catch and return what we can.
 */

export interface VideoPosterResult {
  posterBlob: Blob | null
  width: number
  height: number
  durationSeconds: number
  hasAudio: boolean
}

export async function extractVideoPoster(file: File, posterMaxSide = 1200): Promise<VideoPosterResult> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    const objectUrl = URL.createObjectURL(file)
    video.src = objectUrl

    let resolved = false
    const finalize = (result: VideoPosterResult) => {
      if (resolved) return
      resolved = true
      URL.revokeObjectURL(objectUrl)
      resolve(result)
    }

    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : 0
      // Seek to a representative frame
      const target = Math.min(1.0, duration * 0.1)
      video.currentTime = Math.max(0, target)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const aspect = video.videoWidth / Math.max(1, video.videoHeight)
        let w = video.videoWidth, h = video.videoHeight
        if (Math.max(w, h) > posterMaxSide) {
          if (w >= h) { w = posterMaxSide; h = Math.round(posterMaxSide / aspect) }
          else        { h = posterMaxSide; w = Math.round(posterMaxSide * aspect) }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          finalize({ posterBlob: null, width: video.videoWidth, height: video.videoHeight, durationSeconds: video.duration, hasAudio: false })
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        canvas.toBlob((blob) => {
          finalize({
            posterBlob: blob,
            width: video.videoWidth,
            height: video.videoHeight,
            durationSeconds: video.duration,
            // Heuristic — proper detection needs MediaSource; this is a best-effort flag
            hasAudio: detectHasAudio(video),
          })
        }, 'image/webp', 0.85)
      } catch {
        finalize({ posterBlob: null, width: video.videoWidth, height: video.videoHeight, durationSeconds: video.duration, hasAudio: false })
      }
    }

    video.onerror = () => finalize({ posterBlob: null, width: 0, height: 0, durationSeconds: 0, hasAudio: false })
    // Safety timeout — some video formats hang
    setTimeout(() => finalize({ posterBlob: null, width: 0, height: 0, durationSeconds: 0, hasAudio: false }), 8000)
  })
}

function detectHasAudio(video: HTMLVideoElement): boolean {
  const v: any = video
  if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio
  if (typeof v.webkitAudioDecodedByteCount === 'number') return v.webkitAudioDecodedByteCount > 0
  if (v.audioTracks && typeof v.audioTracks.length === 'number') return v.audioTracks.length > 0
  return true   // assume yes for unknown
}
