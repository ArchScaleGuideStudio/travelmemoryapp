/**
 * Google Maps integration.
 *
 * IMPORTANT: Google Maps does NOT offer a public API to programmatically
 * post a review. Review submission requires a real user signed into the
 * Google Maps app/site. The best a third-party app can do is:
 *
 *   1. Help the user find the matching Google Place ID (so the review can be
 *      linked to a specific business/location)
 *   2. Open Google Maps with a pre-filled review prompt via a deep link
 *   3. Track in our `publications` table that the user was sent to Google
 *      Maps with a draft (so we can mark it 'sent' and prompt them to confirm
 *      it went live)
 *
 * This module implements (1) and (2). The "publish" action in the UI calls
 * `openGoogleMapsReview()` which uses the share adapter to launch the URL.
 *
 * For Places API search (forward & autocomplete), this requires a Google Maps
 * Platform API key. Add it to .env as VITE_GOOGLE_MAPS_API_KEY. Without a key,
 * the user can still paste a Place ID manually (the editor already supports this).
 */

import type { Place } from '@domain/types'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

export interface GooglePlaceMatch {
  placeId: string
  name: string
  formattedAddress: string
  lat: number
  lng: number
}

export const GoogleMapsAdapter = {
  isConfigured(): boolean {
    return GOOGLE_KEY.length > 0
  },

  /**
   * Find Google Place candidates near a given lat/lng using the Find Place API.
   * Returns top matches the user can pick from.
   *
   * Without a key, returns []. The user can still paste a Place ID manually.
   */
  async findCandidates(opts: { name: string; lat: number; lng: number }): Promise<GooglePlaceMatch[]> {
    if (!GOOGLE_KEY) return []
    // Note: direct browser calls to the Places API are blocked by CORS. In
    // production, route this through a Supabase Edge Function that has the
    // key server-side. The function path is `/functions/v1/google-place-search`.
    // For Phase 6 we ship the Edge Function scaffold; without it, this returns [].
    try {
      const url = new URL('/functions/v1/google-place-search', import.meta.env.VITE_SUPABASE_URL)
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: opts.name, lat: opts.lat, lng: opts.lng }),
      })
      if (!res.ok) return []
      const data = await res.json() as { matches: GooglePlaceMatch[] }
      return data.matches ?? []
    } catch {
      return []
    }
  },

  /**
   * Build a URL that opens Google Maps at the matching place, with the user
   * able to tap "Write a review". This is the deep-link approach — the only
   * way to bring a user to post a review from a third-party app.
   *
   * Pattern: https://search.google.com/local/writereview?placeid=ChIJ...
   * This URL takes the user directly to the review writing UI when signed in.
   */
  buildWriteReviewUrl(googlePlaceId: string): string {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`
  },

  /** Build a regular Google Maps URL for viewing a place. */
  buildViewUrl(googlePlaceId: string): string {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(googlePlaceId)}`
  },

  /**
   * Build a Google Maps search URL when no Place ID is known yet.
   * Falls back gracefully — the user can find the place and copy the ID.
   */
  buildSearchUrl(place: Place): string {
    const name = place.city?.name ?? place.customName ?? ''
    const country = place.country?.name ?? ''
    const q = `${name} ${country}`.trim()
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
  },

  /**
   * Open Google Maps in a new browser tab (web) or external browser (native).
   * Uses Capacitor Browser plugin on native for a system-native browser experience.
   */
  async openUrl(url: string): Promise<void> {
    const { isNative } = await import('@infra/platform')
    if (isNative()) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url, presentationStyle: 'popover' })
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  },
}
