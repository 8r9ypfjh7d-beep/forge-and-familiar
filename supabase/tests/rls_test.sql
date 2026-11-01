-- Checks the migrations' access rules on a plain Postgres 16, with a tiny stand-in for Supabase's
-- auth schema and roles. Run: supabase/tests/run.sh (needs a local postgres; see SUPABASE.md).
\set ON_ERROR_STOP on

-- Stand-in for what Supabase provides.
-- Roles are server-wide, so a second run finds them already there.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create schema extensions;
create publication supabase_realtime;
grant usage on schema public, extensions to anon, authenticated;
-- Like Supabase, new tables start with every privilege for anon and authenticated.
alter default privileges in schema public grant all on tables to anon, authenticated;

\ir ../migrations/20261027090000_foundation.sql
\ir ../migrations/20261027091500_harden_helpers.sql
\ir ../migrations/20261027100000_sync.sql
\ir ../migrations/20261027110000_dm_requests.sql
\ir ../migrations/20261027113000_security_hardening.sql
\ir ../migrations/20261027120000_parties.sql
\ir ../migrations/20261027130000_guard_grants.sql
\ir ../migrations/20261028090000_party_shared.sql
\ir ../migrations/20261028100000_party_dm.sql
\ir ../migrations/20261030120000_homebrew_packs.sql
\ir ../migrations/20261030150000_end_party.sql
\ir ../migrations/20261030210000_npc_sheets.sql
\ir ../migrations/20261030210000_party_encounters.sql
\ir ../migrations/20261030220000_lore.sql
\ir ../migrations/20261031100000_assistant_usage.sql
\ir ../migrations/20261101130000_session_notes.sql

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-00000000000e'), ('00000000-0000-0000-0000-00000000000f');

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- Hashing matches src/accounts/codes.ts: sha256("ABC") for "a-b c".
select pg_temp.check(
  encode(extensions.digest(upper(regexp_replace('a-b c', '[\s-]', '', 'g')), 'sha256'), 'hex')
    = 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78',
  'code normalization and hash match the app');

-- Give accounts test codes we know, stored like the hardening migration: bcrypt(sha256 hex).
create function pg_temp.code(c text) returns text language sql as
  $$ select extensions.crypt(encode(extensions.digest(c, 'sha256'), 'hex'), extensions.gen_salt('bf', 4)) $$;
update accounts set code_hash = pg_temp.code('ROYTEST') where id = 'acct-roy';
update accounts set code_hash = pg_temp.code('TAMIRTEST') where id = 'acct-tamir';
update accounts set code_hash = pg_temp.code('ZIVTEST') where id = 'acct-ziv';
update accounts set code_hash = pg_temp.code('NOATEST') where id = 'acct-noa';
select pg_temp.check((select count(*) from accounts where code_hash like '$2a$%') = 5, 'every code_hash is bcrypt');

set role authenticated;

-- Device a: Roy.
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from accounts) = 0, 'unlinked device sees no accounts');
select pg_temp.check((select count(*) from claim_account('nope')) = 0, 'wrong code links nothing');
select pg_temp.check((select id from claim_account('roy-test')) = 'acct-roy', 'loosely typed code links Roy');
select pg_temp.check(current_account_id() = 'acct-roy', 'current_account_id is Roy');
select pg_temp.check((select count(*) from accounts) = 5, 'linked device reads the roster');
do $$ begin
  perform code_hash from accounts;
  raise exception 'FAILED: code_hash readable';
exception when insufficient_privilege then raise notice 'ok: code_hash not readable';
end $$;
insert into characters (id, owner_id, data) values ('c-roy', 'acct-roy', '{"name":"Brin"}');
do $$ begin
  insert into characters (id, owner_id, data) values ('c-fake', 'acct-tamir', '{}');
  raise exception 'FAILED: wrote a character for someone else';
exception when insufficient_privilege then raise notice 'ok: cannot write as another owner';
end $$;
insert into dm_state (account_id, data) values ('acct-roy', '{}');

-- Conditional write: only the base rev wins.
update characters set data = '{"name":"Brin II"}', rev = 2 where id = 'c-roy' and rev = 1;
update characters set data = '{"name":"stale"}', rev = 2 where id = 'c-roy' and rev = 1;
select pg_temp.check((select data->>'name' from characters where id = 'c-roy') = 'Brin II', 'stale rev write is ignored');

