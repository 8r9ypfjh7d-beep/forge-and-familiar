-- Ended campaigns can come back (src/party/store.ts endParty / restoreParty / deleteParty). Ending now
-- only marks the party: members, stash, lore, maps, polls and rolls all stay, so the DM (or the admin)
-- can bring it back exactly as it was, or delete it for good. While ended, nobody can join it by code
-- and members stop seeing each other's characters and rolls. Runs after 20261031100000_assistant_usage.sql.

alter table public.parties add column ended_at timestamptz;

create or replace function public.end_party(p_party text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from parties where id = p_party and (dm_id = current_account_id() or is_admin())) then
    raise exception 'only the DM can end this campaign';
  end if;
  update parties set ended_at = coalesce(ended_at, now()) where id = p_party;
end
$$;

create function public.restore_party(p_party text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from parties where id = p_party and (dm_id = current_account_id() or is_admin())) then
    raise exception 'only the DM can bring this campaign back';
  end if;
  update parties set ended_at = null where id = p_party;
end
$$;

-- Deleting for good is only for an ended campaign, so one tap can't wipe a running game.
create function public.delete_party(p_party text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from parties where id = p_party and ended_at is not null
                 and (dm_id = current_account_id() or is_admin())) then
    raise exception 'only the DM can delete an ended campaign';
  end if;
  delete from parties where id = p_party;
end
$$;

-- Same as 20261028090000_party_shared.sql (rate limit included), plus: an ended campaign is closed to
-- new players. Members already in it get the party id back, so the app just opens it.
create or replace function public.join_party(p_code text, p_character text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
  pid text;
  ended timestamptz;
begin
  if me is null then raise exception 'sign in first'; end if;
  if (select count(*) from party_join_attempts a where a.account_id = me and a.at > now() - interval '15 minutes') >= 10 then
    raise exception 'too many tries';
  end if;
  select id, ended_at into pid, ended from parties where code = upper(regexp_replace(p_code, '[\s-]', '', 'g'));
  if pid is null then
    insert into party_join_attempts (account_id) values (me);
    delete from party_join_attempts where at < now() - interval '1 day';
    return null;
  end if;
  if ended is not null then
    if exists (select 1 from party_members where party_id = pid and user_id = me) then return pid; end if;
    raise exception 'campaign ended';
  end if;
  insert into party_members (party_id, user_id, character_id, joined_at) values (pid, me, p_character, iso_now())
  on conflict (party_id, user_id) do update
    set character_id = coalesce(excluded.character_id, party_members.character_id);
  update parties set updated_at = now() where id = pid;
  return pid;
end
$$;

-- Sharing characters and rolls only runs while the campaign does.
create or replace function public.sees_party_character(p_owner text, p_character text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_members pm join parties p on p.id = pm.party_id
    where pm.user_id = p_owner and pm.character_id = p_character and p.ended_at is null and is_party_member(pm.party_id)
  )
$$;

create or replace function public.sees_party_roll(p_owner text, p_character text, p_rolled_at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from party_members pm join parties p on p.id = pm.party_id
    where pm.user_id = p_owner and pm.character_id = p_character and p.ended_at is null
      and pm.joined_at::timestamptz <= p_rolled_at and is_party_member(pm.party_id)
  )
$$;

revoke execute on function public.restore_party(text) from public, anon;
revoke execute on function public.delete_party(text) from public, anon;
grant execute on function public.restore_party(text) to authenticated;
grant execute on function public.delete_party(text) to authenticated;
