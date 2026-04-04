create table activity_feed (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) not null,
  counselor_id uuid references profiles(id) not null,
  type text not null,
  college_name text,
  college_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table activity_feed enable row level security;

create policy "Counselors can read their feed"
  on activity_feed for select using (counselor_id = auth.uid());

create policy "Students can read their own feed"
  on activity_feed for select using (student_id = auth.uid());

create policy "Students can insert feed events"
  on activity_feed for insert with check (student_id = auth.uid());

-- Allow counselors to read their students' tracked colleges
create policy "Counselors can read their students colleges"
  on user_colleges for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = user_colleges.user_id
      and profiles.counselor_id = auth.uid()
    )
  );
