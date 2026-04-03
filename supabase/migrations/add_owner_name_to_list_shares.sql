alter table list_shares add column owner_name text;

-- Backfill existing shares with owner_email as a fallback
update list_shares set owner_name = owner_email where owner_name is null;

-- Make it not null for new rows
alter table list_shares alter column owner_name set not null;
