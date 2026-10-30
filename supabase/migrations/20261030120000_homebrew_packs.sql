-- Homebrew packs (src/homebrew) in the cloud: each account's library follows it to every device,
-- and party members read each other's packs so the DM and other players can resolve a character's
-- homebrew subclass, class, race, items and feats. Runs after 20261028100000_party_dm.sql.

-- data is the HomebrewPack (src/homebrew/types.ts) without history. Keyed by owner and pack id:
-- a friend's pack in my library is my copy of it. Last pack updatedAt wins (src/sync/packs.ts);
-- deleted keeps a tombstone so other devices drop it too.
create table public.homebrew_packs (
  owner_id text not null references public.accounts (id),
  id text not null check (id ~* '^[a-z0-9-]{4,64}$'),
  data jsonb not null check (octet_length(data::text) < 5000000),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index homebrew_packs_updated on public.homebrew_packs (updated_at);
create trigger homebrew_packs_touch before insert or update on public.homebrew_packs
  for each row execute function public.touch_updated_at();

-- Whether the caller is in a party with that account.
create function public.shares_party(p_other text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_members them join party_members me on me.party_id = them.party_id
    where them.user_id = p_other and me.user_id = current_account_id()
  )
$$;
revoke execute on function public.shares_party(text) from public, anon;
grant execute on function public.shares_party(text) to authenticated;

alter table public.homebrew_packs enable row level security;
revoke all on public.homebrew_packs from anon, authenticated;
grant select, insert, update on public.homebrew_packs to authenticated;
create policy homebrew_packs_read on public.homebrew_packs for select to authenticated
  using (owner_id = current_account_id() or is_admin() or shares_party(owner_id));
create policy homebrew_packs_insert on public.homebrew_packs for insert to authenticated
  with check (owner_id = current_account_id());
create policy homebrew_packs_update on public.homebrew_packs for update to authenticated
  using (owner_id = current_account_id())
  with check (owner_id = current_account_id());

alter publication supabase_realtime add table public.homebrew_packs;
