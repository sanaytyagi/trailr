create table counselor_college_notes (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid references profiles(id) not null,
  student_id uuid references profiles(id) not null,
  college_id text references colleges(id) not null,
  note text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (counselor_id, student_id, college_id)
);

alter table counselor_college_notes enable row level security;

create policy "Counselors manage their own notes"
  on counselor_college_notes for all using (counselor_id = auth.uid());

create policy "Students can read notes about them"
  on counselor_college_notes for select using (student_id = auth.uid());
