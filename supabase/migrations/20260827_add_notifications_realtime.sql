-- My-Kids-Hub additive production migration.
-- Existing public.profiles remains canonical; no duplicate user profile table is created.

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    message text,
    notification_type text not null default 'info' check (notification_type in ('info','success','warning','danger','fee_due','school_alert')),
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_owner_created on public.notifications(owner_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(owner_id, read_at) where read_at is null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (owner_id = auth.uid() or public.is_admin());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.notifications to authenticated;

drop view if exists public.user_profiles;
create view public.user_profiles with (security_invoker = true) as
select id, full_name, mobile, avatar_url, school_name, school_phone, school_email, school_address, role, terms_accepted, is_active, created_at, updated_at
from public.profiles;

grant select on public.user_profiles to authenticated;

do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='student_fees') then alter publication supabase_realtime add table public.student_fees; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payments') then alter publication supabase_realtime add table public.payments; end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='calendar_events') then alter publication supabase_realtime add table public.calendar_events; end if;
end $$;
