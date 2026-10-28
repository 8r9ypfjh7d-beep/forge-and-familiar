-- Each party has its own DM, chosen when it is made (src/party). The DM pages follow the party a
-- player picks on entering the app, not an account-wide role. Seeds the group's party, Garden Gang,
-- with Noa as DM. Runs after 20261028090000_party_shared.sql.

-- Creating a party names its DM: the creator or any other account. Both join it; others join by code.
drop function public.create_party(text, text, text);
create function public.create_party(p_id text, p_name text, p_code text, p_dm text default null)
returns setof parties
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
  dm text := coalesce(p_dm, current_account_id());
begin
  if me is null then raise exception 'sign in first'; end if;
  if not exists (select 1 from accounts where id = dm) then raise exception 'unknown DM'; end if;
  insert into parties (id, name, code, dm_id, created_at) values (p_id, p_name, p_code, dm, iso_now());
  insert into party_members (party_id, user_id, joined_at) values (p_id, me, iso_now());
  if dm <> me then
    insert into party_members (party_id, user_id, joined_at) values (p_id, dm, iso_now());
  end if;
  return query select * from parties where id = p_id;
end
$$;
revoke execute on function public.create_party(text, text, text, text) from public, anon;
grant execute on function public.create_party(text, text, text, text) to authenticated;

-- Requests go to the DM of a party the player is in (and the admin), no longer to any account
-- with the 'dm' role. A DM who plays in another party doesn't see that party's requests.
create or replace function public.can_answer_request(from_id text, character_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from party_members pm join parties p on p.id = pm.party_id
    where pm.user_id = from_id and p.dm_id = current_account_id()
  )
$$;

-- The group's party: every friend, Noa as DM. Invite code GAR-DEN for anyone added later.
insert into public.parties (id, name, code, dm_id, created_at)
values ('party-garden-gang', 'Garden Gang', 'GARDEN', 'acct-noa', public.iso_now())
on conflict (id) do nothing;
insert into public.party_members (party_id, user_id, joined_at)
select 'party-garden-gang', a.id, public.iso_now() from public.accounts a
where a.id in ('acct-noa', 'acct-ziv', 'acct-roy', 'acct-tamir', 'acct-maayan')
on conflict (party_id, user_id) do nothing;
