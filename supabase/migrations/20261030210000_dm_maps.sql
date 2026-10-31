-- Battle maps the DM draws (src/maps/types.ts BattleMapDef), one row per map, private to the DM and the admin.
-- A running combat copies the map it uses into party_encounters, so players never read this table.
create table public.dm_maps (
  owner_id text not null references public.accounts (id),
  id text not null check (id ~* '^[a-z0-9-]{4,64}$'),
  data jsonb not null check (octet_length(data::text) < 3000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create trigger dm_maps_touch before insert or update on public.dm_maps
  for each row execute function public.touch_updated_at();

alter table public.dm_maps enable row level security;
revoke all on public.dm_maps from anon, authenticated;
grant select, insert, update, delete on public.dm_maps to authenticated;
create policy dm_maps_own on public.dm_maps for all to authenticated
  using (owner_id = current_account_id() or is_admin())
  with check (owner_id = current_account_id() or is_admin());

alter publication supabase_realtime add table public.dm_maps;
