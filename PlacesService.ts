import { supabase } from '@infra/supabase'
import type { Place, City, Country, Region } from '@domain/types'

interface CreatePlaceArgs {
  userId: string
  cityId?: string
  customName?: string
  lat: number
  lng: number
  locality?: string
}

export const PlacesService = {
  async list(userId: string, opts: { favouritesFirst?: boolean } = {}): Promise<Place[]> {
    let q = supabase.from('places')
      .select(`
        *,
        city:cities(id, region_id, country_id, name, lat, lng),
        country:cities(country_id)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
    if (opts.favouritesFirst) q = q.order('is_favourite', { ascending: false })
    q = q.order('last_visited_at', { ascending: false, nullsFirst: false })
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(dbToPlace)
  },

  async listWithHydrated(userId: string): Promise<Place[]> {
    // Get places with city → region → country joined
    const { data, error } = await supabase.from('places')
      .select(`
        *,
        city:cities (
          *,
          region:regions ( * ),
          country:countries ( * )
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('last_visited_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map((r: any) => {
      const place = dbToPlace(r)
      if (r.city) {
        place.city = { id: r.city.id, name: r.city.name, lat: r.city.lat, lng: r.city.lng, countryId: r.city.country_id, regionId: r.city.region_id, population: r.city.population, externalIds: r.city.external_ids } as City
        if (r.city.country) place.country = { id: r.city.country.id, continentId: r.city.country.continent_id, name: r.city.country.name, isoA2: r.city.country.iso_a2, isoA3: r.city.country.iso_a3, defaultLat: r.city.country.default_lat, defaultLng: r.city.country.default_lng } as Country
        if (r.city.region)  place.region  = { id: r.city.region.id, countryId: r.city.region.country_id, name: r.city.region.name, regionType: r.city.region.region_type } as Region
      }
      return place
    })
  },

  async get(placeId: string): Promise<Place | null> {
    const { data, error } = await supabase.from('places')
      .select(`
        *,
        city:cities (
          *,
          region:regions ( * ),
          country:countries ( * )
        )
      `)
      .eq('id', placeId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const place = dbToPlace(data)
    if (data.city) {
      place.city = data.city
      if (data.city.country) place.country = { id: data.city.country.id, continentId: data.city.country.continent_id, name: data.city.country.name, isoA2: data.city.country.iso_a2, isoA3: data.city.country.iso_a3 } as Country
      if (data.city.region)  place.region  = { id: data.city.region.id, countryId: data.city.region.country_id, name: data.city.region.name } as Region
    }
    return place
  },

  async create(args: CreatePlaceArgs): Promise<Place> {
    const { data, error } = await supabase.from('places').insert({
      user_id: args.userId,
      city_id: args.cityId ?? null,
      custom_name: args.customName ?? null,
      lat: args.lat,
      lng: args.lng,
      locality: args.locality ?? null,
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'place create failed')
    return dbToPlace(data)
  },

  async update(placeId: string, patch: Partial<Place>): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.notesSummary  !== undefined) dbPatch.notes_summary    = patch.notesSummary
    if (patch.coverMediaId  !== undefined) dbPatch.cover_media_id   = patch.coverMediaId
    if (patch.isFavourite   !== undefined) dbPatch.is_favourite     = patch.isFavourite
    if (patch.visibility    !== undefined) dbPatch.visibility       = patch.visibility
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('places').update(dbPatch).eq('id', placeId)
    if (error) throw error
  },

  /** Soft delete — sets deleted_at, restorable from Recently Deleted */
  async softDelete(placeId: string): Promise<void> {
    const { error } = await supabase.from('places')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', placeId)
    if (error) throw error
  },

  async restore(placeId: string): Promise<void> {
    const { error } = await supabase.from('places')
      .update({ deleted_at: null })
      .eq('id', placeId)
    if (error) throw error
  },

  async listDeleted(userId: string): Promise<Place[]> {
    const { data, error } = await supabase.from('places')
      .select(`*, city:cities ( name )`)
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToPlace)
  },
}

export function dbToPlace(r: any): Place {
  const place: Place = {
    id: r.id,
    userId: r.user_id,
    cityId: r.city_id,
    customName: r.custom_name,
    lat: r.lat,
    lng: r.lng,
    locality: r.locality,
    coverMediaId: r.cover_media_id,
    visitCount: r.visit_count ?? 0,
    firstVisitedAt: r.first_visited_at,
    lastVisitedAt: r.last_visited_at,
    notesSummary: r.notes_summary,
    visibility: r.visibility ?? 'private',
    isFavourite: r.is_favourite ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }
  if (r.city && typeof r.city === 'object' && 'name' in r.city) {
    place.city = r.city as City
  }
  return place
}
