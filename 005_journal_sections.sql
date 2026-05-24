-- ============================================================================
-- 005_journal_sections.sql
-- Adds the four-section day journal model on top of visit_days:
--   1. Journal              (the freeform daily entry — already exists as body_markdown)
--   2. Public Publish       (per-day toggle: is this day OK to publish publicly?)
--   3. Key Memories         (bullet list of "things to remember forever")
--   4. Key Points / Places  (bullet list of specific spots visited that day)
--
-- Each list is stored as a jsonb array of {id, text, created_at} objects so we
-- can reorder/delete individual items without rewriting the whole list and so
-- a future feature can attach metadata (photos, ratings, etc.) per item.
-- ============================================================================

-- Per-day publishing toggle. When true, the day is eligible to be exposed via
-- the public_reviews / review_shares system.
alter table visit_days
  add column if not exists is_publishable boolean not null default false,
  add column if not exists key_memories jsonb not null default '[]'::jsonb,
  add column if not exists key_points   jsonb not null default '[]'::jsonb;

-- Optional notes for the publishable variant of the day (don't pollute the
-- private journal with marketing-friendly copy). Empty → fall back to body.
alter table visit_days
  add column if not exists public_summary text;

comment on column visit_days.is_publishable is
  'When true, day appears as a candidate for public_reviews syndication. Default false — private by default.';
comment on column visit_days.key_memories is
  'jsonb array of {id:uuid, text:string, created_at:timestamptz}';
comment on column visit_days.key_points is
  'jsonb array of {id:uuid, text:string, lat?:numeric, lng?:numeric, created_at:timestamptz}';
comment on column visit_days.public_summary is
  'Optional public-friendly summary. Empty → use body_markdown excerpt.';

-- Index to find publishable days quickly (e.g. for "show me everything I''ve
-- marked as shareable across all trips").
create index if not exists visit_days_publishable_idx
  on visit_days(user_id, is_publishable)
  where is_publishable = true and deleted_at is null;
