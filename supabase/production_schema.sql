-- ============================================================
-- MY-KIDS-HUB - SUPABASE DATABASE SCHEMA
-- ============================================================
-- Run in Supabase SQL Editor as one migration/query.
-- Supabase Auth owns auth.users; do not create auth.users.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    mobile text,
    avatar_url text,
    address text,
    preferences jsonb not null default '{}'::jsonb,
    school_name text,
    school_phone text,
    school_email text,
    school_address text,
    role text not null default 'parent' check (role in ('admin','staff','parent')),
    terms_accepted boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_mobile_check check (mobile is null or mobile ~ '^[6-9][0-9]{9}$')
);

create index if not exists idx_profiles_role on public.profiles(role);

-- ------------------------------------------------------------
-- Common updated_at trigger
-- ------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Auth -> Profile trigger
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_full_name text;
    v_mobile text;
    v_terms_accepted boolean;
begin
    v_full_name := coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'user_name'
    );

    v_mobile := new.raw_user_meta_data ->> 'mobile';

    v_terms_accepted := coalesce(
        (new.raw_user_meta_data ->> 'terms_accepted')::boolean,
        false
    );

    insert into public.profiles (
        id,
        full_name,
        mobile,
        terms_accepted
    )
    values (
        new.id,
        v_full_name,
        v_mobile,
        v_terms_accepted
    )
    on conflict (id) do update
    set
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        mobile = coalesce(excluded.mobile, public.profiles.mobile),
        terms_accepted = excluded.terms_accepted,
        updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for Auth users that existed before this migration.
insert into public.profiles (id, full_name, mobile)
select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.raw_user_meta_data ->> 'mobile'
from auth.users u
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Students
-- ------------------------------------------------------------
create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    admission_number text,
    first_name text not null,
    last_name text,
    date_of_birth date,
    gender text check (gender is null or gender in ('male','female','other')),
    class_name text,
    division text,
    school_name text,
    parent_name text,
    parent_mobile text,
    parent_email text,
    address text,
    status text not null default 'active' check (status in ('active','inactive','left')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(owner_id, admission_number)
);

