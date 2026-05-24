/**
 * Heat-intensity calculation for visited countries.
 *
 * Bucket boundaries are intentionally simple — match user mental model:
 *   1 city → faintest, 5+ cities → darkest.
 *
 * Pure function, no React, no Supabase. Tested in tests/domain/intensity.test.ts.
 */
export function intensityBucket(uniqueCitiesVisited: number): 0 | 1 | 2 | 3 | 4 {
  if (uniqueCitiesVisited <= 0) return 0
  if (uniqueCitiesVisited === 1) return 0
  if (uniqueCitiesVisited === 2) return 1
  if (uniqueCitiesVisited === 3) return 2
  if (uniqueCitiesVisited === 4) return 3
  return 4
}

/** Returns the rgba fill string for a given bucket (0–4). */
export function intensityFill(bucket: 0 | 1 | 2 | 3 | 4): string {
  const fills = [
    'rgba(184, 92, 46, 0.10)',
    'rgba(184, 92, 46, 0.20)',
    'rgba(184, 92, 46, 0.32)',
    'rgba(184, 92, 46, 0.48)',
    'rgba(184, 92, 46, 0.65)',
  ] as const
  return fills[bucket]
}
