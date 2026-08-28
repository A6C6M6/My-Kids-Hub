-- My-Kids-Hub additive Student photo support.
-- Existing student rows/data are preserved; photo_url is nullable.

alter table public.students
    add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Student photo owners can upload" on storage.objects;
create policy "Student photo owners can upload" on storage.objects
for insert to authenticated
with check (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Student photo owners can update" on storage.objects;
create policy "Student photo owners can update" on storage.objects
for update to authenticated
using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Student photo owners can delete" on storage.objects;
create policy "Student photo owners can delete" on storage.objects
for delete to authenticated
using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public student photo read" on storage.objects;
create policy "Public student photo read" on storage.objects
for select to public
using (bucket_id = 'student-photos');
