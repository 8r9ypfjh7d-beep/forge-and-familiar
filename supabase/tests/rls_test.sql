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

\ir ../migrations/20261027090000_foundation.sql
\ir ../migrations/20261027091500_harden_helpers.sql
\ir ../migrations/20261027100000_sync.sql
\ir ../migrations/20261027110000_dm_requests.sql
\ir ../migrations/20261027120000_parties.sql

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');

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

-- Give two accounts test codes we know.
update accounts set code_hash = encode(extensions.digest('ROYTEST', 'sha256'), 'hex') where id = 'acct-roy';
update accounts set code_hash = encode(extensions.digest('TAMIRTEST', 'sha256'), 'hex') where id = 'acct-tamir';
update accounts set code_hash = encode(extensions.digest('ZIVTEST', 'sha256'), 'hex') where id = 'acct-ziv';
update accounts set code_hash = encode(extensions.digest('NOATEST', 'sha256'), 'hex') where id = 'acct-noa';

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
select pg_temp.check((select count(*) from account_devices) = 1, 'Tamir sees only his own device link');

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
select pg_temp.check((select count(*) from parties) = 0, 'outsider cannot list parties or codes');
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
select pg_temp.check((select character_id from party_members where user_id = 'acct-roy') is null, 'cannot change another member''s character');
insert into dm_requests (id, from_id, character_id, data) values ('q-tamir', 'acct-tamir', 'c-tamir', '{"title":"Shield"}');

set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from characters where id = 'c-tamir') = 1, 'party member reads the character a member brings');
select pg_temp.check((select array_agg(id order by id) from rolls where owner_id = 'acct-tamir') = '{r-new}', 'party sees only rolls of the brought character since joining');
select pg_temp.check((select count(*) from dm_requests where id = 'q-tamir') = 1, 'party DM reads the member''s request');
update dm_requests set status = 'granted' where id = 'q-tamir';
select pg_temp.check((select status from dm_requests where id = 'q-tamir') = 'granted', 'party DM answers it');

set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from parties) + (select count(*) from rolls) = 0, 'non-member sees no party or rolls');

set test.uid = '00000000-0000-0000-0000-00000000000a';
select leave_party('p-1');
select pg_temp.check((select count(*) from characters where id = 'c-tamir') = 0, 'after leaving, Roy no longer sees Tamir''s character');
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select dm_id from parties where id = 'p-1') = 'acct-tamir', 'DM leaving hands the party to the next member');
select leave_party('p-1');
reset role;
select pg_temp.check((select count(*) from parties) = 0, 'last member leaving deletes the party');
set role authenticated;

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
reset role;
select pg_temp.check(true, 'all RLS checks passed');