-- Device b: Tamir sees nothing of Roy's.
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select id from claim_account('TAMIRTEST')) = 'acct-tamir', 'Tamir links');
select pg_temp.check((select count(*) from characters) = 0, 'Tamir cannot read Roy''s characters');
select pg_temp.check((select count(*) from dm_state) = 0, 'Tamir cannot read Roy''s DM data');
update characters set data = '{}' where id = 'c-roy';
delete from characters where id = 'c-roy';
delete from account_devices where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from account_devices) = 1, 'Tamir sees only his own device link');
do $$ begin
  insert into dm_state (account_id, data) values ('acct-roy', '{}') on conflict (account_id) do update set data = '{}';
  raise exception 'FAILED: overwrote Roy''s DM data';
exception when insufficient_privilege then raise notice 'ok: cannot upsert over another account''s row';
end $$;
do $$ begin
  update account_devices set account_id = 'acct-ziv';
  raise exception 'FAILED: relinked a device to Ziv';
exception when insufficient_privilege then raise notice 'ok: cannot relink a device without a code';
end $$;
do $$ begin
  update accounts set is_admin = true where id = 'acct-tamir';
  raise exception 'FAILED: made himself admin';
exception when insufficient_privilege then raise notice 'ok: cannot grant himself admin';
end $$;
do $$ begin
  truncate characters, dm_requests;
  raise exception 'FAILED: truncated characters';
exception when insufficient_privilege then raise notice 'ok: cannot truncate tables';
end $$;

-- Device c: Noa (DM) has no extra access to sheets.
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select role from claim_account('NOATEST')) = 'dm', 'Noa links as DM');
select pg_temp.check(is_dm() and not is_admin(), 'is_dm true, is_admin false for Noa');
select pg_temp.check((select count(*) from characters) = 0, 'DM does not read player sheets');

-- Device d: Ziv (admin) sees and edits everything.
set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select is_admin from claim_account('ZIVTEST')), 'Ziv links as admin');
select pg_temp.check((select count(*) from characters) = 1, 'admin reads every character');
select pg_temp.check((select count(*) from dm_state) = 1, 'admin reads every DM record');
select pg_temp.check((select count(*) from account_devices) = 4, 'admin sees every device');
update characters set data = '{"name":"Fixed"}' where id = 'c-roy';
select pg_temp.check((select data->>'name' from characters where id = 'c-roy') = 'Fixed', 'admin edits a character');

-- Sync: snapshots and rolls.
set test.uid = '00000000-0000-0000-0000-00000000000a';
insert into snapshots (id, owner_id, character_id, data) values ('s-roy', 'acct-roy', 'c-roy', '{}');
insert into rolls (id, owner_id, character_id, data, rolled_at) values ('r-roy', 'acct-roy', 'c-roy', '{}', now());
insert into rolls (id, owner_id, data, rolled_at) values ('r-roy', 'acct-roy', '{}', now()) on conflict do nothing;
select pg_temp.check((select count(*) from rolls) = 1, 'duplicate roll ignored');
do $$ begin
  insert into rolls (id, owner_id, data, rolled_at) values ('r-fake', 'acct-tamir', '{}', now());
  raise exception 'FAILED: wrote a roll for someone else';
exception when insufficient_privilege then raise notice 'ok: cannot write rolls as another owner';
end $$;
do $$ begin
  insert into snapshots (id, owner_id, character_id, data) values ('s-fake', 'acct-tamir', 'x', '{}');
  raise exception 'FAILED: wrote a snapshot for someone else';
exception when insufficient_privilege then raise notice 'ok: cannot write snapshots as another owner';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from snapshots) + (select count(*) from rolls) = 0, 'Tamir cannot read Roy''s snapshots or rolls');
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from snapshots) + (select count(*) from rolls) = 0, 'DM cannot read player snapshots or rolls');
set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select count(*) from snapshots) = 1 and (select count(*) from rolls) = 1, 'admin reads snapshots and rolls');

-- Requests to the DM.
set test.uid = '00000000-0000-0000-0000-00000000000a';
insert into dm_requests (id, from_id, character_id, data, status, applied)
  values ('q-roy', 'acct-roy', 'c-roy', '{"title":"Flame sword"}', 'granted', true);
select pg_temp.check((select status = 'pending' and not applied from dm_requests where id = 'q-roy'), 'a new request starts pending, not applied');
update dm_requests set status = 'granted', reply = 'sure' where id = 'q-roy';
select pg_temp.check((select status from dm_requests where id = 'q-roy') = 'pending', 'player cannot grant their own request');
do $$ begin
  insert into dm_requests (id, from_id, character_id, data) values ('q-fake', 'acct-tamir', 'c-x', '{}');
  raise exception 'FAILED: sent a request as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot send a request as someone else';
