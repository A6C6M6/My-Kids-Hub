-- My-Kids-Hub: Settings school information fields.
-- Safe additive migration; existing profile data is preserved.
alter table public.profiles add column if not exists school_name text;
alter table public.profiles add column if not exists school_phone text;
alter table public.profiles add column if not exists school_email text;
alter table public.profiles add column if not exists school_address text;
