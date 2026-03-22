create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  college text not null,
  action_id text not null,
  action text not null,
  why text not null,
  urgency text check (urgency in ('now', 'this_summer', 'senior_year')) not null,
  completed boolean default false not null,
  created_at timestamptz default now(),
  unique(user_id, action_id)
);

alter table checklist_items enable row level security;

create policy "Users can manage their own checklist items"
  on checklist_items for all
  using (auth.uid() = user_id);
