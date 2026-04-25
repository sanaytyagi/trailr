create table if not exists research_brief_followups (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references research_briefs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists research_brief_followups_brief_idx
  on research_brief_followups (brief_id, created_at asc);

alter table research_brief_followups enable row level security;

create policy "own followups select" on research_brief_followups
  for select using (auth.uid() = user_id);

create policy "own followups insert" on research_brief_followups
  for insert with check (auth.uid() = user_id);

create policy "own followups delete" on research_brief_followups
  for delete using (auth.uid() = user_id);
