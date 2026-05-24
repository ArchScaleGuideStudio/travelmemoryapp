import { supabase } from '@infra/supabase'

export interface Slideshow {
  id: string
  userId: string
  name: string
  sourceType?: 'place' | 'trip' | 'visit' | 'album' | 'custom'
  sourceId?: string
  durationPerSlideMs: number
  transitionType: string
  createdAt: string
  updatedAt: string
}

export const SlideshowsService = {
  async list(userId: string): Promise<Slideshow[]> {
    const { data, error } = await supabase.from('slideshows')
      .select('*').eq('user_id', userId).is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToSlideshow)
  },

  async create(args: { userId: string; name: string; sourceType?: Slideshow['sourceType']; sourceId?: string }): Promise<Slideshow> {
    const { data, error } = await supabase.from('slideshows').insert({
      user_id: args.userId,
      name: args.name,
      source_type: args.sourceType ?? 'custom',
      source_id: args.sourceId ?? null,
      duration_per_slide_ms: 4000,
      transition_type: 'fade',
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'slideshow create failed')
    return dbToSlideshow(data)
  },

  async addItems(slideshowId: string, userId: string, mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) return
    const rows = mediaIds.map((mediaId, idx) => ({
      slideshow_id: slideshowId,
      media_id: mediaId,
      user_id: userId,
      order_index: idx,
    }))
    const { error } = await supabase.from('slideshow_items').insert(rows)
    if (error) throw error
  },
}

function dbToSlideshow(r: any): Slideshow {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    sourceType: r.source_type,
    sourceId: r.source_id,
    durationPerSlideMs: r.duration_per_slide_ms,
    transitionType: r.transition_type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
