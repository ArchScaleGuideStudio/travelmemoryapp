import { supabase } from '@infra/supabase'
import { supabaseStorage } from '@infra/storage/SupabaseStorage'

export interface ExportJob {
  id: string
  userId: string
  scope: 'everything' | 'trip' | 'place' | 'album' | 'date_range'
  scopeId?: string
  format: 'zip' | 'pdf' | 'json'
  status: 'queued' | 'running' | 'completed' | 'failed'
  filePath?: string
  fileSizeBytes?: number
  expiresAt?: string
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export const ExportService = {
  async list(userId: string): Promise<ExportJob[]> {
    const { data, error } = await supabase.from('export_jobs')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(20)
    if (error) throw error
    return (data ?? []).map(dbToJob)
  },

  /**
   * Queue an export job. An Edge Function picks it up and runs the actual zip.
   * For Phase 5 the function is scaffolded but the user needs to deploy it
   * to actually produce a file. See supabase/functions/export-archive/.
   */
  async queueExport(args: { userId: string; scope?: ExportJob['scope']; scopeId?: string; format?: ExportJob['format'] }): Promise<ExportJob> {
    const { data, error } = await supabase.from('export_jobs').insert({
      user_id: args.userId,
      scope: args.scope ?? 'everything',
      scope_id: args.scopeId ?? null,
      format: args.format ?? 'zip',
      status: 'queued',
    }).select('*').single()
    if (error || !data) throw new Error(error?.message ?? 'export queue failed')
    return dbToJob(data)
  },

  async getDownloadUrl(job: ExportJob): Promise<string | null> {
    if (!job.filePath) return null
    try { return await supabaseStorage.getSignedUrl(job.filePath, { expiresIn: 3600 }) }
    catch { return null }
  },
}

function dbToJob(r: any): ExportJob {
  return {
    id: r.id, userId: r.user_id, scope: r.scope, scopeId: r.scope_id,
    format: r.format, status: r.status, filePath: r.file_path,
    fileSizeBytes: r.file_size_bytes, expiresAt: r.expires_at,
    errorMessage: r.error_message, createdAt: r.created_at,
    completedAt: r.completed_at,
  }
}
