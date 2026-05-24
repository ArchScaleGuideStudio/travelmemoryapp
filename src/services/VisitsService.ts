import { supabase } from '@infra/supabase'
import type { Visit } from '@domain/types'
import { dbToTrip } from './TripsService'
import { dbToPlace } from './PlacesService'

interface CreateVisitArgs {
  userId: string
  tripId: string
  placeId: string
  arrivalDate: string
  departureDate?: string
  orderInTrip?: number
  summaryNotes?: string
}

export const VisitsService = {
  async listForPlace(placeId: string): Promise<Visit[]> {
    const { data, error } = await supabase.from('visits')
      .select(`*, trip:trips(*)`)
      .eq('place_id', placeId)
      .is('deleted_at', null)
      .order('arrival_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToVisit)
  },

  async listForTrip(tripId: string): Promise<Visit[]> {
    const { data, error } = await supabase.from('visits')
      .select(`*, place:places(*, city:cities(*, country:countries(*)))`)
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('order_in_trip')
    if (error) throw error
    return (data ?? []).map((r: any) => {
      const visit = dbToVisit(r)
      if (r.place) visit.place = dbToPlace(r.place)
      return visit
    })
  },

  async get(visitId: string): Promise<Visit | null> {
    const { data, error } = await supabase.from('visits')
      .select(`*, trip:trips(*), place:places(*, city:cities(*, country:countries(*), region:regions(*)))`)
      .eq('id', visitId).is('deleted_at', null).maybeSingle()
    if (error) throw error
    if (!data) return null
    const visit = dbToVisit(data)
    if (data.trip)  visit.trip  = dbToTrip(data.trip)
    if (data.place) visit.place = dbToPlace(data.place)
    return visit
  },

  async create(args: CreateVisitArgs): Promise<Visit> {
    const { data, error } = await supabase.from('visits').insert({
      user_id: args.userId,
      trip_id: args.tripId,
      place_id: args.placeId,
      arrival_date: args.arrivalDate,
      departure_date: args.departureDate ?? null,
      order_in_trip: args.orderInTrip ?? 0,
      summary_notes: args.summaryNotes ?? null,
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'visit create failed')
    return dbToVisit(data)
  },

  async update(visitId: string, patch: Partial<Visit>): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.arrivalDate   !== undefined) dbPatch.arrival_date   = patch.arrivalDate
    if (patch.departureDate !== undefined) dbPatch.departure_date = patch.departureDate
    if (patch.summaryNotes  !== undefined) dbPatch.summary_notes  = patch.summaryNotes
    if (patch.orderInTrip   !== undefined) dbPatch.order_in_trip  = patch.orderInTrip
    if (patch.coverMediaId  !== undefined) dbPatch.cover_media_id = patch.coverMediaId
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('visits').update(dbPatch).eq('id', visitId)
    if (error) throw error
  },

  async softDelete(visitId: string): Promise<void> {
    const { error } = await supabase.from('visits')
      .update({ deleted_at: new Date().toISOString() }).eq('id', visitId)
    if (error) throw error
  },

  async restore(visitId: string): Promise<void> {
    const { error } = await supabase.from('visits')
      .update({ deleted_at: null }).eq('id', visitId)
    if (error) throw error
  },
}

export function dbToVisit(r: any): Visit {
  return {
    id: r.id,
    userId: r.user_id,
    tripId: r.trip_id,
    placeId: r.place_id,
    arrivalDate: r.arrival_date,
    departureDate: r.departure_date,
    orderInTrip: r.order_in_trip ?? 0,
    summaryNotes: r.summary_notes,
    coverMediaId: r.cover_media_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }
}
