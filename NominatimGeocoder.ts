import { geocodingResultSchema } from '@domain/validators'
import type { GeocodingResult } from '@domain/types'
import type { GeocoderAdapter } from './GeocoderAdapter'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = import.meta.env.VITE_NOMINATIM_USER_AGENT ?? 'atlas-travel-app/0.1'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    region?: string
    country?: string
    country_code?: string
  }
}

/**
 * Free geocoder using OpenStreetMap's Nominatim service.
 *
 * IMPORTANT: Nominatim's usage policy requires:
 *   - A unique User-Agent identifying your application
 *   - No more than 1 request per second
 *   - Caching results client-side / on your server when possible
 *
 * For production scale, replace with Mapbox or Google by adding another
 * implementation of GeocoderAdapter. Calling code doesn't change.
 */
export const nominatimGeocoder: GeocoderAdapter = {
  async search(query, { limit = 5, languageCode = 'en' } = {}) {
    const url = new URL(`${NOMINATIM_BASE}/search`)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('accept-language', languageCode)

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) throw new Error(`Nominatim error ${res.status}`)
    const data = await res.json() as NominatimResult[]

    return data
      .map(parseResult)
      .filter((r): r is GeocodingResult => r !== null)
  },

  async reverse(lat, lng) {
    const url = new URL(`${NOMINATIM_BASE}/reverse`)
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) return null
    const data = await res.json() as NominatimResult
    return parseResult(data)
  },
}

function parseResult(raw: NominatimResult): GeocodingResult | null {
  const city = raw.address?.city
    ?? raw.address?.town
    ?? raw.address?.village
    ?? raw.address?.municipality

  const candidate = {
    displayName: raw.display_name,
    city,
    region: raw.address?.state ?? raw.address?.region,
    country: raw.address?.country ?? '',
    countryCode: (raw.address?.country_code ?? '').toUpperCase(),
    lat: parseFloat(raw.lat),
    lng: parseFloat(raw.lon),
    externalId: `osm:${raw.place_id}`,
    source: 'nominatim' as const,
  }

  const parsed = geocodingResultSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
