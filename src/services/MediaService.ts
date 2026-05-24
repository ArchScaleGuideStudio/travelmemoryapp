import imageCompression from 'browser-image-compression'
import { supabase } from '@infra/supabase'
import { supabaseStorage } from '@infra/storage/SupabaseStorage'
import { buildStoragePath } from '@infra/storage/StorageAdapter'
import { uuid } from '@lib/id'
import { extractVideoPoster } from '@lib/video'
import type { Media, MediaKind } from '@domain/types'

interface UploadArgs {
  userId: string
  file: File
  placeId?: string
  visitId?: string
  visitDayId?: string
  tripId?: string
  caption?: string
}

interface MediaWithUrls extends Media {
  thumbnailUrl?: string
  previewUrl?: string
  originalUrl?: string
  posterUrl?: string
}

export const MediaService = {
  async upload(args: UploadArgs): Promise<Media> {
    const kind: MediaKind = args.file.type.startsWith('video/') ? 'video' : 'photo'
    return kind === 'video' ? uploadVideo(args) : uploadPhoto(args)
  },

  async listForPlace(placeId: string): Promise<MediaWithUrls[]> {
    return listByQuery(supabase.from('media').select('*').eq('place_id', placeId))
  },
  async listForVisit(visitId: string): Promise<MediaWithUrls[]> {
    return listByQuery(supabase.from('media').select('*').eq('visit_id', visitId))
  },
  async listForVisitDay(visitDayId: string): Promise<MediaWithUrls[]> {
    return listByQuery(supabase.from('media').select('*').eq('visit_day_id', visitDayId))
  },

  async get(mediaId: string): Promise<MediaWithUrls | null> {
    const { data, error } = await supabase.from('media')
      .select('*').eq('id', mediaId).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? hydrateUrls(dbToMedia(data)) : null
  },

  async updateCaption(mediaId: string, caption: string): Promise<void> {
    const { error } = await supabase.from('media').update({ caption }).eq('id', mediaId)
    if (error) throw error
  },

  async softDelete(mediaId: string): Promise<void> {
    const { error } = await supabase.from('media')
      .update({ deleted_at: new Date().toISOString() }).eq('id', mediaId)
    if (error) throw error
  },

  async restore(mediaId: string): Promise<void> {
    const { error } = await supabase.from('media')
      .update({ deleted_at: null }).eq('id', mediaId)
    if (error) throw error
  },

  async setAsCover(mediaId: string, target: 'place' | 'visit' | 'trip', targetId: string): Promise<void> {
    const col = target === 'place' ? 'places' : target === 'visit' ? 'visits' : 'trips'
    const { error } = await supabase.from(col).update({ cover_media_id: mediaId }).eq('id', targetId)
    if (error) throw error
  },

  async signedUrl(media: Media, resolution: 'thumbnail' | 'preview' | 'original' | 'poster' = 'preview'): Promise<string> {
    const path = resolution === 'thumbnail' ? media.thumbnailPath
              : resolution === 'preview'   ? media.previewPath
              : resolution === 'poster'    ? (media as any).posterPath
              : media.originalPath
    if (!path) throw new Error(`No ${resolution} path on media ${media.id}`)
    return supabaseStorage.getSignedUrl(path, { expiresIn: 3600 })
  },
}

// ---- Upload pipelines ----

