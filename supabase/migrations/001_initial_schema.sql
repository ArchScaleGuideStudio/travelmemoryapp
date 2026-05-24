-- ============================================================================
-- 001_initial_schema.sql
-- Travel Atlas — initial database schema
--
-- Design principles:
--   1. Soft delete EVERYWHERE on user data — `deleted_at` instead of DELETE
--   2. Every user-owned table has user_id matching auth.uid()
--   3. Geographic reference data (continents, countries, regions, cities)
--      is shared across all users — read-only for everyone
--   4. Timestamps on every table: created_at, updated_at
--   5. UUIDs as primary keys (avoids leaking row counts, easier to migrate)
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for fuzzy text search later

-- ----------------------------------------------------------------------------
-- GEOGRAPHIC REFERENCE DATA (shared, read-only for users)
-- ----------------------------------------------------------------------------

create table continents (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null unique,
  slug         text not null unique,
  created_at   timestamptz not null default now()
);

create table countries (
  id              uuid primary key default uuid_generate_v4(),
  continent_id    uuid not null references continents(id),
  name            text not null,
  iso_a2          char(2) unique,             -- ISO 3166-1 alpha-2 (e.g. 'IN')
  iso_a3          char(3) unique,             -- ISO 3166-1 alpha-3 (e.g. 'IND')
  default_lat     double precision,
  default_lng     double precision,
  alt_names       text[],
  created_at      timestamptz not null default now()
);

create index countries_continent_idx on countries(continent_id);
create index countries_name_trgm_idx on countries using gin (name gin_trgm_ops);

create table regions (
  id              uuid primary key default uuid_generate_v4(),
  country_id      uuid not null references countries(id),
  name            text not null,
  region_type     text,                       -- 'state' | 'province' | 'territory' | etc.
  default_lat     double precision,
  default_lng     double precision,
  created_at      timestamptz not null default now()
);

create index regions_country_idx on regions(country_id);
create index regions_name_trgm_idx on regions using gin (name gin_trgm_ops);

create table cities (
  id              uuid primary key default uuid_generate_v4(),
  region_id       uuid references regions(id),
  country_id      uuid not null references countries(id),
  name            text not null,
  lat             double precision not null,
  lng             double precision not null,
  population      integer,
  alt_names       text[],
  external_ids    jsonb default '{}',         -- {nominatim: '...', google_place: '...'}
  created_at      timestamptz not null default now()
);

create index cities_region_idx on cities(region_id);
create index cities_country_idx on cities(country_id);
create index cities_name_trgm_idx on cities using gin (name gin_trgm_ops);
create index cities_location_idx on cities using gist (
  point(lng, lat)
);

-- ----------------------------------------------------------------------------
-- USER PROFILES (extends auth.users)
-- ----------------------------------------------------------------------------

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,
  display_name    text,
  avatar_url      text,
  bio             text,
  home_country_id uuid references countries(id),
  preferences     jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user is created
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- USER-OWNED CORE DATA
-- ----------------------------------------------------------------------------

