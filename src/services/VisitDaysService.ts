import { supabase } from '@infra/supabase'
import { uuid } from '@lib/id'
import type { VisitDay, JournalItem } from '@domain/types'

interface CreateVisitDayArgs {
  userId: string
  visitId: string
  dayNumber: number
  date: string
  title?: string
  bodyMarkdown?: string
}

export const VisitDaysService = {
  async listForVisit(visitId: string): Promise<VisitDay[]> {
    const { data, error } = await supabase.from('visit_days')
      .select('*')
      .eq('visit_id', visitId)
      .is('deleted_at', null)
      .order('day_number')
    if (error) throw error
    return (data ?? []).map(dbToVisitDay)
  },

  async get(id: string): Promise<VisitDay | null> {
    const { data, error } = await supabase.from('visit_days')
      .select('*').eq('id', id).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? dbToVisitDay(data) : null
  },

  async create(args: CreateVisitDayArgs): Promise<VisitDay> {
    const { data, error } = await supabase.from('visit_days').insert({
      user_id: args.userId,
      visit_id: args.visitId,
      day_number: args.dayNumber,
      date: args.date,
      title: args.title ?? null,
      body_markdown: args.bodyMarkdown ?? null,
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'visit day create failed')
    return dbToVisitDay(data)
  },

  async upsertDay(args: CreateVisitDayArgs): Promise<VisitDay> {
    const existing = await supabase.from('visit_days')
      .select('id')
      .eq('visit_id', args.visitId)
      .eq('day_number', args.dayNumber)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing.data?.id) {
      await this.update(existing.data.id, {
        date: args.date, title: args.title, bodyMarkdown: args.bodyMarkdown,
      })
      const row = await this.get(existing.data.id)
      if (!row) throw new Error('row vanished')
      return row
    }
    return this.create(args)
  },

  async update(id: string, patch: Partial<VisitDay>): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.date           !== undefined) dbPatch.date            = patch.date
    if (patch.title          !== undefined) dbPatch.title           = patch.title
    if (patch.bodyMarkdown   !== undefined) dbPatch.body_markdown   = patch.bodyMarkdown
    if (patch.weather        !== undefined) dbPatch.weather         = patch.weather
    if (patch.temperatureC   !== undefined) dbPatch.temperature_c   = patch.temperatureC
    if (patch.mood           !== undefined) dbPatch.mood            = patch.mood
    if (patch.companions     !== undefined) dbPatch.companions      = patch.companions
    if (patch.expensesInr    !== undefined) dbPatch.expenses_inr    = patch.expensesInr
    if (patch.isPublishable  !== undefined) dbPatch.is_publishable  = patch.isPublishable
    if (patch.publicSummary  !== undefined) dbPatch.public_summary  = patch.publicSummary
    if (patch.keyMemories    !== undefined) dbPatch.key_memories    = patch.keyMemories
    if (patch.keyPoints      !== undefined) dbPatch.key_points      = patch.keyPoints
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('visit_days').update(dbPatch).eq('id', id)
    if (error) throw error
  },

  // ---- Convenience methods for the journal sections ----

  /** Append an item to either key_memories or key_points. */
  async addItem(dayId: string, list: 'keyMemories' | 'keyPoints', text: string, coords?: { lat: number; lng: number }): Promise<JournalItem> {
    const day = await this.get(dayId)
    if (!day) throw new Error('day not found')
    const item: JournalItem = {
      id: uuid(),
      text,
      createdAt: new Date().toISOString(),
      ...(coords ?? {}),
    }
    const next = [...(day[list] ?? []), item]
    await this.update(dayId, { [list]: next } as Partial<VisitDay>)
    return item
  },

  async removeItem(dayId: string, list: 'keyMemories' | 'keyPoints', itemId: string): Promise<void> {
    const day = await this.get(dayId)
    if (!day) return
    const next = (day[list] ?? []).filter((i: JournalItem) => i.id !== itemId)
    await this.update(dayId, { [list]: next } as Partial<VisitDay>)
  },

  async updateItem(dayId: string, list: 'keyMemories' | 'keyPoints', itemId: string, text: string): Promise<void> {
    const day = await this.get(dayId)
    if (!day) return
    const next = (day[list] ?? []).map((i: JournalItem) => i.id === itemId ? { ...i, text } : i)
    await this.update(dayId, { [list]: next } as Partial<VisitDay>)
  },

  /** Reorder items by passing the new full ordered list of IDs. */
  async reorderItems(dayId: string, list: 'keyMemories' | 'keyPoints', orderedIds: string[]): Promise<void> {
    const day = await this.get(dayId)
    if (!day) return
    const byId = new Map((day[list] ?? []).map((i: JournalItem) => [i.id, i]))
    const next = orderedIds.map(id => byId.get(id)).filter(Boolean) as JournalItem[]
    await this.update(dayId, { [list]: next } as Partial<VisitDay>)
  },

  async togglePublishable(dayId: string, isPublishable: boolean): Promise<void> {
    await this.update(dayId, { isPublishable })
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from('visit_days')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },

  async listPublishableForUser(userId: string): Promise<VisitDay[]> {
    const { data, error } = await supabase.from('visit_days')
      .select('*')
      .eq('user_id', userId)
      .eq('is_publishable', true)
      .is('deleted_at', null)
      .order('date', { ascending: false })
    if (error) throw error
    return (data ?? []).map(dbToVisitDay)
  },
}

export function dbToVisitDay(r: any): VisitDay {
  return {
    id: r.id,
    userId: r.user_id,
    visitId: r.visit_id,
    dayNumber: r.day_number,
    date: r.date,
    title: r.title,
    bodyMarkdown: r.body_markdown,
    weather: r.weather,
    temperatureC: r.temperature_c,
    mood: r.mood,
    companions: r.companions,
    expensesInr: r.expenses_inr,
    isPublishable: r.is_publishable ?? false,
    publicSummary: r.public_summary,
    keyMemories: r.key_memories ?? [],
    keyPoints: r.key_points ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }
}
