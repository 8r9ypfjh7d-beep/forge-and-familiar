-- Forge & Familiar foundation: accounts, sign-in by activation code, characters and DM data.
-- Run once in the Supabase SQL editor (or `supabase db push`). Needs Anonymous sign-ins
-- switched on (Authentication > Sign In / Providers). See supabase/SUPABASE.md.

create extension if not exists pgcrypto with schema extensions;

-- Accounts: the group roster (src/accounts/roster.ts). The id is also the owner of characters,
-- so ids never change. code_hash is SHA-256 of the normalized code and is never readable by clients.
create table public.accounts (
  id text primary key,
  name text not null,
  role text not null check (role in ('player', 'dm')),
  is_admin boolean not null default false,
  code_hash text not null unique
);

-- Which account each signed-in browser belongs to. One anonymous auth user per device.
create table public.account_devices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  account_id text not null references public.accounts (id) on delete cascade,
  linked_at timestamptz not null default now()
);

-- Helpers for policies. Security definer so they can read account_devices and accounts under RLS.
create function public.current_account_id() returns text
language sql stable security definer set search_path = public as $$
  select account_id from account_devices where user_id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select a.is_admin from accounts a where a.id = current_account_id()), false)
$$;

create function public.is_dm() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select a.role = 'dm' from accounts a where a.id = current_account_id()), false)
$$;

-- Links the calling browser to the account whose code it typed. Returns the account, or nothing
-- for a wrong code. Normalizes like normalizeActivationCode() in src/accounts/codes.ts.
create function public.claim_account(code text)
returns table (id text, name text, role text, is_admin boolean)
language plpgsql security definer set search_path = public, extensions as $$
declare
  acct accounts;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  select * into acct from accounts a
  where a.code_hash = encode(digest(upper(regexp_replace(code, '[\s-]', '', 'g')), 'sha256'), 'hex');
  if not found then
    return;
  end if;
  insert into account_devices (user_id, account_id) values (auth.uid(), acct.id)
  on conflict (user_id) do update set account_id = excluded.account_id, linked_at = now();
  return query select acct.id, acct.name, acct.role, acct.is_admin;
end
$$;

-- Bumps updated_at on every write, so clients can pull "changed since".
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Characters: the saved Character (src/model/character.ts) as jsonb. rev supports conditional
-- writes (update ... where rev = base, set rev = base + 1); deleted keeps a tombstone for sync.
create table public.characters (
  id text primary key,
  owner_id text not null references public.accounts (id),
  data jsonb not null,
  rev integer not null default 1,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index characters_owner_updated on public.characters (owner_id, updated_at);
create trigger characters_touch before insert or update on public.characters
  for each row execute function public.touch_updated_at();

-- DM screen state (src/dm/types.ts DmState), one row per account.
create table public.dm_state (
  account_id text primary key references public.accounts (id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger dm_state_touch before insert or update on public.dm_state
  for each row execute function public.touch_updated_at();

-- Row level security. Players see their own rows; the admin (acct-ziv) sees and edits everything.
alter table public.accounts enable row level security;
alter table public.account_devices enable row level security;
alter table public.characters enable row level security;
alter table public.dm_state enable row level security;

revoke all on public.accounts from anon, authenticated;
grant select (id, name, role, is_admin) on public.accounts to authenticated;
create policy accounts_read on public.accounts for select to authenticated
  using (current_account_id() is not null);

revoke all on public.account_devices from anon, authenticated;
grant select, delete on public.account_devices to authenticated;
create policy devices_own on public.account_devices for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy devices_unlink on public.account_devices for delete to authenticated
  using (user_id = auth.uid() or is_admin());

revoke all on public.characters from anon;
grant select, insert, update, delete on public.characters to authenticated;
create policy characters_read on public.characters for select to authenticated
  using (owner_id = current_account_id() or is_admin());
create policy characters_insert on public.characters for insert to authenticated
  with check (owner_id = current_account_id() or is_admin());
create policy characters_update on public.characters for update to authenticated
  using (owner_id = current_account_id() or is_admin())
  with check (owner_id = current_account_id() or is_admin());
create policy characters_delete on public.characters for delete to authenticated
  using (owner_id = current_account_id() or is_admin());

revoke all on public.dm_state from anon;
grant select, insert, update, delete on public.dm_state to authenticated;
create policy dm_state_own on public.dm_state for all to authenticated
  using (account_id = current_account_id() or is_admin())
  with check (account_id = current_account_id() or is_admin());

revoke execute on function public.claim_account(text) from public, anon;
grant execute on function public.claim_account(text) to authenticated;

-- Live updates for the sheet and the admin page.
alter publication supabase_realtime add table public.characters, public.dm_state;

-- The roster. Same hashes as src/accounts/roster.ts; add a friend in both places.
insert into public.accounts (id, name, role, is_admin, code_hash) values
  ('acct-roy', 'Roy', 'player', false, '8196f54313b277689fe88385834829d11c2a50636cda13114ff05480d41ec527'),
  ('acct-tamir', 'Tamir', 'player', false, 'c573c7a3402fb5406e910054f9b3b1ddfac0d12baf7f1d7db4ad74a9167c5cd1'),
  ('acct-maayan', 'Maayan', 'player', false, '419ff4c59e4a8106536af507d328e0f4e3280b2cdb8b76e6c40542df561ecea0'),
  ('acct-ziv', 'Ziv', 'player', true, '611d2899a385ff9f78bbc6b5c7ebee5c41a7c2418e6b42e954cef2539d0351ed'),
  ('acct-noa', 'Noa', 'dm', false, 'ae4fe1d90de28d2e358728882332e14d3d73882f36c1e76d76da2f0363bff646');
