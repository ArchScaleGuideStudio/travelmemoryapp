/**
 * Zod schemas for runtime validation.
 *
 * Use these at every boundary where untrusted data enters the app:
 *   - Form submissions (validate before sending to DB)
 *   - Geocoding API responses (validate before trusting)
 *   - URL params (validate before using as IDs)
 *
 * If a value passes the schema, the corresponding TypeScript type can be trusted.
 */
import { z } from 'zod'

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
export const isoCountrySchema = z.string().length(2).regex(/^[A-Z]{2}$/)

export const visibilitySchema = z.enum(['private', 'unlisted', 'public'])

export const travelTypeSchema = z.enum([
  'family', 'business', 'solo', 'pilgrimage', 'leisure',
  'event', 'road_trip', 'staycation', 'work', 'other',
])

export const newPlaceSchema = z.object({
  cityId: z.string().uuid().optional(),
  customName: z.string().min(1).max(120).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  locality: z.string().max(120).optional(),
  visibility: visibilitySchema.default('private'),
}).refine(
  (v) => v.cityId !== undefined || v.customName !== undefined,
  'Either cityId or customName is required',
)

export const newTripSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  travelType: travelTypeSchema.default('leisure'),
  startDate: isoDateSchema.optional(),
  endDate:   isoDateSchema.optional(),
  colorTag:  z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).refine(
  (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
  'End date must be on or after start date',
)

export const newVisitSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid(),
  arrivalDate: isoDateSchema,
  departureDate: isoDateSchema.optional(),
  orderInTrip: z.number().int().nonnegative().default(0),
  summaryNotes: z.string().max(2000).optional(),
})

export const newVisitDaySchema = z.object({
  visitId: z.string().uuid(),
  dayNumber: z.number().int().positive(),
  date: isoDateSchema,
  title: z.string().max(200).optional(),
  bodyMarkdown: z.string().max(50000).optional(),
  weather: z.string().max(40).optional(),
  temperatureC: z.number().int().min(-50).max(60).optional(),
  mood: z.string().max(40).optional(),
  companions: z.array(z.string().max(80)).max(20).optional(),
  expensesInr: z.number().int().nonnegative().optional(),
})

export const geocodingResultSchema = z.object({
  displayName: z.string(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string(),
  countryCode: isoCountrySchema,
  lat: z.number(),
  lng: z.number(),
  externalId: z.string(),
  source: z.enum(['nominatim', 'mapbox', 'manual']),
})

export type NewPlace = z.infer<typeof newPlaceSchema>
export type NewTrip = z.infer<typeof newTripSchema>
export type NewVisit = z.infer<typeof newVisitSchema>
export type NewVisitDay = z.infer<typeof newVisitDaySchema>
