drop policy if exists "users delete own assistant messages" on public.assistant_messages;
create policy "users delete own assistant messages"
  on public.assistant_messages for delete
  using (auth.uid() = user_id);
