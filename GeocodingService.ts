import { supabase } from '@infra/supabase'
import { nominatimGeocoder } from '@infra/geocoder/NominatimGeocoder'
import type { GeocodingResult, City, Country, Region } from '@domain/types'

/**
 * Higher-level geocoding: search the world, and when a user picks a result,
 * find-or-create the matching city/region/country rows so we have stable
 * foreign keys for a place.
 */
export const GeocodingService = {
  async search(query: string): Promise<GeocodingResult[]> {
    if (query.trim().length < 2) return []
    return nominatimGeocoder.search(query, { limit: 6 })
  },

  async reverse(lat: number, lng: number): Promise<GeocodingResult | null> {
    return nominatimGeocoder.reverse(lat, lng)
  },

  /**
   * Resolve a geocoding result to durable database rows.
   * Idempotent — calling it twice with the same input returns the same IDs.
   */
  async resolveToCity(result: GeocodingResult): Promise<{
    country: Country
    region: Region | null
    city: City
  }> {
    const country = await findOrCreateCountry(result.countryCode, result.country)
    const region  = result.region ? await findOrCreateRegion(country.id, result.region) : null

    const cityName = result.city ?? (result.displayName.split(',')[0] ?? '').trim()
    // Try to find existing city by external ID first, then by name within country
    const existing = await findExistingCity(country.id, result.externalId, cityName)
    if (existing) return { country, region, city: existing }

    const insert = await supabase.from('cities').insert({
      region_id: region?.id ?? null,
      country_id: country.id,
      name: cityName,
      lat: result.lat,
      lng: result.lng,
      external_ids: { [result.source]: result.externalId },
    }).select('*').single()

    if (insert.error || !insert.data) throw new Error(`Failed to add city: ${insert.error?.message}`)
    return { country, region, city: dbToCity(insert.data) }
  },
}

async function findOrCreateCountry(iso: string, name: string): Promise<Country> {
  const existing = await supabase.from('countries').select('*').eq('iso_a2', iso).maybeSingle()
  if (existing.data) return dbToCountry(existing.data)
  // Default to continent 'other' — for Phase 1, just attach to first continent if missing.
  // In practice the country should exist from seed.sql; if not, we keep it minimal.
  const continents = await supabase.from('continents').select('id').limit(1)
  const continentId = continents.data?.[0]?.id
  if (!continentId) throw new Error('No continents seeded')
  const ins = await supabase.from('countries').insert({
    continent_id: continentId,
    name,
    iso_a2: iso,
    iso_a3: null,
  }).select('*').single()
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? 'country create failed')
  return dbToCountry(ins.data)
}

async function findOrCreateRegion(countryId: string, name: string): Promise<Region> {
  const existing = await supabase.from('regions')
    .select('*').eq('country_id', countryId).ilike('name', name).maybeSingle()
  if (existing.data) return dbToRegion(existing.data)
  const ins = await supabase.from('regions').insert({
    country_id: countryId, name, region_type: 'state',
  }).select('*').single()
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? 'region create failed')
  return dbToRegion(ins.data)
}

async function findExistingCity(countryId: string, externalId: string, name: string): Promise<City | null> {
  const byExt = await supabase.from('cities')
    .select('*').eq('country_id', countryId)
    .contains('external_ids', { nominatim: externalId.replace('osm:', '') })
    .maybeSingle()
  if (byExt.data) return dbToCity(byExt.data)
  const byName = await supabase.from('cities')
    .select('*').eq('country_id', countryId).ilike('name', name).limit(1).maybeSingle()
  if (byName.data) return dbToCity(byName.data)
  return null
}

// DB → domain mappers (snake_case → camelCase)
function dbToCountry(r: any): Country {
  return { id: r.id, continentId: r.continent_id, name: r.name, isoA2: r.iso_a2, isoA3: r.iso_a3, defaultLat: r.default_lat, defaultLng: r.default_lng, altNames: r.alt_names }
}
function dbToRegion(r: any): Region {
  return { id: r.id, countryId: r.country_id, name: r.name, regionType: r.region_type, defaultLat: r.default_lat, defaultLng: r.default_lng }
}
function dbToCity(r: any): City {
  return { id: r.id, regionId: r.region_id, countryId: r.country_id, name: r.name, lat: r.lat, lng: r.lng, population: r.population, externalIds: r.external_ids }
}
