import { supabase } from '@infra/supabase'
import type { Trip, TravelType } from '@domain/types'

interface CreateTripArgs {
  userId: string
  name: string
  description?: string
  travelType?: TravelType
  startDate?: string
  endDate?: string
  colorTag?: string
}

export const TripsService = {
  async list(userId: string): Promise<Trip[]> {
    const { data, error } = await supabase.from('trips')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map(dbToTrip)
  },

  async get(tripId: string): Promise<Trip | null> {
    const { data, error } = await supabase.from('trips')
      .select('*').eq('id', tripId).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? dbToTrip(data) : null
  },

  async create(args: CreateTripArgs): Promise<Trip> {
    const { data, error } = await supabase.from('trips').insert({
      user_id: args.userId,
      name: args.name,
      description: args.description ?? null,
      travel_type: args.travelType ?? 'leisure',
      start_date: args.startDate ?? null,
      end_date: args.endDate ?? null,
      color_tag: args.colorTag ?? null,
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'trip create failed')
    return dbToTrip(data)
  },

  async update(tripId: string, patch: Partial<Trip>): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.name        !== undefined) dbPatch.name         = patch.name
    if (patch.description !== undefined) dbPatch.description  = patch.description
    if (patch.travelType  !== undefined) dbPatch.travel_type  = patch.travelType
    if (patch.startDate   !== undefined) dbPatch.start_date   = patch.startDate
    if (patch.endDate     !== undefined) dbPatch.end_date     = patch.endDate
    if (patch.colorTag    !== undefined) dbPatch.color_tag    = patch.colorTag
    if (patch.coverMediaId !== undefined) dbPatch.cover_media_id = patch.coverMediaId
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('trips').update(dbPatch).eq('id', tripId)
    if (error) throw error
  },

  async softDelete(tripId: string): Promise<void> {
    const { error } = await supabase.from('trips')
      .update({ deleted_at: new Date().toISOString() }).eq('id', tripId)
    if (error) throw error
  },

  async restore(tripId: string): Promise<void> {
    const { error } = await supabase.from('trips')
      .update({ deleted_at: null }).eq('id', tripId)
    if (error) throw error
  },

  async listDeleted(userId: string): Promise<Trip[]> {
    const { data, error } = await supabase.from('trips')
      .select('*').eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToTrip)
  },
}

export function dbToTrip(r: any): Trip {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    travelType: r.travel_type,
    startDate: r.start_date,
    endDate: r.end_date,
    coverMediaId: r.cover_media_id,
    colorTag: r.color_tag,
    visibility: r.visibility ?? 'private',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }
}