end $$;
insert into dm_requests (id, from_id, character_id, data) values ('q-roy2', 'acct-roy', 'c-roy', '{"title":"Withdraw me"}');

set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from dm_requests) = 0, 'another player cannot read Roy''s requests');
update dm_requests set status = 'granted' where id = 'q-roy';

set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from dm_requests) = 2, 'the DM reads every request');
update dm_requests set status = 'granted', reply = 'yes', decided_at = '2026-10-27T10:00:00.000Z', data = '{"title":"hacked"}', applied = true
  where id = 'q-roy';
select pg_temp.check((select status = 'granted' and reply = 'yes' and data->>'title' = 'Flame sword' and not applied from dm_requests where id = 'q-roy'),
  'DM answers but cannot change the request or applied');
delete from dm_requests where id = 'q-roy2';
select pg_temp.check((select count(*) from dm_requests) = 2, 'DM clearing a request does not delete it');

set test.uid = '00000000-0000-0000-0000-00000000000a';
update dm_requests set applied = true where id = 'q-roy';
select pg_temp.check((select applied and status = 'granted' from dm_requests where id = 'q-roy'), 'player marks the grant applied, answer kept');
delete from dm_requests where id = 'q-roy';
select pg_temp.check((select count(*) from dm_requests where id = 'q-roy') = 1, 'player cannot delete an answered request');
delete from dm_requests where id = 'q-roy2';
select pg_temp.check((select count(*) from dm_requests where id = 'q-roy2') = 0, 'player takes back a waiting request');

set test.uid = '00000000-0000-0000-0000-00000000000d';
delete from dm_requests where id = 'q-roy';
select pg_temp.check((select count(*) from dm_requests) = 0, 'admin deletes any request');

-- Parties. Roy runs one, Tamir joins with a character, Maayan-less Noa stays out.
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select dm_id from create_party('p-1', 'Heroes', 'ABC234')) = 'acct-roy', 'Roy creates a party as its DM');
select pg_temp.check((select count(*) from party_members where party_id = 'p-1') = 1, 'creator is a member');
do $$ begin
  insert into parties (id, name, code, dm_id, created_at) values ('p-x', 'x', 'XYZ234', 'acct-roy', 'now');
  raise exception 'FAILED: inserted a party directly';
exception when insufficient_privilege then raise notice 'ok: parties are created only through create_party';
end $$;

set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from parties where id <> 'party-garden-gang') = 0, 'outsider cannot list parties or codes');
select pg_temp.check(join_party('zzz-zzz', null) is null, 'unknown code joins nothing');
insert into characters (id, owner_id, data) values ('c-tamir', 'acct-tamir', '{"name":"Ash"}');
insert into rolls (id, owner_id, character_id, data, rolled_at) values ('r-old', 'acct-tamir', 'c-tamir', '{}', now() - interval '1 day');
select pg_temp.check(join_party('abc-234', 'c-tamir') = 'p-1', 'Tamir joins by a loosely typed code');
insert into rolls (id, owner_id, character_id, data, rolled_at) values ('r-new', 'acct-tamir', 'c-tamir', '{}', now() + interval '1 second');
insert into rolls (id, owner_id, character_id, data, rolled_at) values ('r-other', 'acct-tamir', 'c-tamir2', '{}', now() + interval '1 second');
select pg_temp.check((select count(*) from party_members where party_id = 'p-1') = 2, 'members see each other');
update parties set stash = '{"coins":{"gp":5}}', rev = 2 where id = 'p-1' and rev = 1;
select pg_temp.check((select stash->'coins'->>'gp' from parties where id = 'p-1') = '5', 'a member changes the stash');
do $$ begin
  update parties set dm_id = 'acct-tamir' where id = 'p-1';
  raise exception 'FAILED: member took over as DM';
exception when insufficient_privilege then raise notice 'ok: members cannot change the DM';
end $$;
update party_members set character_id = 'c-hijack' where party_id = 'p-1' and user_id = 'acct-roy';
select pg_temp.check((select character_id from party_members where party_id = 'p-1' and user_id = 'acct-roy') is null, 'cannot change another member''s character');
insert into dm_requests (id, from_id, character_id, data) values ('q-tamir', 'acct-tamir', 'c-tamir', '{"title":"Shield"}');

