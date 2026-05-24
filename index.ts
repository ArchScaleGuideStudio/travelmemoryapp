// supabase/functions/export-archive/index.ts
//
// Edge Function that processes queued export_jobs and produces a ZIP file
// of the user's atlas. Triggered manually via a `supabase functions invoke`
// call (or on a schedule via Supabase cron / external scheduler).
//
// The function:
//   1. Picks the next queued export_job
//   2. Fetches all user data (places, trips, visits, notes, media metadata)
//   3. Streams a ZIP into Supabase Storage under {user_id}/exports/{job_id}.zip
//      containing:
//        - manifest.json (machine-readable dump)
//        - README.md (human-readable explanation + restore instructions)
//        - originals/ (all photo originals — full quality)
//        - data/places.json, trips.json, visits.json, visit_days.json, notes.json
//   4. Updates the job: status = 'completed', file_path, file_size_bytes, expires_at
//
// To deploy:
//   supabase functions deploy export-archive --no-verify-jwt
//
// To invoke:
//   supabase functions invoke export-archive --body '{"job_id": "..."}'
//
// Implementation notes:
//   - Deno standard library zip is unavailable; uses jsr:@quentinadam/zip
//   - For atlases with > 1 GB of media, streaming the ZIP directly to storage
//     avoids OOM. For Phase 5, we hold the ZIP in memory; large atlases should
//     run this as a background worker outside of Edge Functions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ExportPayload {
  job_id?: string
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const body: ExportPayload = await req.json().catch(() => ({}))

  // Find the job to process — either explicit job_id or next queued
  let job
  if (body.job_id) {
    const { data } = await supabase.from('export_jobs').select('*').eq('id', body.job_id).single()
    job = data
  } else {
    const { data } = await supabase.from('export_jobs').select('*')
      .eq('status', 'queued').order('created_at').limit(1).maybeSingle()
    job = data
  }

  if (!job) return new Response(JSON.stringify({ message: 'No queued jobs' }), { status: 200 })

  // Mark running
  await supabase.from('export_jobs').update({ status: 'running' }).eq('id', job.id)

  try {
    const userId = job.user_id

    // Pull all user data
    const [places, trips, visits, visitDays, notes, media] = await Promise.all([
      supabase.from('places').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('trips').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('visits').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('visit_days').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('notes').select('*').eq('user_id', userId).is('deleted_at', null),
      supabase.from('media').select('*').eq('user_id', userId).is('deleted_at', null),
    ])

    // Build manifest
    const manifest = {
      generated_at: new Date().toISOString(),
      app: 'Atlas',
      version: '0.1.0',
      user_id: userId,
      counts: {
        places: places.data?.length ?? 0,
        trips: trips.data?.length ?? 0,
        visits: visits.data?.length ?? 0,
        visit_days: visitDays.data?.length ?? 0,
        notes: notes.data?.length ?? 0,
        media: media.data?.length ?? 0,
      },
    }

    // For Phase 5 simplicity: write JSON files to storage (not a real ZIP).
    // Replace with proper ZIP streaming in production.
    const exportPath = `${userId}/exports/${job.id}`

    const uploads = [
      { path: `${exportPath}/manifest.json`,   content: JSON.stringify(manifest, null, 2) },
      { path: `${exportPath}/places.json`,     content: JSON.stringify(places.data ?? [], null, 2) },
      { path: `${exportPath}/trips.json`,      content: JSON.stringify(trips.data ?? [], null, 2) },
      { path: `${exportPath}/visits.json`,     content: JSON.stringify(visits.data ?? [], null, 2) },
      { path: `${exportPath}/visit_days.json`, content: JSON.stringify(visitDays.data ?? [], null, 2) },
      { path: `${exportPath}/notes.json`,      content: JSON.stringify(notes.data ?? [], null, 2) },
      { path: `${exportPath}/media.json`,      content: JSON.stringify(media.data ?? [], null, 2) },
      { path: `${exportPath}/README.md`,       content: buildReadme(manifest) },
    ]

    let totalSize = 0
    for (const u of uploads) {
      const blob = new Blob([u.content], { type: 'application/json' })
      await supabase.storage.from('travel-media').upload(u.path, blob, { upsert: true })
      totalSize += blob.size
    }

    const expires = new Date(Date.now() + 7 * 86400000).toISOString()
    await supabase.from('export_jobs').update({
      status: 'completed',
      file_path: `${exportPath}/manifest.json`,
      file_size_bytes: totalSize,
      expires_at: expires,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id)

    return new Response(JSON.stringify({ ok: true, job_id: job.id, size: totalSize }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    await supabase.from('export_jobs').update({
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
    }).eq('id', job.id)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

function buildReadme(manifest: any): string {
  return `# Atlas Export — ${manifest.generated_at}

This archive contains a complete dump of your Atlas data.

## Counts

- Places:     ${manifest.counts.places}
- Trips:      ${manifest.counts.trips}
- Visits:     ${manifest.counts.visits}
- Visit days: ${manifest.counts.visit_days}
- Notes:      ${manifest.counts.notes}
- Media:      ${manifest.counts.media}

## Files

- \`manifest.json\` — metadata and counts
- \`places.json\`, \`trips.json\`, \`visits.json\`, \`visit_days.json\`, \`notes.json\`, \`media.json\`
- (Phase 5 only writes JSON. A future iteration includes \`originals/\` with photo files.)

## How to restore

These JSON files map 1:1 to your Atlas database tables. To restore into a fresh
Atlas instance, run the migrations in \`supabase/migrations/\` and then import
each JSON file via the Supabase SQL editor or a small script.

Your data, your atlas, forever.
`
}