async function uploadPhoto(args: UploadArgs): Promise<Media> {
  const mediaId = uuid()
  const ext = args.file.name.split('.').pop()?.toLowerCase() ?? 'jpg'

  // Content hash for exact-duplicate detection
  const contentHash = await sha256OfBlob(args.file)
  const dup = await supabase.from('media')
    .select('id').eq('user_id', args.userId).eq('content_hash', contentHash)
    .is('deleted_at', null).maybeSingle()
  if (dup.data) {
    await supabase.from('media').update({
      place_id: args.placeId ?? null,
      visit_id: args.visitId ?? null,
      visit_day_id: args.visitDayId ?? null,
      trip_id: args.tripId ?? null,
    }).eq('id', dup.data.id)
    const row = await supabase.from('media').select('*').eq('id', dup.data.id).single()
    return dbToMedia(row.data)
  }

  const originalPath = buildStoragePath('original', args.userId, mediaId, ext)
  await supabaseStorage.upload({ path: originalPath, file: args.file, contentType: args.file.type })

  const dims = await getImageDimensions(args.file)

  const preview = await imageCompression(args.file, {
    maxSizeMB: 1.5, maxWidthOrHeight: 1600,
    useWebWorker: true, fileType: 'image/webp', initialQuality: 0.85,
  })
  const previewPath = buildStoragePath('preview', args.userId, mediaId, 'webp')
  await supabaseStorage.upload({ path: previewPath, file: preview, contentType: 'image/webp' })

  const thumb = await imageCompression(args.file, {
    maxSizeMB: 0.2, maxWidthOrHeight: 400,
    useWebWorker: true, fileType: 'image/webp', initialQuality: 0.75,
  })
  const thumbnailPath = buildStoragePath('thumbnail', args.userId, mediaId, 'webp')
  await supabaseStorage.upload({ path: thumbnailPath, file: thumb, contentType: 'image/webp' })

  const perceptualHash = await aHash(thumb)

  const insertRow = {
    id: mediaId, user_id: args.userId,
    place_id: args.placeId ?? null, visit_id: args.visitId ?? null,
    visit_day_id: args.visitDayId ?? null, trip_id: args.tripId ?? null,
    kind: 'photo' as const, storage_provider: 'supabase',
    original_path: originalPath, preview_path: previewPath, thumbnail_path: thumbnailPath,
    width: dims.width, height: dims.height,
    file_size_bytes: args.file.size, mime_type: args.file.type,
    original_filename: args.file.name, content_hash: contentHash,
    perceptual_hash: perceptualHash, caption: args.caption ?? null,
  }
  const { data, error } = await supabase.from('media').insert(insertRow).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'media insert failed')
  return dbToMedia(data)
}

async function uploadVideo(args: UploadArgs): Promise<Media> {
  const mediaId = uuid()
  const ext = args.file.name.split('.').pop()?.toLowerCase() ?? 'mp4'

  // Skip content hash for video (too expensive to read large files into memory)
  const originalPath = buildStoragePath('original', args.userId, mediaId, ext)
  await supabaseStorage.upload({ path: originalPath, file: args.file, contentType: args.file.type })

  // Extract poster frame
  const { posterBlob, width, height, durationSeconds, hasAudio } = await extractVideoPoster(args.file)

  let posterPath: string | undefined
  let thumbnailPath: string | undefined
  let previewPath: string | undefined

  if (posterBlob) {
    posterPath = buildStoragePath('original', args.userId, mediaId, 'webp').replace('originals', 'posters')
    // Note: the storage_setup migration only allows specific folders. We use the
    // 'covers' folder for poster frames since they share the lifecycle pattern.
    posterPath = `${args.userId}/covers/${mediaId}-poster.webp`
    await supabaseStorage.upload({ path: posterPath, file: posterBlob, contentType: 'image/webp' })

    // The poster also serves as the thumbnail + preview for video
    const thumb = await imageCompression(new File([posterBlob], 'poster.webp', { type: 'image/webp' }), {
      maxSizeMB: 0.2, maxWidthOrHeight: 400,
      useWebWorker: true, fileType: 'image/webp', initialQuality: 0.75,
    })
    thumbnailPath = buildStoragePath('thumbnail', args.userId, mediaId, 'webp')
    await supabaseStorage.upload({ path: thumbnailPath, file: thumb, contentType: 'image/webp' })

    const preview = await imageCompression(new File([posterBlob], 'poster.webp', { type: 'image/webp' }), {
      maxSizeMB: 1.0, maxWidthOrHeight: 1600,
      useWebWorker: true, fileType: 'image/webp', initialQuality: 0.85,
    })
    previewPath = buildStoragePath('preview', args.userId, mediaId, 'webp')
    await supabaseStorage.upload({ path: previewPath, file: preview, contentType: 'image/webp' })
  }

  const insertRow = {
    id: mediaId, user_id: args.userId,
    place_id: args.placeId ?? null, visit_id: args.visitId ?? null,
    visit_day_id: args.visitDayId ?? null, trip_id: args.tripId ?? null,
    kind: 'video' as const, storage_provider: 'supabase',
    original_path: originalPath,
    preview_path: previewPath ?? null,
    thumbnail_path: thumbnailPath ?? null,
    poster_path: posterPath ?? null,
    width: width || null, height: height || null,
    duration_seconds: durationSeconds || null,
    file_size_bytes: args.file.size, mime_type: args.file.type,
    original_filename: args.file.name,
    has_audio: hasAudio,
    caption: args.caption ?? null,
  }
  const { data, error } = await supabase.from('media').insert(insertRow).select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'media insert failed')
  return dbToMedia(data)
}

