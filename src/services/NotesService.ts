import { supabase } from '@infra/supabase'
import type { Note } from '@domain/types'

interface NoteScope {
  placeId?: string
  tripId?: string
  visitId?: string
}

interface CreateNoteArgs extends NoteScope {
  userId: string
  title?: string
  bodyMarkdown?: string
}

const MAX_VERSIONS_PER_NOTE = 20

export const NotesService = {
  async listForPlace(placeId: string): Promise<Note[]> {
    return list(supabase.from('notes').select('*').eq('place_id', placeId))
  },
  async listForTrip(tripId: string): Promise<Note[]> {
    return list(supabase.from('notes').select('*').eq('trip_id', tripId))
  },
  async listForVisit(visitId: string): Promise<Note[]> {
    return list(supabase.from('notes').select('*').eq('visit_id', visitId))
  },

  async get(noteId: string): Promise<Note | null> {
    const { data, error } = await supabase.from('notes')
      .select('*').eq('id', noteId).is('deleted_at', null).maybeSingle()
    if (error) throw error
    return data ? dbToNote(data) : null
  },

  async create(args: CreateNoteArgs): Promise<Note> {
    const { data, error } = await supabase.from('notes').insert({
      user_id: args.userId,
      place_id: args.placeId ?? null,
      trip_id:  args.tripId  ?? null,
      visit_id: args.visitId ?? null,
      title: args.title ?? null,
      body_markdown: args.bodyMarkdown ?? '',
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'note create failed')
    return dbToNote(data)
  },

  async update(noteId: string, patch: { title?: string; bodyMarkdown?: string }, opts: { recordVersion?: boolean } = {}): Promise<void> {
    // Append previous body to note_versions BEFORE updating
    if (opts.recordVersion !== false && patch.bodyMarkdown !== undefined) {
      const cur = await supabase.from('notes').select('body_markdown, user_id').eq('id', noteId).single()
      if (cur.data && cur.data.body_markdown !== patch.bodyMarkdown) {
        const versionsCount = await supabase.from('note_versions')
          .select('id', { count: 'exact', head: true }).eq('note_id', noteId)
        const next = (versionsCount.count ?? 0) + 1
        await supabase.from('note_versions').insert({
          note_id: noteId,
          body_markdown: cur.data.body_markdown ?? '',
          version_number: next,
          saved_by: cur.data.user_id,
        })
        // Cap versions: delete oldest beyond MAX
        if (next > MAX_VERSIONS_PER_NOTE) {
          const oldest = await supabase.from('note_versions')
            .select('id').eq('note_id', noteId)
            .order('version_number', { ascending: true })
            .limit(next - MAX_VERSIONS_PER_NOTE)
          if (oldest.data) {
            const ids = oldest.data.map((r: { id: string }) => r.id)
            if (ids.length) await supabase.from('note_versions').delete().in('id', ids)
          }
        }
      }
    }
    const dbPatch: Record<string, unknown> = {}
    if (patch.title        !== undefined) dbPatch.title         = patch.title
    if (patch.bodyMarkdown !== undefined) dbPatch.body_markdown = patch.bodyMarkdown
    if (Object.keys(dbPatch).length === 0) return
    const { error } = await supabase.from('notes').update(dbPatch).eq('id', noteId)
    if (error) throw error
  },

  async softDelete(noteId: string): Promise<void> {
    const { error } = await supabase.from('notes')
      .update({ deleted_at: new Date().toISOString() }).eq('id', noteId)
    if (error) throw error
  },

  async listVersions(noteId: string): Promise<{ versionNumber: number; bodyMarkdown: string; savedAt: string }[]> {
    const { data, error } = await supabase.from('note_versions')
      .select('*').eq('note_id', noteId).order('version_number', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      versionNumber: r.version_number,
      bodyMarkdown: r.body_markdown,
      savedAt: r.saved_at,
    }))
  },

  /** Restore a prior version. Saves current as a new version first. */
  async restoreVersion(noteId: string, versionNumber: number): Promise<void> {
    const ver = await supabase.from('note_versions')
      .select('body_markdown').eq('note_id', noteId).eq('version_number', versionNumber).single()
    if (!ver.data) throw new Error('Version not found')
    await this.update(noteId, { bodyMarkdown: ver.data.body_markdown }, { recordVersion: true })
  },
}

async function list(query: any): Promise<Note[]> {
  const { data, error } = await query.is('deleted_at', null).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(dbToNote)
}

function dbToNote(r: any): Note {
  return {
    id: r.id,
    userId: r.user_id,
    placeId: r.place_id,
    tripId: r.trip_id,
    visitId: r.visit_id,
    title: r.title,
    bodyMarkdown: r.body_markdown ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }
}
