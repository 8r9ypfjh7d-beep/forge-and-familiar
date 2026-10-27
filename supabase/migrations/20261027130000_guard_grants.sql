-- Security advisor (lint 0028): the dm_requests guard is a trigger function, never called directly.
revoke execute on function public.dm_requests_guard() from public, anon, authenticated;
