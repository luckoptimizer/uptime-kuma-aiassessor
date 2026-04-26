-- Status page monitor persistence for status.aiassessor.ca
-- Applied to project ctxcznwnjliuywwucamr on 2026-04-25.
-- This file is the in-repo parity copy of what was applied via Supabase MCP.

create table if not exists public.status_monitors (
  id text primary key,
  name text not null,
  target text not null,
  type text not null check (type in ('HTTP','TLS','Database','http','tls','database')),
  paused boolean not null default false,
  interval_seconds integer not null default 60,
  last_status text,
  last_response_time_ms integer,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_status_monitors_updated_at
  on public.status_monitors (updated_at desc);

-- updated_at trigger
create or replace function public.set_status_monitors_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_status_monitors_updated_at on public.status_monitors;
create trigger set_status_monitors_updated_at
  before update on public.status_monitors
  for each row execute function public.set_status_monitors_updated_at();

-- RLS: only service_role can read/write. The status server uses the
-- service_role key from the Render backend; the public site never
-- calls Supabase directly.
alter table public.status_monitors enable row level security;

drop policy if exists "service_role full access" on public.status_monitors;
create policy "service_role full access"
  on public.status_monitors
  for all
  to service_role
  using (true)
  with check (true);