set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from characters where id = 'c-tamir') = 1, 'party member reads the character a member brings');
select pg_temp.check((select array_agg(id order by id) from rolls where owner_id = 'acct-tamir') = '{r-new}', 'party sees only rolls of the brought character since joining');
select pg_temp.check((select count(*) from dm_requests where id = 'q-tamir') = 1, 'party DM reads the member''s request');
update dm_requests set status = 'granted' where id = 'q-tamir';
select pg_temp.check((select status from dm_requests where id = 'q-tamir') = 'granted', 'party DM answers it');

set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from parties where id <> 'party-garden-gang') + (select count(*) from rolls) = 0, 'non-member sees no party or rolls');

set test.uid = '00000000-0000-0000-0000-00000000000a';
select leave_party('p-1');
select pg_temp.check((select count(*) from characters where id = 'c-tamir') = 0, 'after leaving, Roy no longer sees Tamir''s character');
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select dm_id from parties where id = 'p-1') = 'acct-tamir', 'DM leaving hands the party to the next member');
select leave_party('p-1');
reset role;
select pg_temp.check((select count(*) from parties where id = 'p-1') = 0, 'last member leaving deletes the party');
set role authenticated;

-- Garden Gang is seeded with every friend and Noa as its DM. A new party names its DM.
reset role;
select pg_temp.check((select dm_id from parties where id = 'party-garden-gang') = 'acct-noa', 'Garden Gang is seeded with Noa as DM');
select pg_temp.check((select count(*) from party_members where party_id = 'party-garden-gang') = 5, 'every friend is in Garden Gang');
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select dm_id from create_party('p-3', 'Side quest', 'GHJ234', 'acct-roy')) = 'acct-roy', 'Tamir makes a party with Roy as DM');
select pg_temp.check((select array_agg(user_id order by user_id) from party_members where party_id = 'p-3') = '{acct-roy,acct-tamir}', 'creator and chosen DM both join');
do $$ begin
  perform create_party('p-4', 'Nobody', 'JKM234', 'acct-ghost');
  raise exception 'FAILED: made a party with an unknown DM';
exception when raise_exception then
  if sqlerrm <> 'unknown DM' then raise; end if;
  raise notice 'ok: the DM must be an account';
end $$;
insert into dm_requests (id, from_id, character_id, data) values ('q-side', 'acct-tamir', 'c-tamir', '{"title":"Rope"}');
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from dm_requests where id = 'q-side') = 1, 'the party''s chosen DM reads a member''s request');
reset role;
delete from party_members where party_id = 'party-garden-gang' and user_id = 'acct-tamir';
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from dm_requests where id = 'q-side') = 0, 'a DM does not read requests of players outside their parties');
reset role;
delete from parties where id = 'p-3';
insert into party_members (party_id, user_id, joined_at) values ('party-garden-gang', 'acct-tamir', iso_now());
delete from dm_requests where id = 'q-side';
set role authenticated;

-- Roy's data survived Tamir's attempts.
reset role;
select pg_temp.check((select data->>'name' from characters where id = 'c-roy') = 'Fixed', 'Roy''s character untouched by Tamir');
select pg_temp.check((select count(*) from account_devices where account_id = 'acct-roy') = 1, 'Roy''s device link untouched by Tamir');
set role authenticated;

-- Rate limit: a fresh anonymous device gets 5 wrong codes, then is locked out even with a right one.
set test.uid = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from accounts) = 0, 'unlinked device sees no accounts');
select pg_temp.check((select count(*) from characters) + (select count(*) from dm_state) = 0, 'unlinked device sees no data');
select count(*) from generate_series(1, 5) g, lateral claim_account('GUESS' || g);
do $$ begin
  perform claim_account('ROYTEST');
  raise exception 'FAILED: sixth try allowed';
exception when raise_exception then
  if sqlerrm <> 'too many tries' then raise; end if;
  raise notice 'ok: sixth try in 15 minutes is refused';
end $$;
-- Another device still gets in, until everyone together passes 30 misses a minute.
set test.uid = '00000000-0000-0000-0000-00000000000f';
select pg_temp.check((select id from claim_account('roy test')) = 'acct-roy', 'other devices are not locked out');
reset role;
insert into claim_attempts (user_id) select '00000000-0000-0000-0000-00000000000a' from generate_series(1, 30);
set role authenticated;
do $$ begin
  perform claim_account('ROYTEST');
  raise exception 'FAILED: global limit not applied';
exception when raise_exception then
  if sqlerrm <> 'too many tries' then raise; end if;
  raise notice 'ok: global limit refuses claims during a guessing burst';
end $$;
do $$ begin
  perform * from claim_attempts;
  raise exception 'FAILED: claim_attempts readable';
