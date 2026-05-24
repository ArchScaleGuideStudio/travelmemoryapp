import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, MapPin, ArrowLeft, Loader2, Check } from 'lucide-react'
import { useDebounced } from '@hooks/useDebounced'
import { useAuth } from '@hooks/useAuth'
import { GeocodingService } from '@services/GeocodingService'
import { PlacesService } from '@services/PlacesService'
import { TripsService } from '@services/TripsService'
import { VisitsService } from '@services/VisitsService'
import { today } from '@lib/format'
import { Button } from '@components/shared/Button'
import type { GeocodingResult } from '@domain/types'

export default function AddPlace() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<GeocodingResult | null>(null)
  const [arrivalDate, setArrivalDate] = useState(today())
  const [departureDate, setDepartureDate] = useState('')
  const [tripName, setTripName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounced(query, 400)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) { setResults([]); return }
    setSearching(true)
    GeocodingService.search(debouncedQuery)
      .then(setResults)
      .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  const handleSave = async () => {
    if (!user || !selected) return
    setSaving(true)
    setError(null)
    try {
      const { city, country } = await GeocodingService.resolveToCity(selected)
      const place = await PlacesService.create({
        userId: user.id, cityId: city.id,
        lat: selected.lat, lng: selected.lng,
        locality: selected.displayName.split(',').slice(0, 2).join(', '),
      })
      const trip = await TripsService.create({
        userId: user.id,
        name: tripName.trim() || `${city.name} · ${country.name}`,
        startDate: arrivalDate,
        endDate: departureDate || undefined,
      })
      await VisitsService.create({
        userId: user.id, tripId: trip.id, placeId: place.id,
        arrivalDate, departureDate: departureDate || undefined,
      })
      navigate(`/places/${place.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-paper">
      <header className="px-6 py-4 border-b border-paperEdge bg-panel flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-paperDeep text-inkSoft">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-semibold">Add a place</h1>
          <div className="text-xs text-inkSoft">Search a city, then log your visit</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <Step number={1} title="Where did you go?">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkFaint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
              placeholder="Try 'Srinagar', 'Kyoto', 'Lisbon'…"
              className="w-full pl-10 pr-3 py-2.5 bg-panel border border-paperEdge rounded-lg text-sm outline-none focus:border-ink"
            />
            {searching && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-inkFaint" />
            )}
          </div>

          {results.length > 0 && !selected && (
            <div className="mt-2 bg-panel border border-paperEdge rounded-lg overflow-hidden divide-y divide-paperEdge">
              {results.map((r) => (
                <button
                  key={r.externalId}
                  onClick={() => setSelected(r)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-paper text-left transition-colors"
                >
                  <MapPin size={15} className="text-inkSoft mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.city ?? r.displayName.split(',')[0]}</div>
                    <div className="text-xs text-inkSoft truncate">{r.displayName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="mt-2 bg-accentSoft/30 border border-accentSoft rounded-lg px-4 py-3 flex items-start gap-3">
              <Check size={15} className="text-accentDeep mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{selected.city ?? selected.displayName.split(',')[0]}</div>
                <div className="text-xs text-inkSoft truncate">{selected.displayName}</div>
                <button
                  onClick={() => { setSelected(null); setResults([]); setQuery('') }}
                  className="text-xs text-accentDeep underline mt-1"
                >Change</button>
              </div>
            </div>
          )}
        </Step>

        {selected && (
          <>
            <Step number={2} title="When were you there?">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Arrival">
                  <input type="date" value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="w-full text-sm bg-transparent outline-none" />
                </Field>
                <Field label="Departure (optional)">
                  <input type="date" value={departureDate} min={arrivalDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full text-sm bg-transparent outline-none" />
                </Field>
              </div>
            </Step>

            <Step number={3} title="Part of a trip? (optional)">
              <Field label="Trip name">
                <input value={tripName} onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g. Kashmir Winter '25"
                  className="w-full text-sm bg-transparent outline-none placeholder:text-inkFaint" />
              </Field>
              <p className="text-xs text-inkSoft mt-2">
                Leave blank and we'll create a single-place trip you can rename later.
              </p>
            </Step>

            {error && <div className="mb-4 text-xs text-danger bg-accentSoft/40 rounded-md px-3 py-2">{error}</div>}

            <div className="flex gap-3 mt-8">
              <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Save to atlas
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-6 h-6 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-semibold">{number}</div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="pl-9">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block bg-panel border border-paperEdge rounded-lg px-3 py-2.5 focus-within:border-ink">
      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium mb-1">{label}</div>
      {children}
    </label>
  )
}
