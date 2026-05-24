-- ============================================================================
-- 003_storage_setup.sql
-- Storage buckets + access policies.
--
-- Layout:
--   travel-media/{user_id}/originals/{media_id}.{ext}
--   travel-media/{user_id}/previews/{media_id}.webp
--   travel-media/{user_id}/thumbnails/{media_id}.webp
--   travel-media/{user_id}/covers/{place_id}.webp
--   travel-media/{user_id}/exports/{export_job_id}.zip
--
-- The top-level folder is always the user_id. Storage policies enforce that
-- a user can only access files under their own folder. This makes:
--   • Per-user deletion trivial (rm -rf {user_id}/)
--   • Per-user migration trivial (export from their folder, import to new bucket)
--   • Cost attribution per user clear
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('travel-media', 'travel-media', false, 52428800,  -- 50MB max per file
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: extract first path segment (the user_id) from a storage path
create or replace function storage_user_id_from_path(name text)
returns text language sql immutable as $$
  select split_part(name, '/', 1);
$$;

-- ----------------------------------------------------------------------------
-- STORAGE RLS — same model as the database: user can only touch their own files
-- ----------------------------------------------------------------------------

-- SELECT (read / download via signed URL)
create policy "users read their own media files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'travel-media'
    and storage_user_id_from_path(name) = auth.uid()::text
  );

-- INSERT (upload)
create policy "users upload to their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'travel-media'
    and storage_user_id_from_path(name) = auth.uid()::text
  );

-- UPDATE (overwrite — rare; mostly for re-uploading after metadata extraction)
create policy "users update their own files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'travel-media'
    and storage_user_id_from_path(name) = auth.uid()::text
  );

-- DELETE (hard delete — only via service role normally, but allow user override
-- for explicit emergency cleanup)
create policy "users delete their own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'travel-media'
    and storage_user_id_from_path(name) = auth.uid()::text
  );
