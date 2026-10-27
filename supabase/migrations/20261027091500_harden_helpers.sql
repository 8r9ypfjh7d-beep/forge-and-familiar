-- Security advisor follow-up: fixed search_path on the trigger function, and the policy helpers
-- callable only by signed-in devices.
alter function public.touch_updated_at() set search_path = public;

revoke execute on function public.current_account_id() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_dm() from public, anon;
grant execute on function public.current_account_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_dm() to authenticated;
