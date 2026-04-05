create table essay_notes (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references essays(id) on delete cascade,
  counselor_id uuid not null references profiles(id) on delete cascade,
  note text not null default '',
  created_at timestamptz default now(),
  unique (essay_id, counselor_id)
);

alter table essay_notes enable row level security;

create policy "Counselors manage their own essay notes"
  on essay_notes for all using (counselor_id = auth.uid());

create policy "Students can read essay notes on their essays"
  on essay_notes for select using (
    exists (
      select 1 from essays
      where essays.id = essay_notes.essay_id
        and essays.user_id = auth.uid()
    )
  );
