/**
 * Publications service.
 *
 * Manages syndicating public_reviews to external platforms. The platforms supported:
 *
 *   - google_maps  → deep-link to write a review on Google Maps (user-driven)
 *   - app_website  → host a public page at /r/{share_slug} (server-side)
 *   - tripadvisor  → stub — no public API for posting; deep-link only
 *   - medium       → stub — would use Medium API (Phase 7 if desired)
 *
 * Each publication records: platform, payload, response, status, retry info.
 *
 * For app_website specifically, we generate a `review_shares` row with a unique
 * slug so the public URL is stable and easy to share.
 */

import { supabase } from '@infra/supabase'
import { GoogleMapsAdapter } from '@infra/googleMaps'
import type { PublicReview, Place } from '@domain/types'

export type PublicationPlatform = 'google_maps' | 'app_website' | 'tripadvisor' | 'instagram' | 'medium' | 'other'

export interface Publication {
  id: string
  publicReviewId: string
  userId: string
  platform: PublicationPlatform
  externalId?: string
  externalUrl?: string
  status: 'queued' | 'sent' | 'live' | 'failed' | 'removed'
  attemptCount: number
  nextRetryAt?: string
  errorMessage?: string
  payload?: Record<string, unknown>
  response?: Record<string, unknown>
  queuedAt: string
  publishedAt?: string
}

export const PublicationsService = {
  async listForReview(reviewId: string): Promise<Publication[]> {
    const { data, error } = await supabase.from('publications')
      .select('*').eq('public_review_id', reviewId).order('queued_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToPub)
  },

  /**
   * Syndicate to Google Maps via deep-link.
   * If the review has a google_place_id, we open the "write a review" URL
   * which lands the user on Google Maps' review composer. We record a
   * publication with status='sent' so the user can later confirm and mark it 'live'.
   */
  async syndicateToGoogleMaps(review: PublicReview): Promise<{ url: string; publicationId: string }> {
    if (!review.googlePlaceId) {
      throw new Error('Google Place ID required. Add one in the review editor.')
    }
    const url = GoogleMapsAdapter.buildWriteReviewUrl(review.googlePlaceId)
    const { data, error } = await supabase.from('publications').insert({
      public_review_id: review.id,
      user_id: review.userId,
      platform: 'google_maps',
      external_id: review.googlePlaceId,
      external_url: url,
      status: 'sent',     // deep-link launched; we trust the user's flow
      payload: {
        title: review.title,
        body: review.bodyMarkdown,
        rating: review.ratingOverall,
        google_place_id: review.googlePlaceId,
      },
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'publication insert failed')
    await GoogleMapsAdapter.openUrl(url)
    return { url, publicationId: data.id }
  },

  /**
   * Publish to the app's own website by minting a public share slug.
   * Returns the public URL (already absolute).
   */
  async publishToWebsite(review: PublicReview): Promise<{ shareUrl: string; shareSlug: string }> {
    // Generate a slug: lowercase-words-from-title + short-random
    const slug = makeSlug(review.title) + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error } = await supabase.from('review_shares').insert({
      user_id: review.userId,
      public_review_id: review.id,
      share_slug: slug,
      is_active: true,
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'share insert failed')
    const shareUrl = `${window.location.origin}/r/${slug}`
    // Also record a publication entry
    await supabase.from('publications').insert({
      public_review_id: review.id,
      user_id: review.userId,
      platform: 'app_website',
      external_id: slug,
      external_url: shareUrl,
      status: 'live',
    })
    return { shareUrl, shareSlug: slug }
  },

  /**
   * TripAdvisor / Instagram / Medium → stubs.
   * These platforms either don't have a public review API, or have one
   * that requires business-owner OAuth (TripAdvisor for properties only,
   * Medium for the author's own publication). We record the intent and
   * provide the user with a deep-link to the platform's manual flow.
   */
  async syndicateStub(review: PublicReview, platform: PublicationPlatform): Promise<{ url: string }> {
    const url = platformDeepLink(platform, review)
    await supabase.from('publications').insert({
      public_review_id: review.id,
      user_id: review.userId,
      platform,
      external_url: url,
      status: 'sent',
    })
    await GoogleMapsAdapter.openUrl(url)
    return { url }
  },

  async markLive(publicationId: string, externalUrl?: string): Promise<void> {
    const patch: Record<string, unknown> = { status: 'live', published_at: new Date().toISOString() }
    if (externalUrl) patch.external_url = externalUrl
    const { error } = await supabase.from('publications').update(patch).eq('id', publicationId)
    if (error) throw error
  },

  async markFailed(publicationId: string, message: string): Promise<void> {
    const { error } = await supabase.from('publications').update({
      status: 'failed', error_message: message,
    }).eq('id', publicationId)
    if (error) throw error
  },

  /**
   * Find candidate Google Places near a place's coordinates.
   * Returns [] if the Places API is not configured.
   */
  async matchGooglePlace(place: Place): Promise<{ matches: { placeId: string; name: string; address: string }[]; searchUrl: string }> {
    const matches = await GoogleMapsAdapter.findCandidates({
      name: place.city?.name ?? place.customName ?? '',
      lat: place.lat,
      lng: place.lng,
    })
    return {
      matches: matches.map((m) => ({ placeId: m.placeId, name: m.name, address: m.formattedAddress })),
      searchUrl: GoogleMapsAdapter.buildSearchUrl(place),
    }
  },
}

function platformDeepLink(platform: PublicationPlatform, review: PublicReview): string {
  switch (platform) {
    case 'tripadvisor':
      return `https://www.tripadvisor.com/Search?q=${encodeURIComponent(review.title)}`
    case 'instagram':
      // Instagram doesn't accept pre-filled posts via URL; open profile.
      return 'https://www.instagram.com/'
    case 'medium':
      return `https://medium.com/new-story?title=${encodeURIComponent(review.title)}`
    default:
      return 'about:blank'
  }
}

function makeSlug(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function dbToPub(r: any): Publication {
  return {
    id: r.id, publicReviewId: r.public_review_id, userId: r.user_id,
    platform: r.platform, externalId: r.external_id, externalUrl: r.external_url,
    status: r.status, attemptCount: r.attempt_count ?? 0,
    nextRetryAt: r.next_retry_at, errorMessage: r.error_message,
    payload: r.payload, response: r.response,
    queuedAt: r.queued_at, publishedAt: r.published_at,
  }
}
