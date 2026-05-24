import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { PlacesService } from '@services/PlacesService'
import { MediaService } from '@services/MediaService'
import { IntensityService } from '@services/IntensityService'
import { intensityBucket } from '@domain/intensity'
import type { Place, Media, CountryVisitIntensity } from '@domain/types'

interface MediaWithUrls extends Media { thumbnailUrl?: string }

/**
 * MapLibre-based world map.
 * - Country heat layer: filled polygons by visit intensity
 * - Place pins: photo thumbnails (or default pin) at each visited place
 *
 * Uses CARTO Voyager raster tiles for the base map (free, no API key).
 * Country boundaries are loaded from a public Natural Earth GeoJSON.
 */
export function WorldMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [intensity, setIntensity] = useState<CountryVisitIntensity[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [covers, setCovers] = useState<Record<string, MediaWithUrls | undefined>>({})

  // Init map (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-voyager': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap · © CARTO',
          },
        },
        layers: [{ id: 'tiles', type: 'raster', source: 'carto-voyager' }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      center: [78, 22],
      zoom: 2.4,
      maxZoom: 12,
      minZoom: 1.5,
      attributionControl: { compact: true },
    })

    // Standard zoom buttons + compass (rotation reset)
    map.addControl(new maplibregl.NavigationControl({
      visualizePitch: false,
      showCompass: true,
      showZoom: true,
    }), 'top-right')

    // Scale bar for context
    map.addControl(new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric',
    }), 'bottom-left')

    // Custom "fit to my places" button — defined inline so it can call into
    // the closure that has access to current places (set later via fitToPlaces).
    class FitControl {
      private container: HTMLDivElement | null = null
      onAdd() {
        const div = document.createElement('div')
        div.className = 'maplibregl-ctrl maplibregl-ctrl-group'
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.title = 'Fit to my places'
        btn.setAttribute('aria-label', 'Fit to my places')
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 5px;"><path d="M3 7V4a1 1 0 0 1 1-1h3"/><path d="M21 7V4a1 1 0 0 0-1-1h-3"/><path d="M3 17v3a1 1 0 0 0 1 1h3"/><path d="M21 17v3a1 1 0 0 1-1 1h-3"/><circle cx="12" cy="12" r="3"/></svg>'
        btn.onclick = () => {
          // Fire a custom event the React layer listens to
          map.fire('atlas:fit-to-places')
        }
        div.appendChild(btn)
        this.container = div
        return div
      }
      onRemove() {
        this.container?.parentNode?.removeChild(this.container)
        this.container = null
      }
    }
    map.addControl(new FitControl() as any, 'top-right')

    mapRef.current = map

    map.on('load', () => {
      void loadCountries(map)
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Load user data
  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      try {
        const [pl, ig] = await Promise.all([
          PlacesService.listWithHydrated(user.id),
          IntensityService.forUser(user.id),
        ])
        setPlaces(pl)
        setIntensity(ig)

        const coversMap: Record<string, MediaWithUrls | undefined> = {}
        await Promise.all(
          pl.slice(0, 60).map(async (p) => {
            if (!p.coverMediaId) return
            try { coversMap[p.id] = await MediaService.get(p.coverMediaId) ?? undefined } catch {}
          }),
        )
        setCovers(coversMap)
      } finally {
        setLoading(false)
      }
    })()
  }, [user?.id])

  // Apply intensity to map (when both map ready + data loaded)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!map.isStyleLoaded()) {
      map.once('idle', () => applyIntensity(map, intensity))
    } else {
      applyIntensity(map, intensity)
    }
  }, [intensity])

  // Render place markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Clear old
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    places.forEach((p) => {
      const el = document.createElement('button')
      el.className = 'atlas-pin'
      const cover = covers[p.id]
      el.innerHTML = cover?.thumbnailUrl
        ? `<img src="${cover.thumbnailUrl}" alt="" />`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
      el.title = p.city?.name ?? p.customName ?? ''
      el.addEventListener('click', (e) => { e.stopPropagation(); navigate(`/places/${p.id}`) })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.lng, p.lat])
        .addTo(map)
      markersRef.current.push(marker)
    })
  }, [places, covers, navigate])

  // Fit-to-places: wire the custom event from the FitControl button, and also
  // auto-fit on the first non-empty places load so users land somewhere useful.
  const hasAutoFit = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const fitToPlaces = () => {
      if (places.length === 0) {
        map.flyTo({ center: [0, 20], zoom: 1.6, duration: 800 })
        return
      }
      if (places.length === 1) {
        const p = places[0]!
        map.flyTo({ center: [p.lng, p.lat], zoom: 5, duration: 800 })
        return
      }
      const first = places[0]!
      const bounds = new maplibregl.LngLatBounds(
        [first.lng, first.lat],
        [first.lng, first.lat],
      )
      places.forEach((p) => bounds.extend([p.lng, p.lat]))
      map.fitBounds(bounds, { padding: 80, maxZoom: 6, duration: 800 })
    }

    map.on('atlas:fit-to-places', fitToPlaces)

    // Auto-fit once, after the first places load
    if (!hasAutoFit.current && places.length > 0) {
      hasAutoFit.current = true
      // Small delay so the map style is fully loaded
      setTimeout(fitToPlaces, 300)
    }

    return () => {
      map.off('atlas:fit-to-places', fitToPlaces)
    }
  }, [places])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute top-4 left-4 bg-panel/95 backdrop-blur border border-paperEdge rounded-lg px-3 py-2 text-xs text-inkSoft flex items-center gap-2 shadow-sm">
          <Loader2 size={12} className="animate-spin" /> Loading your atlas…
        </div>
      )}
      {!loading && (
        <div className="absolute top-4 left-4 bg-panel/95 backdrop-blur border border-paperEdge rounded-lg px-3 py-2 text-xs shadow-sm">
          <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium mb-1">Your atlas</div>
          <div className="font-semibold">{places.length} places · {intensity.length} countries</div>
        </div>
      )}
      {/* Pin styling */}
      <style>{`
        .atlas-pin {
          width: 36px; height: 36px;
          border-radius: 18px;
          background: white;
          border: 2px solid #1F1E1A;
          box-shadow: 0 2px 6px rgba(0,0,0,0.18);
          padding: 0; cursor: pointer; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          color: #1F1E1A;
          transition: transform 0.15s ease;
        }
        .atlas-pin:hover { transform: scale(1.15); z-index: 10; }
        .atlas-pin img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  )
}

async function loadCountries(map: MLMap) {
  try {
    // Natural Earth 110m countries (small ~250KB)
    const res = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
    if (!res.ok) return
    const geojson = await res.json()

    map.addSource('countries', { type: 'geojson', data: geojson })

    // Heat fill layer — filtered by intensity property we'll set
    map.addLayer({
      id: 'country-heat',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': '#B85C2E',
        'fill-opacity': [
          'case',
          ['has', 'atlas_intensity'],
          ['*', ['get', 'atlas_intensity'], 0.13],
          0,
        ],
      },
    }, findFirstSymbolLayer(map))

    // Subtle border for visited countries
    map.addLayer({
      id: 'country-border',
      type: 'line',
      source: 'countries',
      filter: ['has', 'atlas_intensity'],
      paint: {
        'line-color': '#8C3F1A',
        'line-width': 0.6,
        'line-opacity': 0.6,
      },
    })
  } catch {
    // Map renders fine without country layer
  }
}

function applyIntensity(map: MLMap, intensity: CountryVisitIntensity[]) {
  const src = map.getSource('countries') as any
  if (!src || !src._data) return
  const data = JSON.parse(JSON.stringify(src._data))
  const byCode = new Map(intensity.map((i) => [i.isoA2, i]))
  for (const feature of data.features ?? []) {
    const code = feature.properties?.ISO_A2 ?? feature.properties?.iso_a2
    const it = code ? byCode.get(code) : undefined
    if (it) {
      const bucket = intensityBucket(it.uniqueCitiesVisited)
      feature.properties.atlas_intensity = bucket + 1   // 1..5
    } else {
      delete feature.properties.atlas_intensity
    }
  }
  src.setData(data)
}

function findFirstSymbolLayer(map: MLMap): string | undefined {
  const layers = map.getStyle().layers ?? []
  return layers.find((l) => l.type === 'symbol')?.id
}
