import { supabase } from '@infra/supabase'

export interface SearchHit {
  type: 'place' | 'trip' | 'visit' | 'media' | 'note'
  id: string
  title: string
  subtitle?: string
  date?: string
  thumbPath?: string
}

export const SearchService = {
  async search(userId: string, query: string): Promise<SearchHit[]> {
    const q = query.trim()
    if (q.length < 2) return []
    const like = `%${q}%`

    const [placesByCity, trips, notes, captions] = await Promise.all([
      supabase
        .from('places')
        .select(`id, custom_name, last_visited_at, cover_media_id, city:cities!inner ( name, country:countries ( name ) )`)
        .eq('user_id', userId).is('deleted_at', null)
        .ilike('cities.name', like).limit(8),
      supabase
        .from('trips')
        .select('id, name, description, start_date')
        .eq('user_id', userId).is('deleted_at', null)
        .or(`name.ilike.${like},description.ilike.${like}`).limit(8),
      supabase
        .from('notes')
        .select('id, title, body_markdown, updated_at, place_id')
        .eq('user_id', userId).is('deleted_at', null)
        .or(`title.ilike.${like},body_markdown.ilike.${like}`).limit(8),
      supabase
        .from('media')
        .select('id, caption, place_id, taken_at, thumbnail_path')
        .eq('user_id', userId).is('deleted_at', null)
        .ilike('caption', like).limit(8),
    ])

    const hits: SearchHit[] = []
    for (const r of placesByCity.data ?? []) {
      const city: any = (r as any).city
      const country = city?.country?.name ?? ''
      hits.push({
        type: 'place', id: r.id,
        title: city?.name ?? r.custom_name ?? 'Place',
        subtitle: country,
        date: r.last_visited_at ?? undefined,
      })
    }
    for (const r of trips.data ?? []) {
      hits.push({
        type: 'trip', id: r.id,
        title: r.name,
        subtitle: r.description ?? undefined,
        date: r.start_date ?? undefined,
      })
    }
    for (const r of notes.data ?? []) {
      hits.push({
        type: 'note', id: r.place_id ?? r.id,    // route to the place that owns this note
        title: r.title ?? excerpt(r.body_markdown, 60),
        subtitle: excerpt(r.body_markdown, 100),
        date: r.updated_at ?? undefined,
      })
    }
    for (const r of captions.data ?? []) {
      hits.push({
        type: 'media', id: r.place_id ?? r.id,
        title: r.caption ?? 'Photo',
        date: r.taken_at ?? undefined,
        thumbPath: r.thumbnail_path ?? undefined,
      })
    }
    return hits
  },
}

function excerpt(s: string | null | undefined, n: number): string {
  if (!s) return ''
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean
}
