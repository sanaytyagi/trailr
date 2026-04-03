-- Trigger to clean up list_shares when a user is deleted
create or replace function delete_shares_for_deleted_user()
returns trigger as $$
begin
  -- Remove any shares where the deleted user was a recipient
  delete from public.list_shares where shared_with_email = old.email;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_user_deleted
  after delete on auth.users
  for each row execute procedure delete_shares_for_deleted_user();
