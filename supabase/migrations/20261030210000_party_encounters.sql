-- Live combat (src/combat/live.ts): one row per party holds the combat in progress, so the party
-- sees the battle map, token positions and turn order on their own phones. The DM's device writes
-- the full row; a trigger keeps party_encounters_public, the version players read (no log, no
-- hidden tokens, no tokens under fog, monster HP as a health word). Players move only the token of
-- the character they bring, through move_token. Runs after 20261030150000_end_party.sql.

create table public.party_encounters (
  party_id text primary key references public.parties (id) on delete cascade,
  -- The Encounter (src/combat/types.ts) without its log.
  encounter jsonb not null,
  -- The map definition (src/maps), or null for a map-less combat. map_id lets clients skip
  -- re-downloading a map (pictures are big) when only tokens changed.
  map jsonb,
  map_id text,
  -- Board (src/combat/types.ts): tokens, covered cells, locked flag.
  board jsonb not null default '{"tokens":[],"fog":[],"locked":false}',
  -- Bumped on every change: update ... where rev = base, set rev = base + 1.
  rev integer not null default 1,
  started_at text not null,
  updated_at timestamptz not null default now()
);
create trigger party_encounters_touch before insert or update on public.party_encounters
  for each row execute function public.touch_updated_at();

create table public.party_encounters_public (
  party_id text primary key references public.parties (id) on delete cascade,
  encounter jsonb not null,
  map jsonb,
  map_id text,
  board jsonb not null,
  rev integer not null,
  started_at text not null,
  updated_at timestamptz not null default now()
);

-- healthy / bloodied (half HP or less) / down (0 HP). Mirrors healthOf in src/combat/liveLogic.ts.
create function public.health_word(hp jsonb) returns text
language sql immutable as $$
  select case
    when hp is null then null
    when coalesce((hp->>'current')::numeric, 0) <= 0 then 'down'
    when coalesce((hp->>'current')::numeric, 0) * 2 <= coalesce((hp->>'max')::numeric, 0) then 'bloodied'
    else 'healthy'
  end
$$;

-- Whether a token's anchor cell is one of the covered "x,y" keys (src/maps cellKey).
create function public.token_in_fog(token jsonb, fog jsonb) returns boolean
language sql immutable as $$
  select coalesce(fog, '[]'::jsonb) ? ((token->>'x') || ',' || (token->>'y'))
$$;

-- What players may see. Mirrors projectPublic in src/combat/liveLogic.ts; keep the two in step.
create function public.project_public_encounter(enc jsonb, board jsonb) returns jsonb
language sql immutable as $$
  with hidden as (
    select t->>'combatantId' as cid from jsonb_array_elements(coalesce(board->'tokens', '[]'::jsonb)) t
    where coalesce((t->>'hidden')::boolean, false) or token_in_fog(t, board->'fog')
  )
  select (enc - 'log') || jsonb_build_object('combatants', coalesce((
    select jsonb_agg(
      case when c->>'kind' = 'npc' then (c - 'hp') || jsonb_build_object('health', health_word(c->'hp')) else c end
      order by ord)
    from jsonb_array_elements(coalesce(enc->'combatants', '[]'::jsonb)) with ordinality as e(c, ord)
    where c->>'id' not in (select cid from hidden where cid is not null)
  ), '[]'::jsonb))
$$;

create function public.project_public_board(board jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'tokens', coalesce((
      select jsonb_agg(t - 'hidden' order by ord)
      from jsonb_array_elements(coalesce(board->'tokens', '[]'::jsonb)) with ordinality as e(t, ord)
      where not coalesce((t->>'hidden')::boolean, false) and not token_in_fog(t, board->'fog')
    ), '[]'::jsonb),
    'fog', coalesce(board->'fog', '[]'::jsonb),
    'locked', coalesce(board->'locked', 'false'::jsonb)
  )
$$;

create function public.mirror_party_encounter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from party_encounters_public where party_id = old.party_id;
    return old;
  end if;
  insert into party_encounters_public (party_id, encounter, map, map_id, board, rev, started_at)
  values (new.party_id, project_public_encounter(new.encounter, new.board), new.map, new.map_id,
          project_public_board(new.board), new.rev, new.started_at)
  on conflict (party_id) do update set
    encounter = excluded.encounter, map = excluded.map, map_id = excluded.map_id,
    board = excluded.board, rev = excluded.rev, started_at = excluded.started_at, updated_at = now();
  return new;
end $$;
create trigger party_encounters_mirror after insert or update or delete on public.party_encounters
  for each row execute function public.mirror_party_encounter();

-- A member moves a token: their own character's token any time the board isn't locked, or any
-- token when they are the party's DM. Returns the new rev; raises on an illegal move.
create function public.move_token(p_party text, p_token text, p_x integer, p_y integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
  row_ record;
  tok jsonb;
  idx integer;
  size integer;
  w integer;
  h integer;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into row_ from party_encounters where party_id = p_party for update;
  if not found then raise exception 'no combat'; end if;
  select t, ord - 1 into tok, idx
    from jsonb_array_elements(row_.board->'tokens') with ordinality as e(t, ord) where t->>'id' = p_token;
  if tok is null then raise exception 'no token'; end if;
  if party_dm(p_party) <> me and not is_admin() then
    if not is_party_member(p_party) then raise exception 'not a member'; end if;
    if coalesce((row_.board->>'locked')::boolean, false) then raise exception 'locked'; end if;
    if tok->>'characterId' is null or tok->>'characterId' <> coalesce(
         (select character_id from party_members where party_id = p_party and user_id = me), '') then
      raise exception 'not your token';
    end if;
  end if;
  size := greatest(coalesce((tok->>'size')::integer, 1), 1);
  w := (row_.map->>'width')::integer;
  h := (row_.map->>'height')::integer;
  if p_x < 0 or p_y < 0 or (w is not null and p_x + size > w) or (h is not null and p_y + size > h) then
    raise exception 'off the map';
  end if;
  update party_encounters set
    board = jsonb_set(board, array['tokens', idx::text], tok || jsonb_build_object('x', p_x, 'y', p_y)),
    rev = rev + 1
  where party_id = p_party;
  return row_.rev + 1;
end $$;

alter table public.party_encounters enable row level security;
alter table public.party_encounters_public enable row level security;
revoke all on public.party_encounters from anon, authenticated;
revoke all on public.party_encounters_public from anon, authenticated;
grant select, insert, update, delete on public.party_encounters to authenticated;
grant select on public.party_encounters_public to authenticated;

create policy party_encounters_dm on public.party_encounters for all to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin())
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy party_encounters_public_read on public.party_encounters_public for select to authenticated
  using (is_party_member(party_id) or is_admin());

revoke execute on function public.health_word(jsonb) from public, anon;
revoke execute on function public.token_in_fog(jsonb, jsonb) from public, anon;
revoke execute on function public.project_public_encounter(jsonb, jsonb) from public, anon;
revoke execute on function public.project_public_board(jsonb) from public, anon;
revoke execute on function public.mirror_party_encounter() from public, anon, authenticated;
revoke execute on function public.move_token(text, text, integer, integer) from public, anon;
grant execute on function public.health_word(jsonb) to authenticated;
grant execute on function public.token_in_fog(jsonb, jsonb) to authenticated;
grant execute on function public.project_public_encounter(jsonb, jsonb) to authenticated;
grant execute on function public.project_public_board(jsonb) to authenticated;
grant execute on function public.move_token(text, text, integer, integer) to authenticated;

alter publication supabase_realtime add table public.party_encounters, public.party_encounters_public;