exception when insufficient_privilege then raise notice 'ok: claim_attempts not readable';
end $$;
reset role;
set role authenticated;

-- What a party shares: secret rolls, hand-outs, session polls. Roy is DM of p-2; Tamir and Noa join.
set test.uid = '00000000-0000-0000-0000-00000000000a';
select create_party('p-2', 'Table', 'DEF234');
set test.uid = '00000000-0000-0000-0000-00000000000b';
select join_party('DEF234', 'c-tamir');
set test.uid = '00000000-0000-0000-0000-00000000000c';
select join_party('DEF234', null);

-- Invite code guesses are limited.
set test.uid = '00000000-0000-0000-0000-00000000000d';
select join_party('ZZZ' || n, null) from generate_series(222, 231) n;
do $$ begin
  perform join_party('DEF234', null);
  raise exception 'FAILED: guessed past the limit';
exception when raise_exception then raise notice 'ok: too many wrong invite codes are refused, even a right one';
end $$;
select pg_temp.check((select count(*) from party_members where party_id = 'p-2' and user_id = 'acct-ziv') = 0, 'the blocked guess did not join');

-- Secret rolls.
set test.uid = '00000000-0000-0000-0000-00000000000b';
insert into secret_rolls (id, party_id, from_id, label, roll, rolled_at) values ('s-1', 'p-2', 'acct-tamir', 'Stealth', '{"total":17}', '2026-10-28T09:00:00.000Z');
select pg_temp.check((select count(*) from secret_rolls) = 0, 'the roller cannot read the result');
select pg_temp.check((select label from my_secret_rolls('p-2')) = 'Stealth', 'the roller sees that they rolled');
do $$ begin
  insert into secret_rolls (id, party_id, from_id, roll, rolled_at) values ('s-x', 'p-2', 'acct-noa', '{}', 'x');
  raise exception 'FAILED: secret roll as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot send a secret roll as someone else';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from secret_rolls) + (select count(*) from my_secret_rolls('p-2')) = 0, 'another player sees nothing of it');
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select roll->>'total' from secret_rolls where id = 's-1') = '17', 'the party DM reads the result');

-- Hand-outs.
insert into handouts (id, party_id, data, sent_at, to_all, to_ids) values
  ('h-draft', 'p-2', '{"title":"Draft"}', null, true, '{}'),
  ('h-tamir', 'p-2', '{"title":"Map"}', '2026-10-28T09:00:00.000Z', false, '{acct-tamir}');
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select array_agg(id) from handouts) = '{h-tamir}', 'a player sees only sent hand-outs addressed to them');
do $$ begin
  insert into handouts (id, party_id, data) values ('h-x', 'p-2', '{}');
  raise exception 'FAILED: player wrote a hand-out';
exception when insufficient_privilege then raise notice 'ok: only the DM writes hand-outs';
end $$;
insert into handout_seen values ('h-tamir', 'acct-tamir', '2026-10-28T09:01:00.000Z');
do $$ begin
  insert into handout_seen values ('h-draft', 'acct-tamir', 'x');
  raise exception 'FAILED: marked an unseen draft';
exception when insufficient_privilege then raise notice 'ok: cannot mark a hand-out one cannot see';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from handouts) = 0, 'a player not addressed sees no hand-out');
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from handout_seen) = 1, 'the DM sees read receipts');
delete from handout_seen where handout_id = 'h-tamir';

-- Codex chapters (src/lore): the DM writes, every member reads.
insert into lore_chapters (id, party_id, data) values ('ch-1', 'p-2', '{"title":"The Barony","order":0,"teasers":1}');
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from lore_chapters where id = 'ch-1') = 1, 'a party member reads chapters');
do $$ begin
  insert into lore_chapters (id, party_id, data) values ('ch-x', 'p-2', '{}');
  raise exception 'FAILED: player wrote a chapter';
exception when insufficient_privilege then raise notice 'ok: only the DM writes chapters';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000a';
delete from lore_chapters where id = 'ch-1';
select pg_temp.check((select count(*) from handout_seen) = 0, 'the DM resets receipts on take back');

-- Session notes (src/sessions): players read shared notes only; the private half is the DM's alone.
insert into session_notes (id, party_id, data, shared_at) values
  ('sn-1', 'p-2', '{"number":1,"recap":"We met"}', '2026-11-01T09:00:00.000Z'),
  ('sn-2', 'p-2', '{"number":2,"recap":""}', null);
