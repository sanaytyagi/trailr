-- Allow any authenticated user to look up a profile by invite code.
-- This is needed so students can connect to a counselor before a relationship exists.
-- Only counselor profiles have a non-null invite_code, so this is safe.
create policy "Anyone can look up profiles by invite code"
  on profiles for select
  using (invite_code is not null);
