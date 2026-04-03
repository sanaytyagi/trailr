create table list_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  owner_email text not null,
  shared_with_email text not null,
  shared_with_user_id uuid references auth.users null,
  created_at timestamptz default now(),
  unique (owner_id, shared_with_email)
);

alter table list_shares enable row level security;

-- Owners manage their own shares
create policy "Owners can view their shares"
  on list_shares for select using (auth.uid() = owner_id);

create policy "Owners can insert shares"
  on list_shares for insert with check (auth.uid() = owner_id);

create policy "Owners can delete their shares"
  on list_shares for delete using (auth.uid() = owner_id);

-- Shared users can see shares addressed to them
create policy "Shared users can view their shares"
  on list_shares for select
  using (shared_with_email = auth.email());

-- Allow shared users to read another user's tracked colleges
create policy "Allow shared access to user_colleges"
  on user_colleges for select
  using (
    exists (
      select 1 from list_shares
      where list_shares.owner_id = user_colleges.user_id
      and list_shares.shared_with_email = auth.email()
    )
  );