insert into session_note_secrets (id, party_id, data) values ('sn-1', 'p-2', '{"notes":"The duke lies"}');
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select array_agg(id) from session_notes) = '{sn-1}', 'a player reads only shared session notes');
select pg_temp.check((select count(*) from session_note_secrets) = 0, 'a player never reads the DM''s private session notes');
do $$ begin
  insert into session_notes (id, party_id, data) values ('sn-x', 'p-2', '{}');
  raise exception 'FAILED: player wrote a session note';
exception when insufficient_privilege then raise notice 'ok: only the DM writes session notes';
end $$;
update session_notes set data = '{"recap":"hacked"}' where id = 'sn-1';
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select data->>'recap' from session_notes where id = 'sn-1') = 'We met', 'a player cannot change a shared note');
select pg_temp.check((select count(*) from session_notes) = 2 and (select count(*) from session_note_secrets) = 1, 'the DM reads every note and its private half');
do $$ begin
  insert into session_note_secrets (id, party_id, data) values ('sn-2', 'p-1', '{}');
  raise exception 'FAILED: secret filed under another party';
exception when insufficient_privilege then raise notice 'ok: a private half stays with its own note''s party';
end $$;
delete from session_notes where id = 'sn-1';
select pg_temp.check((select count(*) from session_note_secrets) = 0, 'deleting a note deletes its private half');

-- Session polls.
set test.uid = '00000000-0000-0000-0000-00000000000b';
insert into session_polls (id, party_id, data) values ('poll-1', 'p-2', '{"options":[]}');
update session_polls set data = '{"options":[{"id":"o1"}]}', rev = 2 where id = 'poll-1' and rev = 1;
insert into poll_votes values ('poll-1', 'acct-tamir', 'o1', 'yes');
do $$ begin
  insert into poll_votes values ('poll-1', 'acct-noa', 'o1', 'no');
  raise exception 'FAILED: voted for someone else';
exception when insufficient_privilege then raise notice 'ok: players vote only for themselves';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from poll_votes) = 1 and (select rev from session_polls) = 2, 'members see the poll and votes');
update poll_votes set availability = 'no' where user_id = 'acct-tamir';
select pg_temp.check((select availability from poll_votes) = 'yes', 'cannot change another player''s vote');
set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select count(*) from session_polls) = 1, 'admin sees polls');
set test.uid = '00000000-0000-0000-0000-00000000000a';

-- Homebrew packs: own library, read by party members, private otherwise.
set test.uid = '00000000-0000-0000-0000-00000000000a';
insert into homebrew_packs (owner_id, id, data) values ('acct-roy', 'abcdefabcdef', '{"name":"Roy brew"}');
update homebrew_packs set data = '{"name":"Thorn brew"}' where owner_id = 'acct-roy' and id = 'abcdefabcdef';
do $$ begin
  insert into homebrew_packs (owner_id, id, data) values ('acct-tamir', 'abcdefabcdef', '{}');
  raise exception 'FAILED: wrote a pack as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot write a pack as someone else';
end $$;
do $$ begin
  insert into homebrew_packs (owner_id, id, data) values ('acct-roy', 'bad id!', '{}');
  raise exception 'FAILED: bad pack id accepted';
exception when check_violation then raise notice 'ok: pack ids are checked';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select data->>'name' from homebrew_packs where owner_id = 'acct-roy') = 'Thorn brew', 'a party member reads the pack');
update homebrew_packs set data = '{"name":"Hijack"}' where owner_id = 'acct-roy';
do $$ begin
  delete from homebrew_packs where owner_id = 'acct-roy';
  raise exception 'FAILED: deleted a pack row';
exception when insufficient_privilege then raise notice 'ok: pack rows are never deleted (tombstones sync deletes)';
end $$;
reset role;
select pg_temp.check((select data->>'name' from homebrew_packs where owner_id = 'acct-roy') = 'Thorn brew', 'a party member cannot change or delete it');
insert into homebrew_packs (owner_id, id, data) values ('acct-maayan', 'f00df00df00d', '{"name":"Secret"}');
delete from party_members where party_id = 'party-garden-gang' and user_id = 'acct-maayan';
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from homebrew_packs where owner_id = 'acct-maayan') = 0, 'packs of someone outside your parties stay private');
set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select count(*) from homebrew_packs) = 2, 'admin reads every pack');
set test.uid = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from homebrew_packs) = 0, 'unlinked device reads no packs');
set test.uid = '00000000-0000-0000-0000-00000000000a';

