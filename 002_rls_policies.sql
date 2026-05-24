-- ============================================================================
-- 002_rls_policies.sql
-- Row Level Security — the security model of the app.
--
-- Strategy:
--   • Geographic reference tables (continents/countries/regions/cities):
--     readable by ALL authenticated users. Inserts to cities only via service role.
--   • Everything else: a user can only see and modify rows where user_id = auth.uid()
--   • Soft delete pattern: no DELETE policies. Updates only set deleted_at.
-- ============================================================================

-- Helper: enable RLS on every relevant table
alter table profiles          enable row level security;
alter table continents        enable row level security;
alter table countries         enable row level security;
alter table regions           enable row level security;
alter table cities            enable row level security;
alter table places            enable row level security;
alter table trips             enable row level security;
alter table visits            enable row level security;
alter table visit_days        enable row level security;
alter table media             enable row level security;
alter table notes             enable row level security;
alter table note_versions     enable row level security;
alter table tags              enable row level security;
alter table taggables         enable row level security;
alter table albums            enable row level security;
alter table album_media       enable row level security;
alter table slideshows        enable row level security;
alter table slideshow_items   enable row level security;
alter table public_reviews    enable row level security;
alter table publications      enable row level security;
alter table export_jobs       enable row level security;

-- ----------------------------------------------------------------------------
-- REFERENCE DATA — readable by any authenticated user
-- ----------------------------------------------------------------------------

create policy "continents readable by all" on continents
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "countries readable by all" on countries
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "regions readable by all" on regions
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "cities readable by all" on cities
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- Authenticated users can insert a new city (when geocoding returns one we
-- haven't seen). Service role still required for editing existing cities.
create policy "authenticated can add cities" on cities
  for insert with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- PROFILES — user can read and update their own profile.
-- Other users' profiles are not exposed in Phase 1.
-- ----------------------------------------------------------------------------

create policy "users see own profile" on profiles
  for select using (auth.uid() = id);

create policy "users update own profile" on profiles
  for update using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- USER-OWNED DATA — uniform policy template
-- A user can only act on rows they own.
-- ----------------------------------------------------------------------------

-- PLACES
create policy "places: select own" on places
  for select using (auth.uid() = user_id);
create policy "places: insert own" on places
  for insert with check (auth.uid() = user_id);
create policy "places: update own" on places
  for update using (auth.uid() = user_id);

-- TRIPS
create policy "trips: select own" on trips
  for select using (auth.uid() = user_id);
create policy "trips: insert own" on trips
  for insert with check (auth.uid() = user_id);
create policy "trips: update own" on trips
  for update using (auth.uid() = user_id);

-- VISITS
create policy "visits: select own" on visits
  for select using (auth.uid() = user_id);
create policy "visits: insert own" on visits
  for insert with check (auth.uid() = user_id);
create policy "visits: update own" on visits
  for update using (auth.uid() = user_id);

-- VISIT DAYS
create policy "visit_days: select own" on visit_days
  for select using (auth.uid() = user_id);
create policy "visit_days: insert own" on visit_days
  for insert with check (auth.uid() = user_id);
create policy "visit_days: update own" on visit_days
  for update using (auth.uid() = user_id);

-- MEDIA
create policy "media: select own" on media
  for select using (auth.uid() = user_id);
create policy "media: insert own" on media
  for insert with check (auth.uid() = user_id);
create policy "media: update own" on media
  for update using (auth.uid() = user_id);

-- NOTES
create policy "notes: select own" on notes
  for select using (auth.uid() = user_id);
create policy "notes: insert own" on notes
  for insert with check (auth.uid() = user_id);
create policy "notes: update own" on notes
  for update using (auth.uid() = user_id);

-- NOTE VERSIONS — readable through the note ownership, inserted by trigger
create policy "note_versions: select via note" on note_versions
  for select using (
    exists (
      select 1 from notes
      where notes.id = note_versions.note_id and notes.user_id = auth.uid()
    )
  );
create policy "note_versions: insert via note" on note_versions
  for insert with check (auth.uid() = saved_by);

-- TAGS
create policy "tags: select own" on tags
  for select using (auth.uid() = user_id);
create policy "tags: insert own" on tags
  for insert with check (auth.uid() = user_id);
create policy "tags: update own" on tags
  for update using (auth.uid() = user_id);

-- TAGGABLES
create policy "taggables: select own" on taggables
  for select using (auth.uid() = user_id);
create policy "taggables: insert own" on taggables
  for insert with check (auth.uid() = user_id);
create policy "taggables: delete own" on taggables
  for delete using (auth.uid() = user_id);

-- ALBUMS
create policy "albums: select own" on albums
  for select using (auth.uid() = user_id);
create policy "albums: insert own" on albums
  for insert with check (auth.uid() = user_id);
create policy "albums: update own" on albums
  for update using (auth.uid() = user_id);

-- ALBUM MEDIA
create policy "album_media: select own" on album_media
  for select using (auth.uid() = user_id);
create policy "album_media: insert own" on album_media
  for insert with check (auth.uid() = user_id);
create policy "album_media: delete own" on album_media
  for delete using (auth.uid() = user_id);

-- SLIDESHOWS
create policy "slideshows: select own" on slideshows
  for select using (auth.uid() = user_id);
create policy "slideshows: insert own" on slideshows
  for insert with check (auth.uid() = user_id);
create policy "slideshows: update own" on slideshows
  for update using (auth.uid() = user_id);

-- SLIDESHOW ITEMS
create policy "slideshow_items: select own" on slideshow_items
  for select using (auth.uid() = user_id);
create policy "slideshow_items: insert own" on slideshow_items
  for insert with check (auth.uid() = user_id);
create policy "slideshow_items: delete own" on slideshow_items
  for delete using (auth.uid() = user_id);

-- PUBLIC REVIEWS — users CRUD their own. Published reviews will be exposed
-- via a separate view later (Phase 4) for public browsing.
create policy "public_reviews: select own" on public_reviews
  for select using (auth.uid() = user_id);
create policy "public_reviews: insert own" on public_reviews
  for insert with check (auth.uid() = user_id);
create policy "public_reviews: update own" on public_reviews
  for update using (auth.uid() = user_id);

-- PUBLICATIONS
create policy "publications: select own" on publications
  for select using (auth.uid() = user_id);
create policy "publications: insert own" on publications
  for insert with check (auth.uid() = user_id);
create policy "publications: update own" on publications
  for update using (auth.uid() = user_id);

-- EXPORT JOBS
create policy "export_jobs: select own" on export_jobs
  for select using (auth.uid() = user_id);
create policy "export_jobs: insert own" on export_jobs
  for insert with check (auth.uid() = user_id);
create policy "export_jobs: update own" on export_jobs
  for update using (auth.uid() = user_id);
