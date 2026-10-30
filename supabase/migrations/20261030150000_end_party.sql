-- Ending a campaign (src/party/store.ts endParty): its DM, or the admin, deletes the party for everyone.
-- Members, hand-outs, polls and secret rolls go with it (on delete cascade); characters are separate
-- rows owned by their players and stay. Runs after 20261030120000_homebrew_packs.sql.

create function public.end_party(p_party text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from parties where id = p_party and (dm_id = current_account_id() or is_admin())) then
    raise exception 'only the DM can end this campaign';
  end if;
  delete from parties where id = p_party;
end
$$;

revoke execute on function public.end_party(text) from public, anon;
grant execute on function public.end_party(text) to authenticated;
