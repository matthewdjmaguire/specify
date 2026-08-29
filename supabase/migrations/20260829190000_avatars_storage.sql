-- SPEC-018: avatar uploads. Bucket is public (so avatar images can be
-- rendered directly via their public URL with no signed-URL plumbing — a
-- profile picture isn't sensitive), but writes are still restricted to each
-- user's own folder via RLS on storage.objects.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update_own
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
