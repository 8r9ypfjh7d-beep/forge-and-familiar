-- Level snapshots and roll history for cloud sync (src/sync/SYNC.md). Characters are in the
-- foundation migration. Uses its helpers current_account_id(), is_admin(), touch_updated_at().

-- Level snapshots (src/portability/snapshots.ts Snapshot) as jsonb. Written once; deleted keeps
-- a tombstone so other devices drop it too.
create table public.snapshots (
  id text primary key,
  owner_id text not null references public.accounts (id),
  character_id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index snapshots_owner_updated on public.snapshots (owner_id, updated_at);
create trigger snapshots_touch before insert or update on public.snapshots
  for each row execute function public.touch_updated_at();

-- Roll history (src/dice/types.ts RollResult). Insert only; rolled_at is the roll's own time.
create table public.rolls (
  id text primary key,
  owner_id text not null references public.accounts (id),
  character_id text,
  data jsonb not null,
  rolled_at timestamptz not null
);
create index rolls_owner_rolled on public.rolls (owner_id, rolled_at desc);

alter table public.snapshots enable row level security;
alter table public.rolls enable row level security;

revoke all on public.snapshots from anon;
grant select, insert, update, delete on public.snapshots to authenticated;
create policy snapshots_own on public.snapshots for all to authenticated
  using (owner_id = current_account_id() or is_admin())
  with check (owner_id = current_account_id() or is_admin());

revoke all on public.rolls from anon;
grant select, insert, delete on public.rolls to authenticated;
create policy rolls_own on public.rolls for all to authenticated
  using (owner_id = current_account_id() or is_admin())
  with check (owner_id = current_account_id() or is_admin());
