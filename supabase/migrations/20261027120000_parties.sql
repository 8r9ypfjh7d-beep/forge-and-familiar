-- Parties (src/party): invite codes, members, the shared stash, and what members see of each other:
-- the character each one brings and that character's rolls. Party DMs answer their players' requests.
-- Runs after 20261027110000_dm_requests.sql.

create table public.parties (
  id text primary key,
  name text not null check (length(name) between 1 and 80),
  -- Normalized invite code (src/party/code.ts): 6 chars, no dash.
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  dm_id text not null references public.accounts (id),
  stash jsonb,
  -- Bumped on every stash change: update ... where rev = base, set rev = base + 1.
  rev integer not null default 1,
  created_at text not null,
  updated_at timestamptz not null default now()
);
create trigger parties_touch before insert or update on public.parties
  for each row execute function public.touch_updated_at();

create table public.party_members (
  party_id text not null references public.parties (id) on delete cascade,
  user_id text not null references public.accounts (id),
  -- The character this member brings; null means watching only.
  character_id text,
  -- The app's ISO time, compared with roll timestamps.
  joined_at text not null,
  primary key (party_id, user_id)
);
create index party_members_user on public.party_members (user_id);
create index party_members_character on public.party_members (character_id);

create function public.is_party_member(p_party text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from party_members where party_id = p_party and user_id = current_account_id())
$$;

-- Whether the caller shares a party where that account brings that character.
create function public.sees_party_character(p_owner text, p_character text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_members pm
    where pm.user_id = p_owner and pm.character_id = p_character and is_party_member(pm.party_id)
  )
$$;

-- Same, for a roll: only rolls made after the member joined with that character.
create function public.sees_party_roll(p_owner text, p_character text, p_rolled_at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_members pm
    where pm.user_id = p_owner and pm.character_id = p_character
      and pm.joined_at::timestamptz <= p_rolled_at and is_party_member(pm.party_id)
  )
$$;

-- A party's DM answers requests about the character a member brings to that party.
create or replace function public.can_answer_request(from_id text, character_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_dm() or is_admin() or exists (
    select 1 from party_members pm join parties p on p.id = pm.party_id
    where pm.user_id = from_id and pm.character_id = can_answer_request.character_id and p.dm_id = current_account_id()
  )
$$;

-- Creating, joining and leaving go through these, so codes can't be listed and the DM hand-off
-- rule (src/party/code.ts removeMember) runs in one place.
-- The server's time as the app writes it (ISO, UTC, milliseconds), so nobody backdates a join.
create function public.iso_now() returns text
language sql stable set search_path = public as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create function public.create_party(p_id text, p_name text, p_code text)
returns setof parties
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
begin
  if me is null then raise exception 'sign in first'; end if;
  insert into parties (id, name, code, dm_id, created_at) values (p_id, p_name, p_code, me, iso_now());
  insert into party_members (party_id, user_id, joined_at) values (p_id, me, iso_now());
  return query select * from parties where id = p_id;
end
$$;

-- Joins by code. Returns the party id, or nothing for an unknown code. Joining again only
-- changes the character, like addMember().
create function public.join_party(p_code text, p_character text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
  pid text;
begin
  if me is null then raise exception 'sign in first'; end if;
  select id into pid from parties where code = upper(regexp_replace(p_code, '[\s-]', '', 'g'));
  if pid is null then return null; end if;
  insert into party_members (party_id, user_id, character_id, joined_at) values (pid, me, p_character, iso_now())
  on conflict (party_id, user_id) do update
    set character_id = coalesce(excluded.character_id, party_members.character_id);
  update parties set updated_at = now() where id = pid;
  return pid;
end
$$;

create function public.leave_party(p_party text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
  next_dm text;
begin
  delete from party_members where party_id = p_party and user_id = me;
  if not found then return; end if;
  select user_id into next_dm from party_members where party_id = p_party order by joined_at, user_id limit 1;
  if next_dm is null then
    delete from parties where id = p_party;
  else
    update parties set dm_id = next_dm where id = p_party and dm_id = me;
    update parties set updated_at = now() where id = p_party;
  end if;
end
$$;

alter table public.parties enable row level security;
alter table public.party_members enable row level security;

revoke all on public.parties from anon, authenticated;
grant select on public.parties to authenticated;
grant update (stash, rev) on public.parties to authenticated;
create policy parties_read on public.parties for select to authenticated
  using (is_party_member(id) or is_admin());
create policy parties_stash on public.parties for update to authenticated
  using (is_party_member(id) or is_admin())
  with check (is_party_member(id) or is_admin());

revoke all on public.party_members from anon, authenticated;
grant select on public.party_members to authenticated;
grant update (character_id) on public.party_members to authenticated;
create policy party_members_read on public.party_members for select to authenticated
  using (is_party_member(party_id) or is_admin());
create policy party_members_bring on public.party_members for update to authenticated
  using (user_id = current_account_id())
  with check (user_id = current_account_id());

-- Members see the character each other member brings, and its rolls, for the party table and roll feed.
create policy characters_party_read on public.characters for select to authenticated
  using (sees_party_character(owner_id, id));
create policy rolls_party_read on public.rolls for select to authenticated
  using (character_id is not null and sees_party_roll(owner_id, character_id, rolled_at));

revoke execute on function public.is_party_member(text) from public, anon;
revoke execute on function public.sees_party_character(text, text) from public, anon;
revoke execute on function public.sees_party_roll(text, text, timestamptz) from public, anon;
revoke execute on function public.create_party(text, text, text) from public, anon;
revoke execute on function public.join_party(text, text) from public, anon;
revoke execute on function public.leave_party(text) from public, anon;
grant execute on function public.is_party_member(text) to authenticated;
grant execute on function public.sees_party_character(text, text) to authenticated;
grant execute on function public.sees_party_roll(text, text, timestamptz) to authenticated;
grant execute on function public.create_party(text, text, text) to authenticated;
grant execute on function public.join_party(text, text) to authenticated;
grant execute on function public.leave_party(text) to authenticated;

alter publication supabase_realtime add table public.parties, public.party_members, public.rolls;
