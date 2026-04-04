create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'counselor')),
  counselor_id uuid references profiles(id) null,
  invite_code text unique,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read and update own profile"
  on profiles for all using (auth.uid() = id);

create policy "Counselors can read their students"
  on profiles for select
  using (counselor_id = auth.uid());

create or replace function get_my_counselor_id()
returns uuid
language sql
security definer
stable
as $$
  select counselor_id from profiles where id = auth.uid()
$$;

create policy "Students can read their counselor"
  on profiles for select
  using (id = get_my_counselor_id());
