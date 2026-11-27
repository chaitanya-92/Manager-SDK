-- Run once in a dedicated Manager-SDK Supabase project. No public access.
begin;
create table if not exists public.manager_sdk_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  config jsonb not null,
  constraint manager_sdk_config_object check (jsonb_typeof(config) = 'object'),
  constraint manager_sdk_config_size check (octet_length(config::text) <= 740000)
);
alter table public.manager_sdk_projects enable row level security;
revoke all on public.manager_sdk_projects from public, anon, authenticated, service_role;
grant select, insert on public.manager_sdk_projects to service_role;
commit;
