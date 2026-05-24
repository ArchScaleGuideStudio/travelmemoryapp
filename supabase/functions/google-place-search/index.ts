// supabase/functions/google-place-search/index.ts
//
// Server-side proxy for the Google Maps Places API. The browser cannot call
// this API directly (CORS + key exposure), so we run it server-side.
//
// Set the GOOGLE_MAPS_API_KEY env var on the function:
//   supabase secrets set GOOGLE_MAPS_API_KEY=AIza...
//
// Body: { name: string, lat: number, lng: number }
// Response: { matches: [{ placeId, name, formattedAddress, lat, lng }] }

const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!GOOGLE_KEY) {
    return new Response(JSON.stringify({ matches: [], error: 'GOOGLE_MAPS_API_KEY not configured' }), {
      status: 200,
      headers: corsHeaders('application/json'),
    })
  }

  const { name, lat, lng } = await req.json()
  if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
    return new Response(JSON.stringify({ error: 'name, lat, lng required' }), {
      status: 400,
      headers: corsHeaders('application/json'),
    })
  }

  // Use the Places API (New) — Nearby Search
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const placesRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 5000,
        },
      },
      maxResultCount: 5,
    }),
  })

  if (!placesRes.ok) {
    const text = await placesRes.text()
    return new Response(JSON.stringify({ matches: [], error: text }), {
      status: 200,
      headers: corsHeaders('application/json'),
    })
  }

  const data = await placesRes.json()
  const matches = (data.places ?? []).map((p: any) => ({
    placeId: p.id,
    name: p.displayName?.text ?? '',
    formattedAddress: p.formattedAddress ?? '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  }))

  return new Response(JSON.stringify({ matches }), {
    headers: corsHeaders('application/json'),
  })
})

function corsHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  }
}
