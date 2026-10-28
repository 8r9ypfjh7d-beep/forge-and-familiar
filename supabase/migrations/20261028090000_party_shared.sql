-- What a party shares besides members and the stash: secret rolls to the DM (src/dice/secret.ts),
-- hand-outs (src/handouts), session polls (src/schedule). Also limits guesses at invite codes.
-- Runs after 20261027130000_guard_grants.sql.

-- ---------- Invite code guesses ----------

-- Wrong invite codes, for the rate limit. No client access.
create table public.party_join_attempts (
  account_id text not null,
  at timestamptz not null default now()
);
create index party_join_attempts_at on public.party_join_attempts (account_id, at);
alter table public.party_join_attempts enable row level security;
revoke all on public.party_join_attempts from anon, authenticated;

-- Same contract as before. Raises 'too many tries' after 10 wrong codes from one account in 15 minutes.
create or replace function public.join_party(p_code text, p_character text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me text := current_account_id();
  pid text;
begin
  if me is null then raise exception 'sign in first'; end if;
  if (select count(*) from party_join_attempts a where a.account_id = me and a.at > now() - interval '15 minutes') >= 10 then
    raise exception 'too many tries';
  end if;
  select id into pid from parties where code = upper(regexp_replace(p_code, '[\s-]', '', 'g'));
  if pid is null then
    insert into party_join_attempts (account_id) values (me);
    delete from party_join_attempts where at < now() - interval '1 day';
    return null;
  end if;
  insert into party_members (party_id, user_id, character_id, joined_at) values (pid, me, p_character, iso_now())
  on conflict (party_id, user_id) do update
    set character_id = coalesce(excluded.character_id, party_members.character_id);
  update parties set updated_at = now() where id = pid;
  return pid;
end
$$;

-- The party's DM, for policies.
create function public.party_dm(p_party text) returns text
language sql stable security definer set search_path = public as $$
  select dm_id from parties where id = p_party
$$;

-- ---------- Secret rolls ----------

-- Only the party's DM reads results. The roller sees that they rolled (my_secret_rolls), never the result.
create table public.secret_rolls (
  id text primary key,
  party_id text not null references public.parties (id) on delete cascade,
  from_id text not null references public.accounts (id),
  label text,
  roll jsonb not null,
  rolled_at text not null
);
create index secret_rolls_party on public.secret_rolls (party_id);

alter table public.secret_rolls enable row level security;
revoke all on public.secret_rolls from anon, authenticated;
grant select, insert, delete on public.secret_rolls to authenticated;
create policy secret_rolls_dm_read on public.secret_rolls for select to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin());
create policy secret_rolls_send on public.secret_rolls for insert to authenticated
  with check (from_id = current_account_id() and is_party_member(party_id));
create policy secret_rolls_clear on public.secret_rolls for delete to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin());

create function public.my_secret_rolls(p_party text)
returns table (id text, label text, rolled_at text)
language sql stable security definer set search_path = public as $$
  select s.id, s.label, s.rolled_at from secret_rolls s
  where s.party_id = p_party and s.from_id = current_account_id()
  order by s.rolled_at desc limit 100
$$;

-- ---------- Hand-outs ----------

-- data is the Handout (src/handouts/types.ts) without seenBy; sent_at and the recipients are
-- columns too, so the access rules can read them. Only the party's DM writes.
create table public.handouts (
  id text primary key,
  party_id text not null references public.parties (id) on delete cascade,
  data jsonb not null,
  sent_at text,
  to_all boolean not null default true,
  to_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index handouts_party on public.handouts (party_id);
create trigger handouts_touch before insert or update on public.handouts
  for each row execute function public.touch_updated_at();

create table public.handout_seen (
  handout_id text not null references public.handouts (id) on delete cascade,
  user_id text not null references public.accounts (id),
  seen_at text not null,
  primary key (handout_id, user_id)
);

alter table public.handouts enable row level security;
alter table public.handout_seen enable row level security;
revoke all on public.handouts from anon, authenticated;
revoke all on public.handout_seen from anon, authenticated;
grant select, insert, update, delete on public.handouts to authenticated;
grant select, insert, delete on public.handout_seen to authenticated;

create policy handouts_read on public.handouts for select to authenticated
  using (
    party_dm(party_id) = current_account_id() or is_admin()
    or (sent_at is not null and is_party_member(party_id) and (to_all or current_account_id() = any (to_ids)))
  );
create policy handouts_dm_insert on public.handouts for insert to authenticated
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy handouts_dm_update on public.handouts for update to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin())
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy handouts_dm_delete on public.handouts for delete to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin());

-- A player marks what they can see as read; the DM sees the receipts and resets them on "Take back".
create policy handout_seen_read on public.handout_seen for select to authenticated
  using (user_id = current_account_id() or exists (select 1 from handouts h where h.id = handout_id));
create policy handout_seen_mark on public.handout_seen for insert to authenticated
  with check (user_id = current_account_id() and exists (select 1 from handouts h where h.id = handout_id));
create policy handout_seen_reset on public.handout_seen for delete to authenticated
  using (exists (select 1 from handouts h where h.id = handout_id and (party_dm(h.party_id) = current_account_id() or is_admin())));

-- ---------- Session polls ----------

-- data is the SessionPoll (src/schedule/types.ts) without votes. Members add dates and the DM locks
-- one in; writes are conditional on rev. Each player writes only their own votes.
create table public.session_polls (
  id text primary key,
  party_id text not null references public.parties (id) on delete cascade,
  data jsonb not null,
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);
create index session_polls_party on public.session_polls (party_id);
create trigger session_polls_touch before insert or update on public.session_polls
  for each row execute function public.touch_updated_at();

create table public.poll_votes (
  poll_id text not null references public.session_polls (id) on delete cascade,
  user_id text not null references public.accounts (id),
  option_id text not null,
  availability text not null check (availability in ('yes', 'maybe', 'no')),
  primary key (poll_id, user_id, option_id)
);

alter table public.session_polls enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.session_polls from anon, authenticated;
revoke all on public.poll_votes from anon, authenticated;
grant select, insert, update, delete on public.session_polls to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;

create policy session_polls_member on public.session_polls for select to authenticated
  using (is_party_member(party_id) or is_admin());
create policy session_polls_start on public.session_polls for insert to authenticated
  with check (is_party_member(party_id) or is_admin());
create policy session_polls_change on public.session_polls for update to authenticated
  using (is_party_member(party_id) or is_admin())
  with check (is_party_member(party_id) or is_admin());
create policy session_polls_delete on public.session_polls for delete to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin());

create policy poll_votes_read on public.poll_votes for select to authenticated
  using (exists (select 1 from session_polls p where p.id = poll_id));
create policy poll_votes_own on public.poll_votes for insert to authenticated
  with check (user_id = current_account_id() and exists (select 1 from session_polls p where p.id = poll_id));
create policy poll_votes_change on public.poll_votes for update to authenticated
  using (user_id = current_account_id()) with check (user_id = current_account_id());
create policy poll_votes_remove on public.poll_votes for delete to authenticated
  using (user_id = current_account_id());

revoke execute on function public.party_dm(text) from public, anon;
revoke execute on function public.my_secret_rolls(text) from public, anon;
grant execute on function public.party_dm(text) to authenticated;
grant execute on function public.my_secret_rolls(text) to authenticated;

alter publication supabase_realtime add table
  public.secret_rolls, public.handouts, public.handout_seen, public.session_polls, public.poll_votes;
