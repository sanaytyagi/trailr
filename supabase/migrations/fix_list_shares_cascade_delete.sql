-- Drop existing foreign key on owner_id and re-add with CASCADE
alter table list_shares drop constraint list_shares_owner_id_fkey;
alter table list_shares
  add constraint list_shares_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;

-- Drop existing foreign key on shared_with_user_id and re-add with CASCADE (if it exists)
alter table list_shares drop constraint if exists list_shares_shared_with_user_id_fkey;
alter table list_shares
  add constraint list_shares_shared_with_user_id_fkey
  foreign key (shared_with_user_id) references auth.users(id) on delete cascade;
