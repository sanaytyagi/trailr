create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at);

alter table public.assistant_messages enable row level security;

drop policy if exists "users read own assistant messages" on public.assistant_messages;
create policy "users read own assistant messages"
  on public.assistant_messages for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own assistant messages" on public.assistant_messages;
create policy "users insert own assistant messages"
  on public.assistant_messages for insert
  with check (auth.uid() = user_id);