// ---- Helpers ----

async function listByQuery(query: any): Promise<MediaWithUrls[]> {
  const { data, error } = await query.is('deleted_at', null)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return Promise.all((data ?? []).map((r: any) => hydrateUrls(dbToMedia(r))))
}

async function hydrateUrls(m: Media): Promise<MediaWithUrls> {
  const out: MediaWithUrls = { ...m }
  try {
    if (m.thumbnailPath) out.thumbnailUrl = await supabaseStorage.getSignedUrl(m.thumbnailPath, { expiresIn: 3600 })
    if (m.previewPath)   out.previewUrl   = await supabaseStorage.getSignedUrl(m.previewPath,   { expiresIn: 3600 })
    if ((m as any).posterPath) (out as any).posterUrl = await supabaseStorage.getSignedUrl((m as any).posterPath, { expiresIn: 3600 })
    // For video, also hydrate the original (small enough; needed for inline playback)
    if (m.kind === 'video' && m.originalPath) {
      out.originalUrl = await supabaseStorage.getSignedUrl(m.originalPath, { expiresIn: 3600 })
    }
  } catch {}
  return out
}

function dbToMedia(r: any): Media {
  const m: any = {
    id: r.id, userId: r.user_id, placeId: r.place_id, visitId: r.visit_id,
    visitDayId: r.visit_day_id, tripId: r.trip_id, kind: r.kind,
    storageProvider: r.storage_provider, originalPath: r.original_path,
    previewPath: r.preview_path, thumbnailPath: r.thumbnail_path,
    posterPath: r.poster_path,
    width: r.width, height: r.height, durationSeconds: r.duration_seconds,
    fileSizeBytes: r.file_size_bytes, mimeType: r.mime_type,
    originalFilename: r.original_filename, takenAt: r.taken_at,
    capturedLat: r.captured_lat, capturedLng: r.captured_lng,
    caption: r.caption, altText: r.alt_text,
    perceptualHash: r.perceptual_hash, contentHash: r.content_hash,
    hasAudio: r.has_audio,
    exif: r.exif ?? {}, isCover: r.is_cover ?? false,
    createdAt: r.created_at, deletedAt: r.deleted_at,
  }
  return m as Media
}

// ---- Hashing helpers ----

async function sha256OfBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

async function aHash(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 8; canvas.height = 8
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); resolve(''); return }
      ctx.drawImage(img, 0, 0, 8, 8)
      const data = ctx.getImageData(0, 0, 8, 8).data
      const grays: number[] = []
      for (let i = 0; i < data.length; i += 4) {
        grays.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      }
      const avg = grays.reduce((s, v) => s + v, 0) / grays.length
      const bits = grays.map((v) => (v >= avg ? '1' : '0')).join('')
      let hex = ''
      for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
      URL.revokeObjectURL(url)
      resolve(hex)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
    img.src = url
  })
}