-- A `place` is a user's personalized record of a city they've visited.
-- Multiple visits to Delhi over years all share one Place; each visit is a
-- separate row in `visits`.
create table places (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  city_id         uuid references cities(id),     -- nullable: user can add custom places
  custom_name     text,                            -- when city_id is null (e.g. "Auli Ski Slopes")
  lat             double precision not null,
  lng             double precision not null,
  locality        text,                            -- neighborhood, area
  cover_media_id  uuid,                            -- FK added after media table created
  visit_count     integer not null default 0,      -- denormalized, kept in sync via trigger
  first_visited_at  date,
  last_visited_at   date,
  notes_summary   text,                            -- one-line summary; the full per-visit/day notes live elsewhere
  visibility      text not null default 'private'
                  check (visibility in ('private', 'unlisted', 'public')),
  is_favourite    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index places_user_idx on places(user_id) where deleted_at is null;
create index places_city_idx on places(city_id);
create index places_favourite_idx on places(user_id, is_favourite) where deleted_at is null and is_favourite = true;

-- A `trip` is a named container — "Kashmir Winter '25" — that groups multiple
-- visits across multiple cities. A visit always belongs to a trip (even if
-- it's an auto-created single-place trip).
create table trips (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  travel_type     text not null default 'leisure'
                  check (travel_type in (
                    'family', 'business', 'solo', 'pilgrimage', 'leisure',
                    'event', 'road_trip', 'staycation', 'work', 'other'
                  )),
  start_date      date,
  end_date        date,
  cover_media_id  uuid,                          -- FK added after media table
  color_tag       text,                           -- hex color for visual identification
  visibility      text not null default 'private'
                  check (visibility in ('private', 'unlisted', 'public')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index trips_user_idx on trips(user_id) where deleted_at is null;
create index trips_dates_idx on trips(user_id, start_date desc) where deleted_at is null;

-- A `visit` is one stay at one place as part of one trip.
-- Same trip can have multiple visits (Delhi → Jaipur → Udaipur within one trip).
-- Same place can be visited on multiple trips across years.
create table visits (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  trip_id         uuid not null references trips(id) on delete cascade,
  place_id        uuid not null references places(id) on delete cascade,
  arrival_date    date not null,
  departure_date  date,
  order_in_trip   integer not null default 0,
  summary_notes   text,                            -- overall impression of this visit
  cover_media_id  uuid,                            -- FK added after media table
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index visits_user_idx on visits(user_id) where deleted_at is null;
create index visits_trip_idx on visits(trip_id) where deleted_at is null;
create index visits_place_idx on visits(place_id) where deleted_at is null;
create unique index visits_trip_order_unq on visits(trip_id, order_in_trip) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- VISIT DAYS — per-day journal entries within a visit
-- A 7-day visit can have 7 day rows. Each day has its own journal, weather,
-- companions, and can group photos by day.
-- ----------------------------------------------------------------------------

create table visit_days (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  visit_id        uuid not null references visits(id) on delete cascade,
  day_number      integer not null,               -- 1, 2, 3, ...
  date            date not null,
  title           text,                            -- "Day 2 — Gulmarg Gondola"
  body_markdown   text,                            -- the journal entry
  weather         text,                            -- 'sunny', 'snow', etc. — freeform
  temperature_c   integer,
  mood            text,                            -- emoji or short word
  companions      text[],                          -- ['mom', 'dad', 'sister']
  expenses_inr    integer,                         -- daily spend (optional, integer paise/cents-ish)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index visit_days_visit_idx on visit_days(visit_id) where deleted_at is null;
create index visit_days_user_idx on visit_days(user_id) where deleted_at is null;
create unique index visit_days_unq on visit_days(visit_id, day_number) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- MEDIA — photos and videos
-- Originals are never modified; previews/thumbnails are derived.
-- ----------------------------------------------------------------------------

create table media (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  place_id        uuid references places(id) on delete set null,
  visit_id        uuid references visits(id) on delete set null,
  visit_day_id    uuid references visit_days(id) on delete set null,
  trip_id         uuid references trips(id) on delete set null,

  kind            text not null check (kind in ('photo', 'video')),

  -- Storage paths (provider-agnostic — we record provider separately)
  storage_provider  text not null default 'supabase',
  original_path     text not null,
  preview_path      text,        -- ~1600px webp
  thumbnail_path    text,        -- ~400px webp

  -- File metadata
  width             integer,
  height            integer,
  duration_seconds  numeric(8,2),       -- for video
  file_size_bytes   bigint,
  mime_type         text,
  original_filename text,

  -- Content metadata
  taken_at          timestamptz,        -- from EXIF if available, else upload time
  captured_lat      double precision,   -- from EXIF GPS
  captured_lng      double precision,
  caption           text,
  alt_text          text,                -- accessibility

  -- Duplicate detection
  perceptual_hash   text,                -- pHash for similarity search
  content_hash      text,                -- sha256 of original bytes, exact-dup check

  -- EXIF + any other metadata kept as JSON for future use
  exif              jsonb default '{}',

  -- Flags
  is_cover          boolean not null default false,

  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index media_user_idx on media(user_id) where deleted_at is null;
create index media_place_idx on media(place_id) where deleted_at is null;
create index media_visit_idx on media(visit_id) where deleted_at is null;
create index media_day_idx on media(visit_day_id) where deleted_at is null;
create index media_taken_idx on media(user_id, taken_at desc) where deleted_at is null;
create index media_content_hash_idx on media(user_id, content_hash) where deleted_at is null;
create index media_phash_idx on media(user_id, perceptual_hash) where deleted_at is null and perceptual_hash is not null;

-- Now we can add the FKs that previously couldn't reference media
alter table places  add constraint places_cover_media_fk  foreign key (cover_media_id) references media(id) on delete set null;
alter table trips   add constraint trips_cover_media_fk   foreign key (cover_media_id) references media(id) on delete set null;
alter table visits  add constraint visits_cover_media_fk  foreign key (cover_media_id) references media(id) on delete set null;

-- ----------------------------------------------------------------------------
-- NOTES — long-form journal entries (separate from per-day journals)
-- A note can be attached to a place, trip, or visit. This is for entries that
-- don't fit the day-by-day structure.
-- ----------------------------------------------------------------------------

create table notes (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  place_id        uuid references places(id) on delete cascade,
  trip_id         uuid references trips(id) on delete cascade,
  visit_id        uuid references visits(id) on delete cascade,
  title           text,
  body_markdown   text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- Must belong to at least one of place/trip/visit
  check (place_id is not null or trip_id is not null or visit_id is not null)
);

create index notes_user_idx on notes(user_id) where deleted_at is null;
create index notes_place_idx on notes(place_id) where deleted_at is null;
create index notes_trip_idx on notes(trip_id) where deleted_at is null;
create index notes_visit_idx on notes(visit_id) where deleted_at is null;

-- Note version history — append-only, capped at 20 versions per note
create table note_versions (
  id              uuid primary key default uuid_generate_v4(),
  note_id         uuid not null references notes(id) on delete cascade,
  body_markdown   text not null,
  version_number  integer not null,
  saved_at        timestamptz not null default now(),
  saved_by        uuid not null references auth.users(id)
);

create index note_versions_note_idx on note_versions(note_id, version_number desc);

-- ----------------------------------------------------------------------------
-- TAGS — polymorphic; can be attached to places, trips, visits, or media
-- ----------------------------------------------------------------------------

create table tags (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  color           text,                            -- hex
  created_at      timestamptz not null default now(),
  unique (user_id, name)
);

create table taggables (
  id              uuid primary key default uuid_generate_v4(),
  tag_id          uuid not null references tags(id) on delete cascade,
  target_type     text not null check (target_type in ('place', 'trip', 'visit', 'media')),
  target_id       uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (tag_id, target_type, target_id)
);

create index taggables_target_idx on taggables(target_type, target_id);
create index taggables_user_idx on taggables(user_id);

-- ----------------------------------------------------------------------------
-- ALBUMS — user-curated collections of media (cross-trip, cross-place)
-- ----------------------------------------------------------------------------

create table albums (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text,
  cover_media_id  uuid references media(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table album_media (
  id              uuid primary key default uuid_generate_v4(),
  album_id        uuid not null references albums(id) on delete cascade,
  media_id        uuid not null references media(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  order_index     integer not null default 0,
  caption_override text,
  created_at      timestamptz not null default now(),
  unique (album_id, media_id)
);

create index album_media_album_idx on album_media(album_id, order_index);

-- ----------------------------------------------------------------------------
-- SLIDESHOWS — saved slideshow configurations
-- ----------------------------------------------------------------------------

create table slideshows (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  source_type           text check (source_type in ('place', 'trip', 'visit', 'album', 'custom')),
  source_id             uuid,                       -- nullable for 'custom'
  duration_per_slide_ms integer not null default 4000,
  transition_type       text default 'fade',         -- 'fade' | 'slide' | 'none'
  music_url             text,                        -- Phase 3
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create table slideshow_items (
  id                uuid primary key default uuid_generate_v4(),
  slideshow_id      uuid not null references slideshows(id) on delete cascade,
  media_id          uuid not null references media(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  order_index       integer not null,
  caption_override  text,
  duration_override_ms integer
);

create index slideshow_items_show_idx on slideshow_items(slideshow_id, order_index);

-- ----------------------------------------------------------------------------
-- PUBLIC REVIEWS — content the user wants to publish to the world
-- Separate from private journal. Different schema, different tone, different purpose.
-- ----------------------------------------------------------------------------

create table public_reviews (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  place_id            uuid references places(id) on delete cascade,
  visit_id            uuid references visits(id) on delete cascade,

  title               text not null,
  body_markdown       text not null,
  summary             text,                          -- TL;DR (for cards/search)

  rating_overall      smallint check (rating_overall between 1 and 5),
  rating_food         smallint check (rating_food between 1 and 5),
  rating_value        smallint check (rating_value between 1 and 5),
  rating_atmosphere   smallint check (rating_atmosphere between 1 and 5),

  price_level         smallint check (price_level between 1 and 4),
  visit_purpose       text check (visit_purpose in (
                        'food', 'lodging', 'attraction', 'shopping',
                        'transit', 'experience', 'nature', 'other'
                      )),

  tags                text[],
  recommended_for     text[],                        -- ['solo', 'families', 'couples', 'kids']
  best_time_to_visit  text,
  accessibility_notes text,
  opening_hours       jsonb,
  contact             jsonb,                         -- {phone, website, instagram}

  hero_media_id       uuid references media(id) on delete set null,
  gallery_media_ids   uuid[],                        -- ordered, references media.id

  -- Linking to external places
  google_place_id     text,
  osm_place_id        text,

  status              text not null default 'draft'
                      check (status in ('draft', 'ready', 'published', 'archived')),
  language            text not null default 'en',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  published_at        timestamptz,
  deleted_at          timestamptz
);

create index public_reviews_user_idx on public_reviews(user_id) where deleted_at is null;
create index public_reviews_status_idx on public_reviews(status) where deleted_at is null;
create index public_reviews_place_idx on public_reviews(place_id) where deleted_at is null;

-- Where a public review has been syndicated to
create table publications (
  id                  uuid primary key default uuid_generate_v4(),
  public_review_id    uuid not null references public_reviews(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  platform            text not null check (platform in (
                        'google_maps', 'app_website', 'tripadvisor', 'instagram', 'medium', 'other'
                      )),
  external_id         text,                          -- platform's ID for the published item
  external_url        text,
  status              text not null default 'queued'
                      check (status in ('queued', 'sent', 'live', 'failed', 'removed')),
  error_message       text,
  queued_at           timestamptz not null default now(),
  published_at        timestamptz
);

create index publications_review_idx on publications(public_review_id);
create index publications_status_idx on publications(status) where status in ('queued', 'sent');

-- ----------------------------------------------------------------------------
-- EXPORT JOBS — async ZIP generation tracking
-- ----------------------------------------------------------------------------

create table export_jobs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  scope           text not null default 'everything'
                  check (scope in ('everything', 'trip', 'place', 'album', 'date_range')),
  scope_id        uuid,                              -- ID of trip/place/album if scoped
  format          text not null default 'zip' check (format in ('zip', 'pdf', 'json')),
  status          text not null default 'queued'
                  check (status in ('queued', 'running', 'completed', 'failed')),
  file_path       text,                              -- storage path when complete
  file_size_bytes bigint,
  expires_at      timestamptz,                       -- exports auto-delete after 7 days
  error_message   text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index export_jobs_user_idx on export_jobs(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- AUTO-UPDATE updated_at on every UPDATE
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'profiles', 'places', 'trips', 'visits', 'visit_days',
      'notes', 'albums', 'slideshows', 'public_reviews'
    ])
  loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
       for each row execute function set_updated_at()',
       t, t
    );
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- DENORMALIZED COUNTERS — keep places.visit_count in sync with visits
-- ----------------------------------------------------------------------------

create or replace function recompute_place_visit_counts()
returns trigger language plpgsql as $$
declare
  target_place_id uuid;
begin
  target_place_id := coalesce(new.place_id, old.place_id);
  update places
  set visit_count = (
    select count(*) from visits
    where place_id = target_place_id and deleted_at is null
  ),
  first_visited_at = (
    select min(arrival_date) from visits
    where place_id = target_place_id and deleted_at is null
  ),
  last_visited_at = (
    select max(coalesce(departure_date, arrival_date)) from visits
    where place_id = target_place_id and deleted_at is null
  )
  where id = target_place_id;
  return null;
end;
$$;

create trigger visits_recount
  after insert or update or delete on visits
  for each row execute function recompute_place_visit_counts();
