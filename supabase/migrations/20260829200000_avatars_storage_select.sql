-- upsert (used by the avatar upload's `{ upsert: true }`) compiles to
-- INSERT ... ON CONFLICT DO UPDATE, which requires SELECT RLS on the
-- conflict target even when no conflict actually occurs. Without this,
-- every upsert call fails with "new row violates row-level security policy".
create policy avatars_select_own
on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
