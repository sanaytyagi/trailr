create table if not exists user_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  colleges jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

alter table user_lists enable row level security;

create policy "Users can view their own list"
  on user_lists for select
  using (auth.uid() = user_id);

create policy "Users can insert their own list"
  on user_lists for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own list"
  on user_lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own list"
  on user_lists for delete
  using (auth.uid() = user_id);