-- NPC sheets: only the DM who owns them (and the admin), never party members.
set test.uid = '00000000-0000-0000-0000-00000000000c';
insert into npc_sheets (owner_id, id, data) values ('acct-noa', 'npc-goblin-boss', '{"name":"Goblin boss","hp":21}');
update npc_sheets set data = '{"name":"Goblin boss","hp":15}', rev = 1 where owner_id = 'acct-noa' and id = 'npc-goblin-boss' and rev = 0;
update npc_sheets set data = '{"name":"stale"}', rev = 1 where owner_id = 'acct-noa' and id = 'npc-goblin-boss' and rev = 0;
select pg_temp.check((select data->>'hp' from npc_sheets where id = 'npc-goblin-boss') = '15', 'DM edits an NPC; a stale rev write is ignored');
do $$ begin
  insert into npc_sheets (owner_id, id, data) values ('acct-roy', 'npc-fake', '{}');
  raise exception 'FAILED: wrote an NPC as someone else';
exception when insufficient_privilege then raise notice 'ok: cannot write an NPC as someone else';
end $$;
do $$ begin
  insert into npc_sheets (owner_id, id, data) values ('acct-noa', 'bad id!', '{}');
  raise exception 'FAILED: bad NPC id accepted';
exception when check_violation then raise notice 'ok: NPC ids are checked';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from npc_sheets) = 0, 'a player in the DM''s party cannot read NPC sheets');
update npc_sheets set data = '{"name":"Hijack"}' where owner_id = 'acct-noa';
do $$ begin
  delete from npc_sheets where owner_id = 'acct-noa';
  raise exception 'FAILED: deleted an NPC row';
exception when insufficient_privilege then raise notice 'ok: NPC rows are never deleted (tombstones sync deletes)';
end $$;
reset role;
select pg_temp.check((select data->>'name' from npc_sheets where id = 'npc-goblin-boss') = 'Goblin boss', 'a player cannot change an NPC sheet');
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select count(*) from npc_sheets) = 1, 'admin reads every NPC sheet');
set test.uid = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from npc_sheets) = 0, 'unlinked device reads no NPC sheets');
set test.uid = '00000000-0000-0000-0000-00000000000a';

-- Live combat: Roy (DM of p-2) pushes a combat; Tamir sees the public copy and moves only his token.
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000a';
insert into party_encounters (party_id, encounter, map, map_id, board, started_at) values ('p-2',
  '{"id":"e1","round":1,"log":["secret"],"combatants":[
     {"id":"vex","kind":"pc","name":"Brin","characterId":"c-tamir","conditions":[]},
     {"id":"g1","kind":"npc","name":"Goblin","hp":{"current":3,"max":7,"temp":0},"ac":15,"conditions":[]},
     {"id":"g2","kind":"npc","name":"Goblin","hp":{"current":7,"max":7,"temp":0},"conditions":[]},
     {"id":"amb","kind":"npc","name":"Assassin","hp":{"current":50,"max":50,"temp":0},"conditions":[]}]}',
  '{"id":"m1","name":"Tavern","width":10,"height":8}', 'm1',
  '{"tokens":[
     {"id":"t-vex","combatantId":"vex","characterId":"c-tamir","kind":"pc","label":"B","x":0,"y":7,"size":1},
     {"id":"t-g1","combatantId":"g1","kind":"npc","label":"G1","x":0,"y":0,"size":1},
     {"id":"t-g2","combatantId":"g2","kind":"npc","label":"G2","x":5,"y":0,"size":1},
     {"id":"t-amb","combatantId":"amb","kind":"npc","label":"A","x":9,"y":0,"size":1,"hidden":true}],
    "fog":["4,0","5,0","6,0","4,1","5,1","6,1"],"locked":false}', iso_now());
select pg_temp.check((select count(*) from party_encounters_public where party_id = 'p-2') = 1, 'the public copy is written by the trigger');
select pg_temp.check((select encounter ? 'log' from party_encounters_public where party_id = 'p-2') = false, 'public copy has no log');
select pg_temp.check((select encounter->'combatants'->1->>'look' from party_encounters_public where party_id = 'p-2') = 'bloodied', 'a raw monster row gets a look instead of HP');
select pg_temp.check((select encounter->'combatants'->1 ? 'hp' or encounter->'combatants'->1 ? 'ac' from party_encounters_public where party_id = 'p-2') = false, 'monster HP and AC numbers are gone');
select pg_temp.check((select jsonb_array_length(encounter->'combatants') from party_encounters_public where party_id = 'p-2') = 2, 'hidden and fogged combatants are gone from the public turn order');
select pg_temp.check((select board->'tokens'->>0 from party_encounters_public where party_id = 'p-2')::jsonb->>'id' = 't-vex', 'public tokens keep the player token');
select pg_temp.check((select jsonb_array_length(board->'tokens') from party_encounters_public where party_id = 'p-2') = 2, 'hidden and fogged tokens are not sent');
select pg_temp.check(move_token('p-2', 't-amb', 8, 0) = 2, 'the DM moves a hidden monster');
do $$ begin
  perform move_token('p-2', 't-vex', 10, 7);
  raise exception 'FAILED: moved off the map';
