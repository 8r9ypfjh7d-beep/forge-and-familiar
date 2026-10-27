-- Security pass (pen test 2026-10-27). Activation codes are checked only here now: the app no
-- longer ships code hashes, code_hash is a salted slow hash, and claim_account is rate limited.
-- Table grants are trimmed to what the app uses.

-- code_hash becomes bcrypt(sha256 hex of the normalized code). To add or change a code, run
-- select extensions.crypt('<sha256 hex>', extensions.gen_salt('bf', 10)) and store the result.
update public.accounts set code_hash = extensions.crypt(code_hash, extensions.gen_salt('bf', 10));

-- Failed claim_account calls, for the rate limit. No client access.
create table public.claim_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index claim_attempts_at on public.claim_attempts (at);
alter table public.claim_attempts enable row level security;
revoke all on public.claim_attempts from anon, authenticated;

-- Same contract as before. Raises 'too many tries' after 5 wrong codes from one device in 15
-- minutes, or 30 from everyone in a minute (anonymous sign-ups make new devices cheap).
create or replace function public.claim_account(code text)
returns table (id text, name text, role text, is_admin boolean)
language plpgsql security definer set search_path = public, extensions as $$
declare
  acct accounts;
  hex text := encode(digest(upper(regexp_replace(coalesce(code, ''), '[\s-]', '', 'g')), 'sha256'), 'hex');
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if (select count(*) from claim_attempts c where c.user_id = auth.uid() and c.at > now() - interval '15 minutes') >= 5
     or (select count(*) from claim_attempts c where c.at > now() - interval '1 minute') >= 30 then
    raise exception 'too many tries';
  end if;
  select * into acct from accounts a where a.code_hash = crypt(hex, a.code_hash);
  if not found then
    delete from claim_attempts c where c.at < now() - interval '1 day';
    insert into claim_attempts (user_id) values (auth.uid());
    return;
  end if;
  insert into account_devices (user_id, account_id) values (auth.uid(), acct.id)
  on conflict (user_id) do update set account_id = excluded.account_id, linked_at = now();
  return query select acct.id, acct.name, acct.role, acct.is_admin;
end
$$;
revoke execute on function public.claim_account(text) from public, anon;
grant execute on function public.claim_account(text) to authenticated;

-- Supabase's default privileges also gave authenticated TRUNCATE (which skips RLS), REFERENCES
-- and TRIGGER on new tables. Keep only what the app uses, here and on future tables.
revoke all on public.characters, public.dm_state, public.snapshots, public.rolls, public.dm_requests from anon, authenticated;
grant select, insert, update, delete on public.characters, public.dm_state, public.snapshots, public.dm_requests to authenticated;
grant select, insert, delete on public.rolls to authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- Trigger functions run without EXECUTE; nobody needs to call them.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.dm_requests_guard() from public, anon, authenticated;
