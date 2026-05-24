# Atlas — A Personal Travel Memory Vault

A vault for your lifetime travel memories. Places visited, per-day journal entries,
photos, slideshows, **and content you can publish to Google Maps and beyond**.

> **Core principle:** This is a memory vault, not a travel app. Every architectural
> decision favors data preservation over feature velocity.

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **State:** TanStack Query + Zustand
- **Maps:** MapLibre GL JS + CARTO Voyager tiles + Natural Earth GeoJSON
- **Validation:** Zod
- **Mobile (later):** Capacitor wrapper of this same React app

---

## Phase status — Phases 1 through 6 shipped

| Phase | Goal | Status |
|-------|------|--------|
| **1 — The Vault** | Scaffold, schema, RLS, auth | ✅ done |
| **2 — The Library** | Add place, photo upload, auto-save journal, per-day entries, recycle bin | ✅ done |
| **3 — Memory Map** | World map, timeline, gallery, trips | ✅ done |
| **4 — Memory Reel** | Slideshow, albums, search, On This Day | ✅ done |
| **5 — The Fortress + Voice** | Public reviews (Google Maps), note version history, export, settings | ✅ done |
| **6 — Out into the World** | Mobile (Capacitor) + Video + PDF Memory Book + Google Maps publishing | ✅ done |

---

## What's in this build

### Database (`supabase/migrations/`)
- Full schema: continents → countries → regions → cities → places → trips → visits → **visit_days** (per-day journals)
- Media table with originals + previews + thumbnails + perceptual + content hashes
- Notes with append-only version history (capped at 20 per note)
- Tags (polymorphic), albums, slideshows
- **public_reviews + publications** — separate schema for content you publish to Google Maps and the wider world
- `export_jobs` table for ZIP archive generation
- Soft delete on every user-owned table
- Row Level Security on every table
- Storage bucket `travel-media` with per-user folder isolation

### Pages (all wired up in `src/routes.tsx`)
- `/`                        — Dashboard with stats, On This Day, recent places
- `/auth/login`, `/auth/signup` — Real auth (email/password + magic link)
- `/places/new`              — 3-step add place flow with geocoding
- `/places/:id`              — Visit page: hero, per-day journal editor, photo upload+lightbox, timeline of revisits
- `/map`                     — World map with country heat + photo pins
- `/timeline`                — Year/trip sidebar, month-grouped visits
- `/trips/:id`               — Numbered trip itinerary with covers
- `/gallery`                 — All photos, year filter, lightbox
- `/albums`, `/albums/:id`   — Curated photo collections + slideshow player
- `/search`                  — Fuzzy search across places, trips, notes, photo captions
- `/public-reviews`          — List your publishable content
- `/public-reviews/new`      — Author a review with ratings, hours, accessibility
- `/public-reviews/:id`      — Edit a review with auto-save
- `/recently-deleted`        — Restore items deleted in the last 30 days
- `/settings`                — Account, exports, safety overview

### Services (the only thing that talks to Supabase)
`PlacesService`, `TripsService`, `VisitsService`, `VisitDaysService`,
`NotesService` (with version history), `MediaService` (with dup detection),
`GeocodingService`, `IntensityService`, `RecoveryService`, `AlbumsService`,
`SlideshowsService`, `SearchService`, `PublicReviewsService`, `ExportService`.

### Components
- `editor/`: `JournalEditor`, `VisitDayEditor`, `NoteVersionHistory`
- `gallery/`: `PhotoUploader`, `PhotoGrid`, `Lightbox`
- `map/`: `WorldMap`
- `slideshow/`: `SlideshowPlayer`
- `timeline/`: `TimelineSidebar`
- `shared/`: `Button`, `EmptyState`, `SaveStatus`, `ProtectedRoute`, `PageStub`, `OnThisDayCard`

### Edge function
`supabase/functions/export-archive/index.ts` — processes `export_jobs` and writes a per-user export to storage.
`supabase/functions/memory-book/index.ts` — generates a printable HTML memory book of a trip, place, or full atlas.
`supabase/functions/google-place-search/index.ts` — server-side proxy to the Google Places API for Place ID matching.

### Phase 6 additions
- **Mobile via Capacitor.** Same React app, native iOS + Android shells. Native camera + photo library + share sheet + haptics. See `MOBILE.md` for build instructions.
- **Video media.** Upload videos with auto-extracted poster frames. The lightbox plays them inline. Same dedup + grid + cover-photo flow as images.
- **PDF Memory Book.** Server-rendered HTML book (cover + per-place sections with photos, journal, and per-day entries). Opens in a new tab and auto-triggers print-to-PDF.
- **Publish flow.** Real `/r/{slug}` public web pages for your reviews. Google Maps deep-linking to push you straight to the "Write a review" composer with your Place ID pre-loaded.
- **Bottom nav** on small screens with primary actions: Atlas, Map, Add, Timeline, Gallery.