create index if not exists idx_students_owner_id on public.students(owner_id);
create index if not exists idx_students_status on public.students(status);
create index if not exists idx_students_admission on public.students(admission_number);

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at
before update on public.students
for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Parents
-- ------------------------------------------------------------
create table if not exists public.parents (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    full_name text not null,
    mobile text,
    email text,
    relationship text,
    occupation text,
    address text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_parents_owner_id on public.parents(owner_id);
create index if not exists idx_parents_mobile on public.parents(mobile);

drop trigger if exists parents_updated_at on public.parents;
create trigger parents_updated_at
before update on public.parents
for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Student <-> Parent relationship
-- ------------------------------------------------------------
create table if not exists public.student_parents (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    parent_id uuid not null references public.parents(id) on delete cascade,
    relationship text,
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    unique(student_id, parent_id)
);

create index if not exists idx_student_parents_student on public.student_parents(student_id);
create index if not exists idx_student_parents_parent on public.student_parents(parent_id);

-- ------------------------------------------------------------
-- Fee structures
-- ------------------------------------------------------------
create table if not exists public.fee_structures (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    fee_name text not null,
    description text,
    amount numeric(12,2) not null check (amount >= 0),
    frequency text not null default 'one_time' check (frequency in ('one_time','monthly','quarterly','half_yearly','yearly')),
    academic_year text,
    due_date date,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Class-wise fee structure support. Nullable keeps existing fee records intact.
alter table public.fee_structures
add column if not exists class_name text;

create index if not exists idx_fee_structures_owner on public.fee_structures(owner_id);
create index if not exists idx_fee_structures_active on public.fee_structures(is_active);

drop trigger if exists fee_structures_updated_at on public.fee_structures;
create trigger fee_structures_updated_at
before update on public.fee_structures
for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Student fees
-- ------------------------------------------------------------
create table if not exists public.student_fees (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    fee_structure_id uuid references public.fee_structures(id) on delete set null,
    fee_name text not null,
    amount numeric(12,2) not null check (amount >= 0),
    discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
    final_amount numeric(12,2) generated always as (greatest(amount - discount_amount, 0)) stored,
    due_date date,
    academic_year text,
    status text not null default 'pending' check (status in ('pending','partially_paid','paid','overdue','cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_student_fees_owner on public.student_fees(owner_id);
create index if not exists idx_student_fees_student on public.student_fees(student_id);
create index if not exists idx_student_fees_status on public.student_fees(status);
create index if not exists idx_student_fees_due_date on public.student_fees(due_date);

drop trigger if exists student_fees_updated_at on public.student_fees;
create trigger student_fees_updated_at
before update on public.student_fees
for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Payments
-- ------------------------------------------------------------
create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    student_fee_id uuid references public.student_fees(id) on delete set null,
    amount numeric(12,2) not null check (amount > 0),
    payment_method text not null default 'cash' check (payment_method in ('cash','upi','card','bank_transfer','cheque','online','other')),
    payment_date date not null default current_date,
    transaction_reference text,
    remarks text,
    received_by text,
    created_at timestamptz not null default now()
);

create index if not exists idx_payments_owner on public.payments(owner_id);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_payments_fee on public.payments(student_fee_id);
create index if not exists idx_payments_date on public.payments(payment_date);
create unique index if not exists idx_payments_transaction_reference
on public.payments(owner_id, transaction_reference)
where transaction_reference is not null;

-- ------------------------------------------------------------
-- Reminders
-- ------------------------------------------------------------
create table if not exists public.reminders (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    student_id uuid references public.students(id) on delete cascade,
    student_fee_id uuid references public.student_fees(id) on delete cascade,
    reminder_type text not null default 'fee_due',
    title text,
    message text,
    reminder_date timestamptz not null,
    status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_reminders_owner on public.reminders(owner_id);
create index if not exists idx_reminders_date on public.reminders(reminder_date);
create index if not exists idx_reminders_status on public.reminders(status);

-- ------------------------------------------------------------
-- Calendar events
-- ------------------------------------------------------------
create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    description text,
    event_date date not null,
    start_time time,
    end_time time,
    event_type text not null default 'general',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_owner on public.calendar_events(owner_id);
create index if not exists idx_calendar_events_date on public.calendar_events(event_date);

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- RLS helper
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
          and is_active = true
    );
$$;

-- ------------------------------------------------------------
-- Enable RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parents enable row level security;
alter table public.fee_structures enable row level security;
alter table public.student_fees enable row level security;
alter table public.payments enable row level security;
alter table public.reminders enable row level security;
alter table public.calendar_events enable row level security;

-- ------------------------------------------------------------
-- Profiles policies
-- ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Students policies
-- ------------------------------------------------------------
drop policy if exists students_select on public.students;
create policy students_select on public.students
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists students_insert on public.students;
create policy students_insert on public.students
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists students_update on public.students;
create policy students_update on public.students
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists students_delete on public.students;
create policy students_delete on public.students
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Parents policies
-- ------------------------------------------------------------
drop policy if exists parents_select on public.parents;
create policy parents_select on public.parents
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists parents_insert on public.parents;
create policy parents_insert on public.parents
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists parents_update on public.parents;
create policy parents_update on public.parents
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists parents_delete on public.parents;
create policy parents_delete on public.parents
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Student-parent policies
-- ------------------------------------------------------------
drop policy if exists student_parents_select on public.student_parents;
create policy student_parents_select on public.student_parents
for select to authenticated
using (
    exists (
        select 1 from public.students s
        where s.id = student_parents.student_id
          and (s.owner_id = auth.uid() or public.is_admin())
    )
);

drop policy if exists student_parents_insert on public.student_parents;
create policy student_parents_insert on public.student_parents
for insert to authenticated
with check (
    exists (
        select 1 from public.students s
        where s.id = student_parents.student_id
          and (s.owner_id = auth.uid() or public.is_admin())
    )
    and exists (
        select 1 from public.parents p
        where p.id = student_parents.parent_id
          and (p.owner_id = auth.uid() or public.is_admin())
    )
);

drop policy if exists student_parents_update on public.student_parents;
create policy student_parents_update on public.student_parents
for update to authenticated
using (
    exists (
        select 1 from public.students s
        where s.id = student_parents.student_id
          and (s.owner_id = auth.uid() or public.is_admin())
    )
)
with check (
    exists (
        select 1 from public.students s
        where s.id = student_parents.student_id
          and (s.owner_id = auth.uid() or public.is_admin())
    )
);

drop policy if exists student_parents_delete on public.student_parents;
create policy student_parents_delete on public.student_parents
for delete to authenticated
using (
    exists (
        select 1 from public.students s
        where s.id = student_parents.student_id
          and (s.owner_id = auth.uid() or public.is_admin())
    )
);

-- ------------------------------------------------------------
-- Fee structure policies
-- ------------------------------------------------------------
drop policy if exists fee_structures_select on public.fee_structures;
create policy fee_structures_select on public.fee_structures
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists fee_structures_insert on public.fee_structures;
create policy fee_structures_insert on public.fee_structures
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists fee_structures_update on public.fee_structures;
create policy fee_structures_update on public.fee_structures
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists fee_structures_delete on public.fee_structures;
create policy fee_structures_delete on public.fee_structures
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Student fee policies
-- ------------------------------------------------------------
drop policy if exists student_fees_select on public.student_fees;
create policy student_fees_select on public.student_fees
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists student_fees_insert on public.student_fees;
create policy student_fees_insert on public.student_fees
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists student_fees_update on public.student_fees;
create policy student_fees_update on public.student_fees
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists student_fees_delete on public.student_fees;
create policy student_fees_delete on public.student_fees
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Payment policies
-- ------------------------------------------------------------
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Reminder policies
-- ------------------------------------------------------------
drop policy if exists reminders_select on public.reminders;
create policy reminders_select on public.reminders
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists reminders_insert on public.reminders;
create policy reminders_insert on public.reminders
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists reminders_update on public.reminders;
create policy reminders_update on public.reminders
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists reminders_delete on public.reminders;
create policy reminders_delete on public.reminders
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Calendar policies
-- ------------------------------------------------------------
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.parents to authenticated;
grant select, insert, update, delete on public.student_parents to authenticated;
grant select, insert, update, delete on public.fee_structures to authenticated;
grant select, insert, update, delete on public.student_fees to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;

-- ------------------------------------------------------------
-- Force RLS
-- ------------------------------------------------------------
alter table public.profiles force row level security;
alter table public.students force row level security;
alter table public.parents force row level security;
alter table public.student_parents force row level security;
alter table public.fee_structures force row level security;
alter table public.student_fees force row level security;
alter table public.payments force row level security;
alter table public.reminders force row level security;
alter table public.calendar_events force row level security;

-- ------------------------------------------------------------
-- Verification queries
-- ------------------------------------------------------------
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
and table_type = 'BASE TABLE'
order by table_name;

select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select trigger_name, event_object_schema, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_name = 'on_auth_user_created';

-- ============================================================
-- My-Kids-Hub Production Additions
-- ============================================================
-- Existing public.profiles remains the canonical user profile table.
-- A compatibility view named user_profiles is provided for integrations
-- that use that terminology; application code continues using profiles.
-- ============================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    message text,
    notification_type text not null default 'info' check (notification_type in ('info','success','warning','danger','fee_due','school_alert')),
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_owner_created
on public.notifications(owner_id, created_at desc);

create index if not exists idx_notifications_unread
on public.notifications(owner_id, read_at)
where read_at is null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
for insert to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.notifications to authenticated;

-- Compatibility view. Do not duplicate profile data into another table.
drop view if exists public.user_profiles;
create view public.user_profiles
with (security_invoker = true)
as
select
    id,
    full_name,
    mobile,
    avatar_url,
    address,
    preferences,
    school_name,
    school_phone,
    school_email,
    school_address,
    role,
    terms_accepted,
    is_active,
    created_at,
    updated_at
from public.profiles;

grant select on public.user_profiles to authenticated;

-- Keep live dashboard modules synchronized through Supabase Realtime.
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'student_fees'
    ) then
        alter publication supabase_realtime add table public.student_fees;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'payments'
    ) then
        alter publication supabase_realtime add table public.payments;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'calendar_events'
    ) then
        alter publication supabase_realtime add table public.calendar_events;
    end if;
end $$;
