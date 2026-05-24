import { supabase } from '../supabase'
import type { StorageAdapter, UploadParams, SignedUrlOptions } from './StorageAdapter'

const BUCKET = 'travel-media'

export const supabaseStorage: StorageAdapter = {
  async upload({ path, file, contentType, upsert = false }: UploadParams) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: contentType ?? file.type,
        upsert,
        cacheControl: '31536000',
      })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    return { path }
  },

  async remove(paths: string[]) {
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) throw new Error(`Remove failed: ${error.message}`)
  },

  async getSignedUrl(path: string, opts: SignedUrlOptions = {}) {
    const expiresIn = opts.expiresIn ?? 3600
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn, opts.transform ? { transform: opts.transform } : undefined)
    if (error) throw new Error(`Signed URL failed: ${error.message}`)
    if (!data?.signedUrl) throw new Error('No signed URL returned')
    return data.signedUrl
  },

  getPublicUrl(path: string) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  },

  async exists(path: string) {
    const folder = path.substring(0, path.lastIndexOf('/'))
    const filename = path.substring(path.lastIndexOf('/') + 1)
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
      limit: 1,
      search: filename,
    })
    if (error) return false
    return (data?.length ?? 0) > 0
  },
}
