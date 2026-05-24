import { supabase } from '@infra/supabase'
import type { Album } from '@domain/types'

export const AlbumsService = {
  async list(userId: string): Promise<Album[]> {
    const { data, error } = await supabase.from('albums')
      .select('*').eq('user_id', userId).is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToAlbum)
  },

  async get(albumId: string): Promise<Album | null> {
    const { data, error } = await supabase.from('albums')
      .select('*').eq('id', albumId).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? dbToAlbum(data) : null
  },

  async create(args: { userId: string; name: string; description?: string }): Promise<Album> {
    const { data, error } = await supabase.from('albums').insert({
      user_id: args.userId, name: args.name, description: args.description ?? null,
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'album create failed')
    return dbToAlbum(data)
  },

  async update(albumId: string, patch: Partial<Album>): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.name        !== undefined) dbPatch.name           = patch.name
    if (patch.description !== undefined) dbPatch.description    = patch.description
    if (patch.coverMediaId !== undefined) dbPatch.cover_media_id = patch.coverMediaId
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('albums').update(dbPatch).eq('id', albumId)
    if (error) throw error
  },

  async softDelete(albumId: string): Promise<void> {
    const { error } = await supabase.from('albums')
      .update({ deleted_at: new Date().toISOString() }).eq('id', albumId)
    if (error) throw error
  },

  async addMedia(args: { albumId: string; userId: string; mediaIds: string[] }): Promise<void> {
    if (args.mediaIds.length === 0) return
    // get current max order_index
    const { data: existing } = await supabase.from('album_media')
      .select('order_index').eq('album_id', args.albumId)
      .order('order_index', { ascending: false }).limit(1)
    const startOrder = (existing?.[0]?.order_index ?? -1) + 1
    const rows = args.mediaIds.map((mediaId, i) => ({
      album_id: args.albumId, media_id: mediaId, user_id: args.userId,
      order_index: startOrder + i,
    }))
    const { error } = await supabase.from('album_media').insert(rows)
    if (error) throw error
  },

  async listMedia(albumId: string): Promise<string[]> {
    const { data, error } = await supabase.from('album_media')
      .select('media_id, order_index').eq('album_id', albumId).order('order_index')
    if (error) throw error
    return (data ?? []).map((r: any) => r.media_id)
  },

  async removeMedia(albumId: string, mediaId: string): Promise<void> {
    const { error } = await supabase.from('album_media').delete()
      .eq('album_id', albumId).eq('media_id', mediaId)
    if (error) throw error
  },
}

function dbToAlbum(r: any): Album {
  return {
    id: r.id, userId: r.user_id, name: r.name, description: r.description,
    coverMediaId: r.cover_media_id, createdAt: r.created_at,
    updatedAt: r.updated_at, deletedAt: r.deleted_at,
  }
}
