-- Requests to the DM (src/requests): items, effects, abilities and edit approvals, delivered live.
-- Runs after the foundation and sync migrations and reuses its helpers.

-- Who may answer a player's request. Today: any DM account and the admin. Later migrations may
-- widen it (e.g. a party's DM) with create or replace; policies and the guard call this.
create function public.can_answer_request(from_id text, character_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_dm() or is_admin()
$$;
revoke execute on function public.can_answer_request(text, text) from public, anon;
grant execute on function public.can_answer_request(text, text) to authenticated;

-- One row per request. data holds the DmRequest (src/requests/types.ts) without the fields kept in
-- columns, and never the DM's private story note or the player's applied flag.
-- decided_at is the app's ISO string, kept as text so it compares the same on every device.
create table public.dm_requests (
  id text primary key,
  from_id text not null references public.accounts (id),
  character_id text not null,
  data jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'later', 'granted', 'denied')),
  reply text,
  decided_at text,
  -- The player's device added the grant to the character (for an edit: the edit was used).
  applied boolean not null default false,
  updated_at timestamptz not null default now()
);
create index dm_requests_from on public.dm_requests (from_id);
create trigger dm_requests_touch before insert or update on public.dm_requests
  for each row execute function public.touch_updated_at();

-- Each side may only change its own part: the DM the answer, the player the request and applied.
-- Fields the caller may not change keep their old value instead of failing, so either side can
-- send its whole copy. A new request always starts pending, so nobody grants themselves an item.
create function public.dm_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not can_answer_request(new.from_id, new.character_id) then
      new.status := 'pending';
      new.reply := null;
      new.decided_at := null;
    end if;
    if not is_admin() then
      new.applied := false;
    end if;
    return new;
  end if;
  new.from_id := old.from_id;
  if not can_answer_request(old.from_id, old.character_id) then
    new.status := old.status;
    new.reply := old.reply;
    new.decided_at := old.decided_at;
  end if;
  if old.from_id is distinct from current_account_id() and not is_admin() then
    new.character_id := old.character_id;
    new.data := old.data;
    new.applied := old.applied;
  end if;
  return new;
end
$$;
create trigger dm_requests_guard before insert or update on public.dm_requests
  for each row execute function public.dm_requests_guard();

alter table public.dm_requests enable row level security;
revoke all on public.dm_requests from anon;
grant select, insert, update, delete on public.dm_requests to authenticated;
create policy dm_requests_read on public.dm_requests for select to authenticated
  using (from_id = current_account_id() or can_answer_request(from_id, character_id));
create policy dm_requests_insert on public.dm_requests for insert to authenticated
  with check (from_id = current_account_id() or is_admin());
create policy dm_requests_update on public.dm_requests for update to authenticated
  using (from_id = current_account_id() or can_answer_request(from_id, character_id))
  with check (from_id = current_account_id() or can_answer_request(from_id, character_id));
-- A player takes back a request while it waits; the admin can delete any. Clearing an answered
-- request only hides it on that device, so the other side keeps its copy.
create policy dm_requests_delete on public.dm_requests for delete to authenticated
  using ((from_id = current_account_id() and status = 'pending') or is_admin());

alter publication supabase_realtime add table public.dm_requests;
