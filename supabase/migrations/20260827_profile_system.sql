-- My-Kids-Hub Profile System additive migration.
-- Preserves existing profile data and adds only fields required by the profile/preferences UI.

alter table public.profiles
    add column if not exists address text,
    add column if not exists preferences jsonb not null default '{}'::jsonb;

create index if not exists idx_profiles_preferences on public.profiles using gin(preferences);

-- Avatar storage bucket. Existing files/data are not deleted.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar owners can upload" on storage.objects;
create policy "Avatar owners can upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owners can update" on storage.objects;
create policy "Avatar owners can update" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owners can delete" on storage.objects;
create policy "Avatar owners can delete" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public avatar read" on storage.objects;
create policy "Public avatar read" on storage.objects
for select to public
using (bucket_id = 'avatars');

-- Keep authenticated profile updates scoped to the user's own row.
-- The existing profiles RLS policy remains the authoritative ownership check.
