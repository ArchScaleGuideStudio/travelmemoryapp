import { supabase } from '@infra/supabase'

export interface RecoveryItem {
  id: string
  type: 'place' | 'trip' | 'visit' | 'note' | 'media' | 'album'
  label: string
  deletedAt: string
  // Days remaining before hard delete (30-day retention)
  daysLeft: number
}

const RETENTION_DAYS = 30

export const RecoveryService = {
  async listAll(userId: string): Promise<RecoveryItem[]> {
    const [places, trips, visits, notes, media, albums] = await Promise.all([
      supabase.from('places').select('id, custom_name, deleted_at, city:cities(name)')
        .eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('trips').select('id, name, deleted_at')
        .eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('visits').select('id, arrival_date, deleted_at')
        .eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('notes').select('id, title, deleted_at')
        .eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('media').select('id, original_filename, deleted_at')
        .eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('albums').select('id, name, deleted_at')
        .eq('user_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])

    const items: RecoveryItem[] = []

    for (const r of places.data ?? []) {
      const cityRel: any = r.city
      items.push(makeItem('place', r.id, cityRel?.name ?? r.custom_name ?? 'Unnamed place', r.deleted_at))
    }
    for (const r of trips.data ?? []) {
      items.push(makeItem('trip', r.id, r.name ?? 'Untitled trip', r.deleted_at))
    }
    for (const r of visits.data ?? []) {
      items.push(makeItem('visit', r.id, `Visit on ${r.arrival_date}`, r.deleted_at))
    }
    for (const r of notes.data ?? []) {
      items.push(makeItem('note', r.id, r.title ?? 'Untitled note', r.deleted_at))
    }
    for (const r of media.data ?? []) {
      items.push(makeItem('media', r.id, r.original_filename ?? 'Photo', r.deleted_at))
    }
    for (const r of albums.data ?? []) {
      items.push(makeItem('album', r.id, r.name ?? 'Album', r.deleted_at))
    }

    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  },

  async restore(type: RecoveryItem['type'], id: string): Promise<void> {
    const table = ({
      place: 'places', trip: 'trips', visit: 'visits',
      note: 'notes', media: 'media', album: 'albums',
    } as const)[type]
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq('id', id)
    if (error) throw error
  },

  async deletePermanently(type: RecoveryItem['type'], id: string): Promise<void> {
    const table = ({
      place: 'places', trip: 'trips', visit: 'visits',
      note: 'notes', media: 'media', album: 'albums',
    } as const)[type]
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },
}

function makeItem(type: RecoveryItem['type'], id: string, label: string, deletedAt: string): RecoveryItem {
  const deleted = new Date(deletedAt).getTime()
  const elapsed = (Date.now() - deleted) / 86400000
  return { id, type, label, deletedAt, daysLeft: Math.max(0, Math.ceil(RETENTION_DAYS - elapsed)) }
}
