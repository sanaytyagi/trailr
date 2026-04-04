-- Drop the recursive policy that causes infinite recursion
drop policy if exists "Students can read their counselor" on profiles;

-- Create a security definer function to get the current user's counselor_id
-- Security definer bypasses RLS so it won't trigger recursion
create or replace function get_my_counselor_id()
returns uuid
language sql
security definer
stable
as $$
  select counselor_id from profiles where id = auth.uid()
$$;

-- Recreate the policy using the function instead of a subquery on profiles
create policy "Students can read their counselor"
  on profiles for select
  using (id = get_my_counselor_id());
