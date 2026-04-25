-- Research briefs: per (user, college) structured dossier
create table if not exists research_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id text not null references colleges(id) on delete cascade,
  status text not null check (status in ('generating', 'ready', 'failed')),
  content jsonb,
  sources jsonb,
  interview_answers jsonb,
  model_version text not null,
  quality_flag text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one active (generating or ready) brief per (user, college)
create unique index if not exists research_briefs_active_unique
  on research_briefs (user_id, college_id)
  where status in ('generating', 'ready');

create index if not exists research_briefs_user_idx
  on research_briefs (user_id, created_at desc);

alter table research_briefs enable row level security;

create policy "own briefs select" on research_briefs
  for select using (auth.uid() = user_id);

create policy "own briefs insert" on research_briefs
  for insert with check (auth.uid() = user_id);

create policy "own briefs update" on research_briefs
  for update using (auth.uid() = user_id);

create policy "own briefs delete" on research_briefs
  for delete using (auth.uid() = user_id);

-- Per-section feedback for brief quality tracking
create table if not exists research_brief_feedback (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references research_briefs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  rating int not null check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (brief_id, section, user_id)
);

alter table research_brief_feedback enable row level security;

create policy "own feedback select" on research_brief_feedback
  for select using (auth.uid() = user_id);

create policy "own feedback insert" on research_brief_feedback
  for insert with check (auth.uid() = user_id);

create policy "own feedback update" on research_brief_feedback
  for update using (auth.uid() = user_id);

create policy "own feedback delete" on research_brief_feedback
  for delete using (auth.uid() = user_id);
