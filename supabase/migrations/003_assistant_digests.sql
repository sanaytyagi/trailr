create table if not exists public.assistant_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  content text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_digests_user_idx
  on public.assistant_digests (user_id);

alter table public.assistant_digests enable row level security;

drop policy if exists "users read own digest" on public.assistant_digests;
create policy "users read own digest"
  on public.assistant_digests for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own digest" on public.assistant_digests;
create policy "users insert own digest"
  on public.assistant_digests for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own digest" on public.assistant_digests;
create policy "users update own digest"
  on public.assistant_digests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
