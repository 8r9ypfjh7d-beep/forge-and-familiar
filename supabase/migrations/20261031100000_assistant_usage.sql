-- The Familiar (in-app AI assistant): per-account daily usage and limits for the `familiar` Edge Function.
-- Only the function (service role) reads and writes these; the browser has no access.
-- Change an account's allowance by inserting a row into assistant_limits; missing row = defaults in the function.

create table public.assistant_limits (
  account_id text primary key references public.accounts(id) on delete cascade,
  requests_per_day integer not null check (requests_per_day >= 0),
  tokens_per_day bigint not null check (tokens_per_day >= 0)
);

create table public.assistant_usage (
  account_id text not null references public.accounts(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  requests integer not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  primary key (account_id, day)
);

alter table public.assistant_limits enable row level security;
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_limits from anon, authenticated;
revoke all on public.assistant_usage from anon, authenticated;

-- One statement for the function: count a request (and tokens, once known) for today.
create function public.assistant_consume(p_account text, p_requests integer, p_tokens_in bigint, p_tokens_out bigint)
returns void language sql security definer set search_path = public as $$
  insert into assistant_usage (account_id, requests, tokens_in, tokens_out)
  values (p_account, p_requests, p_tokens_in, p_tokens_out)
  on conflict (account_id, day) do update set
    requests = assistant_usage.requests + excluded.requests,
    tokens_in = assistant_usage.tokens_in + excluded.tokens_in,
    tokens_out = assistant_usage.tokens_out + excluded.tokens_out;
$$;
revoke execute on function public.assistant_consume(text, integer, bigint, bigint) from public, anon, authenticated;
