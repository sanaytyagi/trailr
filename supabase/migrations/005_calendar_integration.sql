-- user_integrations: stores OAuth tokens per provider (google_calendar, future: outlook, etc.)
create table if not exists public.user_integrations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  provider       text not null,
  access_token   text not null,
  refresh_token  text not null,
  token_expiry   timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(user_id, provider)
);

create index if not exists user_integrations_user_provider_idx
  on public.user_integrations (user_id, provider);

alter table public.user_integrations enable row level security;

drop policy if exists "users read own integrations" on public.user_integrations;
create policy "users read own integrations"
  on public.user_integrations for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own integrations" on public.user_integrations;
create policy "users insert own integrations"
  on public.user_integrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own integrations" on public.user_integrations;
create policy "users update own integrations"
  on public.user_integrations for update
  using (auth.uid() = user_id);

drop policy if exists "users delete own integrations" on public.user_integrations;
create policy "users delete own integrations"
  on public.user_integrations for delete
  using (auth.uid() = user_id);

-- calendar_events: maps (user, college, provider) to the external event ID
create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  college_id  text not null,
  provider    text not null,
  event_id    text not null,
  created_at  timestamptz not null default now(),
  unique(user_id, college_id, provider)
);

create index if not exists calendar_events_user_idx
  on public.calendar_events (user_id, provider);

alter table public.calendar_events enable row level security;

drop policy if exists "users read own calendar events" on public.calendar_events;
create policy "users read own calendar events"
  on public.calendar_events for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own calendar events" on public.calendar_events;
create policy "users insert own calendar events"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own calendar events" on public.calendar_events;
create policy "users update own calendar events"
  on public.calendar_events for update
  using (auth.uid() = user_id);

drop policy if exists "users delete own calendar events" on public.calendar_events;
create policy "users delete own calendar events"
  on public.calendar_events for delete
  using (auth.uid() = user_id);
