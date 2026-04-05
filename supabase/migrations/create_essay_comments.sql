create table essay_comments (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references essays(id) on delete cascade,
  counselor_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  start_offset integer not null,
  end_offset integer not null,
  color_index integer not null default 0,
  resolved boolean not null default false,
  created_at timestamptz default now()
);

alter table essay_comments enable row level security;

create policy "Counselors manage their essay comments"
  on essay_comments for all using (counselor_id = auth.uid());

create policy "Students can view comments on their essays"
  on essay_comments for select using (
    exists (
      select 1 from essays
      where essays.id = essay_comments.essay_id
        and essays.user_id = auth.uid()
    )
  );

create policy "Students can resolve comments on their essays"
  on essay_comments for update using (
    exists (
      select 1 from essays
      where essays.id = essay_comments.essay_id
        and essays.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from essays
      where essays.id = essay_comments.essay_id
        and essays.user_id = auth.uid()
    )
  );
