-- My-Kids-Hub: add optional class mapping to existing fee structures.
-- Safe for existing data: no rows are removed or rewritten.
alter table public.fee_structures
add column if not exists class_name text;
