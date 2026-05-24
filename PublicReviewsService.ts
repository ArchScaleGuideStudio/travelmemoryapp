import { supabase } from '@infra/supabase'
import type { PublicReview, PublicReviewStatus } from '@domain/types'

interface CreatePublicReviewArgs {
  userId: string
  placeId?: string
  visitId?: string
  title: string
  bodyMarkdown: string
}

export const PublicReviewsService = {
  async list(userId: string, opts: { status?: PublicReviewStatus } = {}): Promise<PublicReview[]> {
    let q = supabase.from('public_reviews')
      .select('*').eq('user_id', userId).is('deleted_at', null)
    if (opts.status) q = q.eq('status', opts.status)
    q = q.order('updated_at', { ascending: false })
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(dbToPublicReview)
  },

  async get(id: string): Promise<PublicReview | null> {
    const { data, error } = await supabase.from('public_reviews')
      .select('*').eq('id', id).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? dbToPublicReview(data) : null
  },

  async create(args: CreatePublicReviewArgs): Promise<PublicReview> {
    const { data, error } = await supabase.from('public_reviews').insert({
      user_id: args.userId,
      place_id: args.placeId ?? null,
      visit_id: args.visitId ?? null,
      title: args.title,
      body_markdown: args.bodyMarkdown,
      status: 'draft',
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'public review create failed')
    return dbToPublicReview(data)
  },

  async update(id: string, patch: Partial<PublicReview>): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.title              !== undefined) dbPatch.title                 = patch.title
    if (patch.bodyMarkdown       !== undefined) dbPatch.body_markdown         = patch.bodyMarkdown
    if (patch.summary            !== undefined) dbPatch.summary               = patch.summary
    if (patch.ratingOverall      !== undefined) dbPatch.rating_overall        = patch.ratingOverall
    if (patch.ratingFood         !== undefined) dbPatch.rating_food           = patch.ratingFood
    if (patch.ratingValue        !== undefined) dbPatch.rating_value          = patch.ratingValue
    if (patch.ratingAtmosphere   !== undefined) dbPatch.rating_atmosphere     = patch.ratingAtmosphere
    if (patch.priceLevel         !== undefined) dbPatch.price_level           = patch.priceLevel
    if (patch.visitPurpose       !== undefined) dbPatch.visit_purpose         = patch.visitPurpose
    if (patch.tags               !== undefined) dbPatch.tags                  = patch.tags
    if (patch.recommendedFor     !== undefined) dbPatch.recommended_for       = patch.recommendedFor
    if (patch.bestTimeToVisit    !== undefined) dbPatch.best_time_to_visit    = patch.bestTimeToVisit
    if (patch.accessibilityNotes !== undefined) dbPatch.accessibility_notes   = patch.accessibilityNotes
    if (patch.openingHours       !== undefined) dbPatch.opening_hours         = patch.openingHours
    if (patch.contact            !== undefined) dbPatch.contact               = patch.contact
    if (patch.heroMediaId        !== undefined) dbPatch.hero_media_id         = patch.heroMediaId
    if (patch.galleryMediaIds    !== undefined) dbPatch.gallery_media_ids     = patch.galleryMediaIds
    if (patch.googlePlaceId      !== undefined) dbPatch.google_place_id       = patch.googlePlaceId
    if (patch.status             !== undefined) dbPatch.status                = patch.status
    if (patch.language           !== undefined) dbPatch.language              = patch.language
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('public_reviews').update(dbPatch).eq('id', id)
    if (error) throw error
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from('public_reviews')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  /** Mark as published and queue a publication record */
  async publish(id: string, platform: string = 'app_website'): Promise<void> {
    const review = await this.get(id)
    if (!review) throw new Error('Review not found')
    const now = new Date().toISOString()
    await supabase.from('public_reviews').update({
      status: 'published', published_at: now,
    }).eq('id', id)
    await supabase.from('publications').insert({
      public_review_id: id,
      user_id: review.userId,
      platform,
      status: 'queued',
    })
  },
}

function dbToPublicReview(r: any): PublicReview {
  return {
    id: r.id,
    userId: r.user_id,
    placeId: r.place_id,
    visitId: r.visit_id,
    title: r.title,
    bodyMarkdown: r.body_markdown,
    summary: r.summary,
    ratingOverall: r.rating_overall,
    ratingFood: r.rating_food,
    ratingValue: r.rating_value,
    ratingAtmosphere: r.rating_atmosphere,
    priceLevel: r.price_level,
    visitPurpose: r.visit_purpose,
    tags: r.tags,
    recommendedFor: r.recommended_for,
    bestTimeToVisit: r.best_time_to_visit,
    accessibilityNotes: r.accessibility_notes,
    openingHours: r.opening_hours,
    contact: r.contact,
    heroMediaId: r.hero_media_id,
    galleryMediaIds: r.gallery_media_ids,
    googlePlaceId: r.google_place_id,
    osmPlaceId: r.osm_place_id,
    status: r.status,
    language: r.language ?? 'en',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
    deletedAt: r.deleted_at,
  }
}
