-- NPC sheets (src/npc): the DM's own creatures, built from monster stat blocks, with play state.
-- Only the DM can see an NPC's sheet: rows are private to their owner (and the admin). NPCs never
-- enter `characters`, so party members cannot read them through characters_party_read, and their
-- rolls never carry a party character id, so rolls_party_read never shows them either.
-- Runs after 20261030150000_end_party.sql.

-- data is the NpcSheet (src/npc/types.ts). Keyed by owner and NPC id, like homebrew_packs. rev
-- supports conditional writes (update ... where rev = base), deleted keeps a tombstone so every
-- device of the DM drops it too.
create table public.npc_sheets (
  owner_id text not null references public.accounts (id),
  id text not null check (id ~* '^[a-z0-9-]{4,64}$'),
  data jsonb not null check (octet_length(data::text) < 5000000),
  rev integer not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index npc_sheets_owner_updated on public.npc_sheets (owner_id, updated_at);
create trigger npc_sheets_touch before insert or update on public.npc_sheets
  for each row execute function public.touch_updated_at();

alter table public.npc_sheets enable row level security;
revoke all on public.npc_sheets from anon, authenticated;
grant select, insert, update on public.npc_sheets to authenticated;
-- Owner or admin, nothing for party members: the DM decides what players learn through the
-- tracker's player view, never through the sheet.
create policy npc_sheets_read on public.npc_sheets for select to authenticated
  using (owner_id = current_account_id() or is_admin());
create policy npc_sheets_insert on public.npc_sheets for insert to authenticated
  with check (owner_id = current_account_id() or is_admin());
create policy npc_sheets_update on public.npc_sheets for update to authenticated
  using (owner_id = current_account_id() or is_admin())
  with check (owner_id = current_account_id() or is_admin());

alter publication supabase_realtime add table public.npc_sheets;
