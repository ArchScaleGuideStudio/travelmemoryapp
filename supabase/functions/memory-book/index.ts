// supabase/functions/memory-book/index.ts
//
// Generates a "memory book" of a place, trip, or the full atlas as printable
// HTML that the client converts to PDF via the browser's print-to-PDF.
//
// Why this approach:
//   Edge Functions have tight CPU/memory limits and no native PDF library.
//   The simplest reliable path: server emits a single self-contained HTML
//   document with embedded styles + signed image URLs. The client opens it
//   in a new tab and the user prints to PDF. No server-side rendering
//   complexity, perfect typography, and the result is editable HTML.
//
// For a fully programmatic PDF (no user action), you can swap this function's
// output for a PDF byte stream using a Deno-compatible PDF lib in a later phase.
//
// Invocation:
//   POST /functions/v1/memory-book
//   { "scope": "trip" | "place" | "everything", "scope_id": "uuid" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type Scope = 'trip' | 'place' | 'everything'

interface Body {
  scope: Scope
  scope_id?: string
  user_id: string   // taken from the JWT in practice; explicit here for clarity
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const body: Body = await req.json()

  const html = await buildMemoryBook(supabase, body)

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
})

async function buildMemoryBook(supabase: any, body: Body): Promise<string> {
  const { scope, scope_id, user_id } = body

  let title = 'Atlas — Memory Book'
  let subtitle = ''
  let places: any[] = []
  let trips: any[] = []
  let visits: any[] = []
  let visitDays: any[] = []
  let mediaByVisit: Record<string, any[]> = {}

  if (scope === 'trip' && scope_id) {
    const tripRes = await supabase.from('trips').select('*').eq('id', scope_id).single()
    if (!tripRes.data) return wrap('Trip not found', '')
    trips = [tripRes.data]
    title = tripRes.data.name
    subtitle = `${tripRes.data.start_date ?? ''} – ${tripRes.data.end_date ?? ''}`
    const visitsRes = await supabase.from('visits')
      .select('*, place:places(*, city:cities(name, country:countries(name)))')
      .eq('trip_id', scope_id).is('deleted_at', null)
      .order('order_in_trip')
    visits = visitsRes.data ?? []
  } else if (scope === 'place' && scope_id) {
    const placeRes = await supabase.from('places').select('*, city:cities(name, country:countries(name))').eq('id', scope_id).single()
    if (!placeRes.data) return wrap('Place not found', '')
    places = [placeRes.data]
    title = placeRes.data.city?.name ?? placeRes.data.custom_name ?? 'Place'
    subtitle = placeRes.data.city?.country?.name ?? ''
    const visitsRes = await supabase.from('visits')
      .select('*').eq('place_id', scope_id).is('deleted_at', null)
      .order('arrival_date')
    visits = visitsRes.data ?? []
  } else if (scope === 'everything') {
    const placesRes = await supabase.from('places').select('*, city:cities(name, country:countries(name))').eq('user_id', user_id).is('deleted_at', null).order('first_visited_at')
    places = placesRes.data ?? []
    title = 'Your Atlas'
    subtitle = `${places.length} places · all of them`
  }

  // Fetch days + media for the visits we have
  if (visits.length > 0) {
    const visitIds = visits.map((v: any) => v.id)
    const daysRes = await supabase.from('visit_days').select('*').in('visit_id', visitIds).is('deleted_at', null).order('day_number')
    visitDays = daysRes.data ?? []

    const mediaRes = await supabase.from('media').select('*').in('visit_id', visitIds).is('deleted_at', null).order('taken_at')
    for (const m of mediaRes.data ?? []) {
      if (!mediaByVisit[m.visit_id]) mediaByVisit[m.visit_id] = []
      mediaByVisit[m.visit_id].push(m)
    }
  }

  // Generate signed URLs for embedded images. 4-hour expiry for print.
  for (const visitId of Object.keys(mediaByVisit)) {
    for (const m of mediaByVisit[visitId]) {
      if (m.preview_path) {
        const { data } = await supabase.storage.from('travel-media').createSignedUrl(m.preview_path, 14400)
        m.preview_url = data?.signedUrl
      }
    }
  }

  return wrap(title, renderBody(subtitle, places, trips, visits, visitDays, mediaByVisit))
}

