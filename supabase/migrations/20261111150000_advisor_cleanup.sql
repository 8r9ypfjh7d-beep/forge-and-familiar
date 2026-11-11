-- Fixes from the Supabase database advisor. No behaviour change.

-- Pin search_path on the pure jsonb helpers so they can't be redirected by a caller's path.
alter function public.health_word(jsonb) set search_path = public, pg_temp;
alter function public.token_in_fog(jsonb, jsonb) set search_path = public, pg_temp;
alter function public.project_public_encounter(jsonb, jsonb) set search_path = public, pg_temp;
alter function public.project_public_board(jsonb, jsonb) set search_path = public, pg_temp;

-- Evaluate auth.uid() once per query instead of once per row.
alter policy devices_own on public.account_devices using (user_id = (select auth.uid()) or is_admin());
alter policy devices_unlink on public.account_devices using (user_id = (select auth.uid()) or is_admin());

-- Cover foreign keys so deletes of the parent row don't scan the child table.
create index if not exists account_devices_account_id on public.account_devices (account_id);
create index if not exists handout_seen_user_id on public.handout_seen (user_id);
create index if not exists parties_dm_id on public.parties (dm_id);
create index if not exists poll_votes_user_id on public.poll_votes (user_id);
create index if not exists secret_rolls_from_id on public.secret_rolls (from_id);
