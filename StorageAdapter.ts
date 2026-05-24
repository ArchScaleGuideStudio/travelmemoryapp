/**
 * Storage adapter interface.
 *
 * Defines the contract for file storage. The Supabase implementation lives in
 * SupabaseStorage.ts. When/if we add Cloudflare R2 or AWS S3 implementations,
 * they implement the same interface — and no calling code changes.
 *
 * Naming convention for paths (enforced via helpers below):
 *   {userId}/originals/{mediaId}.{ext}
 *   {userId}/previews/{mediaId}.webp
 *   {userId}/thumbnails/{mediaId}.webp
 *   {userId}/covers/{placeId}.webp
 *   {userId}/exports/{exportJobId}.zip
 */

export type StoragePathKind = 'original' | 'preview' | 'thumbnail' | 'cover' | 'export'

export interface UploadParams {
  path: string                  // full path within the bucket
  file: Blob | File
  contentType?: string
  upsert?: boolean
}

export interface SignedUrlOptions {
  expiresIn?: number            // seconds, default 3600
  transform?: { width?: number; height?: number; quality?: number }
}

export interface StorageAdapter {
  upload(params: UploadParams): Promise<{ path: string }>
  remove(paths: string[]): Promise<void>
  getSignedUrl(path: string, opts?: SignedUrlOptions): Promise<string>
  getPublicUrl(path: string): string
  exists(path: string): Promise<boolean>
}

// ---- Path builders ----

export function buildStoragePath(
  kind: StoragePathKind,
  userId: string,
  id: string,
  ext: string,
): string {
  const folders: Record<StoragePathKind, string> = {
    original:   'originals',
    preview:    'previews',
    thumbnail:  'thumbnails',
    cover:      'covers',
    export:     'exports',
  }
  return `${userId}/${folders[kind]}/${id}.${ext.replace(/^\./, '')}`
}

/**
 * Pull the user_id out of a storage path. Storage RLS depends on this being
 * the first segment, so we provide one canonical extractor.
 */
export function userIdFromStoragePath(path: string): string | null {
  const segments = path.split('/')
  return segments[0] ?? null
}