function renderBody(subtitle: string, places: any[], trips: any[], visits: any[], visitDays: any[], media: Record<string, any[]>): string {
  const visitHtml = visits.map((v) => {
    const place = v.place
    const cityName = place?.city?.name ?? place?.custom_name ?? 'Place'
    const country = place?.city?.country?.name ?? ''
    const days = visitDays.filter((d) => d.visit_id === v.id)
    const photos = media[v.id] ?? []

    const dayBlocks = days.map((d) => `
      <section class="day">
        <h3>${escapeHtml(d.title || `Day ${d.day_number}`)}</h3>
        <div class="day-meta">${escapeHtml(d.date)}${d.weather ? ` · ${escapeHtml(d.weather)}` : ''}${d.mood ? ` · ${escapeHtml(d.mood)}` : ''}</div>
        ${d.body_markdown ? `<p>${escapeHtml(d.body_markdown).replace(/\n/g, '<br>')}</p>` : ''}
      </section>
    `).join('')

    const photoBlock = photos.length > 0 ? `
      <div class="photos">
        ${photos.slice(0, 12).map((p) => p.preview_url
          ? `<figure><img src="${p.preview_url}" loading="lazy"/>${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}</figure>`
          : '').join('')}
      </div>
    ` : ''

    return `
      <article class="visit">
        <header>
          <h2>${escapeHtml(cityName)}</h2>
          <div class="visit-meta">${escapeHtml(country)} · ${escapeHtml(v.arrival_date)}${v.departure_date ? ` – ${escapeHtml(v.departure_date)}` : ''}</div>
        </header>
        ${v.summary_notes ? `<p class="summary">${escapeHtml(v.summary_notes)}</p>` : ''}
        ${dayBlocks}
        ${photoBlock}
      </article>
    `
  }).join('')

  return `
    <div class="cover">
      <div class="cover-eyebrow">A memory book</div>
      <h1>${escapeHtml(subtitle ? '' : 'Your Atlas')}</h1>
      <div class="cover-subtitle">${escapeHtml(subtitle)}</div>
    </div>
    ${visitHtml}
    <div class="footer-note">Printed from Atlas · ${new Date().toLocaleDateString()}</div>
  `
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wrap(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} · Atlas memory book</title>
<style>
  @page { size: A4; margin: 24mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Fraunces', Georgia, serif;
    color: #1F1E1A;
    background: #F6F3EC;
    margin: 0;
    padding: 32px;
    line-height: 1.55;
  }
  .cover {
    page-break-after: always;
    text-align: center;
    padding: 80px 20px;
    border: 1px solid #E5E0D2;
    border-radius: 12px;
    margin-bottom: 40px;
  }
  .cover-eyebrow {
    font-family: 'DM Sans', system-ui, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #A09C92;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 24px;
  }
  .cover h1 {
    font-size: 48px;
    margin: 0 0 12px;
    letter-spacing: -0.02em;
  }
  .cover-subtitle {
    font-family: 'DM Sans', sans-serif;
    color: #6B6862;
    font-size: 14px;
  }
  .visit {
    page-break-inside: avoid;
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 1px solid #E5E0D2;
  }
  .visit h2 {
    font-size: 28px;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
  }
  .visit-meta {
    font-family: 'DM Sans', sans-serif;
    color: #6B6862;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 16px;
  }
  .summary {
    font-style: italic;
    color: #6B6862;
    border-left: 3px solid #B85C2E;
    padding-left: 14px;
    margin: 12px 0 24px;
  }
  .day {
    margin: 20px 0;
    padding-left: 14px;
    border-left: 1px solid #E5E0D2;
  }
  .day h3 {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
    color: #1F1E1A;
  }
  .day-meta {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    color: #A09C92;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .day p {
    font-size: 14px;
    margin: 6px 0;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 16px;
  }
  .photos figure {
    margin: 0;
    page-break-inside: avoid;
  }
  .photos img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 4px;
  }
  .photos figcaption {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    color: #6B6862;
    margin-top: 4px;
  }
  .footer-note {
    text-align: center;
    color: #A09C92;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    margin-top: 60px;
  }
  @media print {
    body { background: white; padding: 0; }
    .cover { border: none; }
  }
</style>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
${body}
<script>
  // Auto-trigger print dialog on load — user prints to PDF and saves.
  setTimeout(() => { try { window.print() } catch {} }, 800)
</script>
</body>
</html>`
}