---

## Setup — first run

### 1. Install dependencies

```bash
cd travel-atlas
npm install
```

### 2. Create your Supabase project

1. Go to <https://supabase.com> → New project
2. Wait ~2 minutes for it to provision
3. In the dashboard: **Settings → API** — copy the `Project URL` and the `anon public` key

### 3. Configure environment

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your Supabase URL and anon key.

### 4. Apply database migrations

In Supabase dashboard → **SQL Editor**, run in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_storage_setup.sql`
4. `supabase/seed.sql`

### 5. (Optional) Deploy the export function

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy export-archive --no-verify-jwt
```

### 6. Run the app

```bash
npm run dev
```

Open <http://localhost:5173>, sign up, and start your atlas.

---

## Two important features baked into the schema from day one

### Per-day journal entries (`visit_days` table)

A "visit" is a stay at one place. Within it, you can write **per-day journal entries** —
Day 1 arrival, Day 2 Gulmarg gondola, etc. Each day has its own:

- `title`, `body_markdown` (your journal)
- `weather`, `temperature_c`, `mood`, `companions[]`
- `expenses_inr` (optional spend tracking)

The PlaceDetail page lets you add days one at a time or auto-create them based on
your departure date. Each day auto-saves 1.5 seconds after you stop typing.

### Publishable content (`public_reviews` + `publications`)

Separate from your private journal. When you have something worth sharing with the
world — "Best chai at Café Liberty, ₹40, opens at 6am" — you write it as a **public
review** with its own schema:

- Ratings (overall, food, value, atmosphere)
- Price level, visit purpose
- Opening hours, accessibility, recommended_for
- Hero photo + gallery
- `google_place_id` for linking to Google Maps
- Status: `draft → ready → published`

The `publications` table tracks where each review has been syndicated (Google Maps,
your own website, etc.). The editor is at `/public-reviews/new`.

---

## Safety architecture — active from day one

1. **Soft delete everywhere.** No DELETE policies; all destructive actions set `deleted_at`.
2. **30-day Recovery Bin.** Restore anything you've deleted within 30 days.
3. **Per-user storage isolation.** Files live under `{user_id}/...` — storage RLS enforces this.
4. **RLS on every table.** A user literally cannot read another user's rows.
5. **Original preservation.** Originals never modified; thumbnails and previews are derived.
6. **Auto-save.** 1500ms debounced auto-save on every editable field with visible status.
7. **Note version history.** Up to 20 versions per note; restore any prior version.
8. **Duplicate detection.** Same photo uploaded twice links to existing media instead of duplicating.
9. **Export everything.** Edge function produces a per-user JSON+manifest archive.

---

## Acceptance tests for this checkpoint

Sign in and verify each:

1. **Add place** → search "Srinagar" → step 2 (dates) → step 3 (trip name) → save → land on PlaceDetail
2. **Per-day journal** → on PlaceDetail, click "Add day" → write something → wait 2 seconds → see "Saved" indicator
3. **Photo upload** → drop a photo → see thumbnail appear in grid
4. **Lightbox** → click thumbnail → use arrow keys → set as cover → close with Esc
5. **World map** → `/map` → see country fill darker for countries with more cities
6. **Timeline** → `/timeline` → click a year in the sidebar
7. **Gallery** → `/gallery` → see all your photos, year filter
8. **Slideshow** → open an album → click Play → spacebar to pause
9. **Search** → `/search` → type a city name → see grouped hits
10. **Public review** → `/public-reviews/new` → title → create → set ratings, price, purpose → auto-save status appears
11. **Recently deleted** → delete a photo from lightbox → go to `/recently-deleted` → restore it
12. **Export** → `/settings` → queue export → (after deploying the Edge Function) download the archive

---

## What's next — Phase 6+ ideas

- **Mobile app via Capacitor** — wrap this React app for iOS/Android
- **PDF export** with photos + journal
- **Video support** in the media pipeline
- **2FA** for account
- **Apple Photos / Google Photos import** with EXIF GPS auto-place
- **Offline PWA mode**
- **Google Maps Contributions API** to push public reviews automatically
- **Memory reel music** (Tone.js)
- **Trip route polylines** on the trip detail map

Your data, your atlas, forever.
