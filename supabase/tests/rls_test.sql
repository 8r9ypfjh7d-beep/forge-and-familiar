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
reset role;
select pg_temp.check(true, 'all RLS checks passed');