exception when others then
  if sqlerrm <> 'off the map' then raise; end if;
  raise notice 'ok: nothing leaves the map';
end $$;

set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from party_encounters) = 0, 'a player cannot read the full row');
select pg_temp.check((select count(*) from party_encounters_public where party_id = 'p-2') = 1, 'a member reads the public copy');
do $$ begin
  insert into party_encounters_public (party_id, encounter, board, rev, started_at) values ('p-2', '{}', '{}', 1, 'x');
  raise exception 'FAILED: player wrote the public copy';
exception when insufficient_privilege then raise notice 'ok: players cannot write the public copy';
end $$;
do $$ begin
  update party_encounters set board = '{}' where party_id = 'p-2';
  if found then raise exception 'FAILED: player changed the DM row'; end if;
  raise notice 'ok: players cannot change the DM row';
end $$;
select pg_temp.check(move_token('p-2', 't-vex', 3, 6) = 3, 'a player moves the token of the character they bring');
select pg_temp.check((select board->'tokens'->0->>'x' from party_encounters_public where party_id = 'p-2') = '3', 'the move shows in the public copy');
do $$ begin
  perform move_token('p-2', 't-g1', 1, 1);
  raise exception 'FAILED: moved a monster';
exception when others then
  if sqlerrm <> 'not your token' then raise; end if;
  raise notice 'ok: a player cannot move a monster';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  perform move_token('p-2', 't-vex', 1, 1);
  raise exception 'FAILED: moved another player''s token';
exception when others then
  if sqlerrm <> 'not your token' then raise; end if;
  raise notice 'ok: a watcher cannot move another player''s token';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000a';
update party_encounters set board = jsonb_set(board, '{locked}', 'true'), rev = rev + 1 where party_id = 'p-2';
set test.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform move_token('p-2', 't-vex', 2, 2);
  raise exception 'FAILED: moved on a locked board';
exception when others then
  if sqlerrm <> 'locked' then raise; end if;
  raise notice 'ok: a locked board stops players';
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000e';
select pg_temp.check((select count(*) from party_encounters_public) = 0, 'an unlinked device sees no live combat');
set test.uid = '00000000-0000-0000-0000-00000000000a';
delete from party_encounters where party_id = 'p-2';
select pg_temp.check((select count(*) from party_encounters_public where party_id = 'p-2') = 0, 'ending the combat removes the public copy');

-- Signed out: nothing.
reset role;
set role anon;
set test.uid = '';
do $$ begin
  perform * from characters;
  raise exception 'FAILED: anon read characters';
exception when insufficient_privilege then raise notice 'ok: anon cannot read characters';
end $$;
do $$ begin
  perform is_admin();
  raise exception 'FAILED: anon called is_admin';
exception when insufficient_privilege then raise notice 'ok: anon cannot call the helpers';
end $$;
do $$ begin
  perform * from rolls;
  raise exception 'FAILED: anon read rolls';
exception when insufficient_privilege then raise notice 'ok: anon cannot read rolls';
end $$;
do $$ begin
  perform * from dm_requests;
  raise exception 'FAILED: anon read requests';
exception when insufficient_privilege then raise notice 'ok: anon cannot read requests';
end $$;
do $$ begin
  perform * from homebrew_packs;
  raise exception 'FAILED: anon read packs';
exception when insufficient_privilege then raise notice 'ok: anon cannot read packs';
end $$;
do $$ begin
  perform * from party_encounters_public;
  raise exception 'FAILED: anon read live combat';
exception when insufficient_privilege then raise notice 'ok: anon cannot read live combat';
end $$;
do $$ begin
  perform * from assistant_usage;
  raise exception 'FAILED: anon read assistant usage';
exception when insufficient_privilege then raise notice 'ok: anon cannot read assistant usage';
end $$;
do $$ begin
  perform assistant_consume('acct-roy', 1, 0, 0);
  raise exception 'FAILED: anon counted assistant usage';
exception when insufficient_privilege then raise notice 'ok: anon cannot count assistant usage';
end $$;
reset role;
select pg_temp.check(true, 'all RLS checks passed');
