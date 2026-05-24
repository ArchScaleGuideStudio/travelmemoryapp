/**
 * Domain types.
 *
 * Hand-written counterparts to the database schema. We don't rely on
 * generated types alone because:
 *   1. They get regenerated, and code reviews on auto-generated files are noise.
 *   2. The app's *domain* may differ slightly from the DB (e.g. fields parsed
 *      or transformed).
 *
 * Generated DB types live in `database.types.ts` (git-ignored, regenerated
 * via `npm run db:types`). Use them only inside `services/` when mapping DB
 * rows into these domain types.
 */

// ---- Geographic reference data ----

export interface Continent {
  id: string
  name: string
  slug: string
}

export interface Country {
  id: string
  continentId: string
  name: string
  isoA2: string
  isoA3: string
  defaultLat?: number
  defaultLng?: number
  altNames?: string[]
}

export interface Region {
  id: string
  countryId: string
  name: string
  regionType?: string
  defaultLat?: number
  defaultLng?: number
}

export interface City {
  id: string
  regionId?: string
  countryId: string
  name: string
  lat: number
  lng: number
  population?: number
  externalIds?: Record<string, string>
}

// ---- User-owned data ----

export type Visibility = 'private' | 'unlisted' | 'public'

export type TravelType =
  | 'family' | 'business' | 'solo' | 'pilgrimage' | 'leisure'
  | 'event' | 'road_trip' | 'staycation' | 'work' | 'other'

export interface Profile {
  id: string
  username?: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  homeCountryId?: string
  preferences: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Place {
  id: string
  userId: string
  cityId?: string
  customName?: string
  lat: number
  lng: number
  locality?: string
  coverMediaId?: string
  visitCount: number
  firstVisitedAt?: string
  lastVisitedAt?: string
  notesSummary?: string
  visibility: Visibility
  isFavourite: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string
  // Joined fields (hydrated by service layer)
  city?: City
  region?: Region
  country?: Country
}

export interface Trip {
  id: string
  userId: string
  name: string
  description?: string
  travelType: TravelType
  startDate?: string
  endDate?: string
  coverMediaId?: string
  colorTag?: string
  visibility: Visibility
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Visit {
  id: string
  userId: string
  tripId: string
  placeId: string
  arrivalDate: string
  departureDate?: string
  orderInTrip: number
  summaryNotes?: string
  coverMediaId?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  // Joined
  place?: Place
  trip?: Trip
}

export interface JournalItem {
  id: string
  text: string
  createdAt: string
  /** Optional coordinates for Key Points (e.g. a specific cafe, viewpoint) */
  lat?: number
  lng?: number
}

export interface VisitDay {
  id: string
  userId: string
  visitId: string
  dayNumber: number
  date: string
  title?: string
  bodyMarkdown?: string
  weather?: string
  temperatureC?: number
  mood?: string
  companions?: string[]
  expensesInr?: number
  // Phase 7 — four-section model
  isPublishable: boolean
  publicSummary?: string
  keyMemories: JournalItem[]
  keyPoints: JournalItem[]
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type MediaKind = 'photo' | 'video'

export interface Media {
  id: string
  userId: string
  placeId?: string
  visitId?: string
  visitDayId?: string
  tripId?: string
  kind: MediaKind
  storageProvider: string
  originalPath: string
  previewPath?: string
  thumbnailPath?: string
  width?: number
  height?: number
  durationSeconds?: number
  fileSizeBytes?: number
  mimeType?: string
  originalFilename?: string
  takenAt?: string
  capturedLat?: number
  capturedLng?: number
  caption?: string
  altText?: string
  perceptualHash?: string
  contentHash?: string
  posterPath?: string
  hasAudio?: boolean
  videoCodec?: string
  exif: Record<string, unknown>
  isCover: boolean
  createdAt: string
  deletedAt?: string
  // Hydrated signed URLs (not stored — produced on demand)
  originalUrl?: string
  previewUrl?: string
  thumbnailUrl?: string
  posterUrl?: string
}

export interface Note {
  id: string
  userId: string
  placeId?: string
  tripId?: string
  visitId?: string
  title?: string
  bodyMarkdown: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Tag {
  id: string
  userId: string
  name: string
  color?: string
  createdAt: string
}

export interface Album {
  id: string
  userId: string
  name: string
  description?: string
  coverMediaId?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// ---- Public content ----

export type PublicReviewStatus = 'draft' | 'ready' | 'published' | 'archived'

export interface PublicReview {
  id: string
  userId: string
  placeId?: string
  visitId?: string
  title: string
  bodyMarkdown: string
  summary?: string
  ratingOverall?: number
  ratingFood?: number
  ratingValue?: number
  ratingAtmosphere?: number
  priceLevel?: number
  visitPurpose?: 'food' | 'lodging' | 'attraction' | 'shopping' | 'transit' | 'experience' | 'nature' | 'other'
  tags?: string[]
  recommendedFor?: string[]
  bestTimeToVisit?: string
  accessibilityNotes?: string
  openingHours?: Record<string, unknown>
  contact?: { phone?: string; website?: string; instagram?: string }
  heroMediaId?: string
  galleryMediaIds?: string[]
  googlePlaceId?: string
  osmPlaceId?: string
  status: PublicReviewStatus
  language: string
  createdAt: string
  updatedAt: string
  publishedAt?: string
  deletedAt?: string
}

// ---- Derived / aggregate types ----

export interface CountryVisitIntensity {
  countryId: string
  countryName: string
  isoA2: string
  uniqueCitiesVisited: number
  totalVisits: number
}

export interface GeocodingResult {
  displayName: string
  city?: string
  region?: string
  country: string
  countryCode: string  // ISO A2
  lat: number
  lng: number
  externalId: string   // e.g. osm_id
  source: 'nominatim' | 'mapbox' | 'manual'
}

// ---- Helpers ----

export const TRAVEL_TYPES: { id: TravelType; label: string }[] = [
  { id: 'family',     label: 'Family Trip' },
  { id: 'business',   label: 'Business' },
  { id: 'solo',       label: 'Solo' },
  { id: 'pilgrimage', label: 'Pilgrimage' },
  { id: 'leisure',    label: 'Leisure' },
  { id: 'event',      label: 'Event' },
  { id: 'road_trip',  label: 'Road Trip' },
  { id: 'staycation', label: 'Staycation' },
  { id: 'work',       label: 'Work' },
  { id: 'other',      label: 'Other' },
]
