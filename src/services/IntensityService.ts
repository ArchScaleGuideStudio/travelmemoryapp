import { supabase } from '@infra/supabase'
import type { CountryVisitIntensity } from '@domain/types'

export const IntensityService = {
  /**
   * Computes country visit intensity for the user.
   * Joins places → cities → countries and counts distinct cities per country.
   */
  async forUser(userId: string): Promise<CountryVisitIntensity[]> {
    const { data, error } = await supabase
      .from('places')
      .select(`
        city:cities (
          id,
          country:countries ( id, name, iso_a2 )
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (error) throw error

    const byCountry = new Map<string, { name: string; isoA2: string; cities: Set<string>; visits: number }>()
    for (const row of data ?? []) {
      const city: any = (row as any).city
      const country: any = city?.country
      if (!country) continue
      const cur = byCountry.get(country.id) ?? { name: country.name, isoA2: country.iso_a2, cities: new Set(), visits: 0 }
      cur.cities.add(city.id)
      cur.visits += 1
      byCountry.set(country.id, cur)
    }

    return Array.from(byCountry.entries()).map(([countryId, v]) => ({
      countryId,
      countryName: v.name,
      isoA2: v.isoA2,
      uniqueCitiesVisited: v.cities.size,
      totalVisits: v.visits,
    }))
  },
}
