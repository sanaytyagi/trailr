create table essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id text not null references colleges(id),
  prompt text not null default '',
  word_limit integer not null default 650,
  body text not null default '',
  status text not null default 'not_started'
    check (status in ('not_started', 'drafting', 'final')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table essays enable row level security;

create policy "Users can manage their own essays"
  on essays for all using (auth.uid() = user_id);

create policy "Counselors can read their students essays"
  on essays for select using (
    exists (
      select 1 from profiles
      where profiles.id = essays.user_id
        and profiles.counselor_id = auth.uid()
    )
  );
