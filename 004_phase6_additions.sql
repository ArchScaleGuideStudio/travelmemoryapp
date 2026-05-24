-- ============================================================================
-- 004_phase6_additions.sql
-- Phase 6 schema additions:
--   1. Video poster frames on media
--   2. Google Place ID matching on places (for syndication)
--   3. Richer publication tracking
--   4. PDF export job format
-- ============================================================================

-- ----------------------------------------------------------------------------
-- MEDIA: video posters and codecs
-- ----------------------------------------------------------------------------

alter table media add column if not exists poster_path text;        -- video poster frame webp
alter table media add column if not exists video_codec text;        -- e.g. 'h264', 'hevc'
alter table media add column if not exists has_audio boolean;

-- ----------------------------------------------------------------------------
-- PLACES: external IDs for cross-platform linking
-- A place can be linked to its Google Maps, OSM, TripAdvisor record so that
-- public reviews can syndicate cleanly without re-matching every time.
-- ----------------------------------------------------------------------------

alter table places add column if not exists google_place_id text;
alter table places add column if not exists tripadvisor_id text;
alter table places add column if not exists external_ids jsonb default '{}';

create index if not exists places_google_id_idx on places(google_place_id) where google_place_id is not null;

-- ----------------------------------------------------------------------------
-- PUBLICATIONS: richer tracking
-- We add `attempt_count`, `next_retry_at`, and `payload` so the publication
-- worker can retry transient failures and we can audit exactly what was sent.
-- ----------------------------------------------------------------------------

alter table publications add column if not exists attempt_count integer not null default 0;
alter table publications add column if not exists next_retry_at timestamptz;
alter table publications add column if not exists payload jsonb;        -- what we tried to send
alter table publications add column if not exists response jsonb;       -- what we got back

-- ----------------------------------------------------------------------------
-- EXPORT JOBS: extended format options
-- ----------------------------------------------------------------------------

-- The existing check constraint allows 'zip', 'pdf', 'json'. Add scoping for
-- "memory book" PDFs which are formatted differently from a plain dump.
alter table export_jobs add column if not exists options jsonb default '{}';
-- options can hold things like:
-- { "include_photos": true, "include_journal": true, "page_size": "A4",
--   "cover_title": "Kashmir Winter '25" }

-- ----------------------------------------------------------------------------
-- PUBLIC REVIEW SHARES: shareable public URLs
-- A user can share a public review via a clean public URL we host. We track
-- view count and ip-based rate-limiting can be added later.
-- ----------------------------------------------------------------------------

create table if not exists review_shares (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  public_review_id uuid not null references public_reviews(id) on delete cascade,
  share_slug      text unique not null,             -- e.g. 'cafe-liberty-srinagar-x7k2'
  is_active       boolean not null default true,
  view_count      integer not null default 0,
  created_at      timestamptz not null default now(),
  last_viewed_at  timestamptz
);

create index if not exists review_shares_slug_idx on review_shares(share_slug) where is_active = true;

alter table review_shares enable row level security;

create policy "review_shares: select own" on review_shares
  for select using (auth.uid() = user_id);
create policy "review_shares: insert own" on review_shares
  for insert with check (auth.uid() = user_id);
create policy "review_shares: update own" on review_shares
  for update using (auth.uid() = user_id);

-- A separate policy allowing anonymous reads of ACTIVE shares (for public viewing).
-- The frontend uses the anon key to fetch by slug.
create policy "review_shares: public read by slug" on review_shares
  for select to anon
  using (is_active = true);

-- Bumps view_count when a public share is fetched.
create or replace function bump_review_share_view(p_slug text)
returns void language plpgsql security definer as $$
begin
  update review_shares
  set view_count = view_count + 1,
      last_viewed_at = now()
  where share_slug = p_slug and is_active = true;
end;
$$;

grant execute on function bump_review_share_view(text) to anon, authenticated;
