import type { GeocodingResult } from '@domain/types'

export interface GeocoderAdapter {
  /** Forward geocoding: text → places. */
  search(query: string, opts?: { limit?: number; languageCode?: string }): Promise<GeocodingResult[]>
  /** Reverse: lat/lng → place. */
  reverse(lat: number, lng: number): Promise<GeocodingResult | null>
}
