-- Session notes (src/sessions): one note per game night. The shared half (recap, people, loot, leads) is
-- read by party members once the DM shares it; the private half (jots, own notes, next-time plan) lives in
-- its own table that only the DM reads, so nothing private can leak through a row. Runs after
-- 20261031100000_assistant_usage.sql.

-- data is the SessionNote (src/sessions/types.ts) without id, partyId and sharedAt.
create table public.session_notes (
  id text primary key,
  party_id text not null references public.parties (id) on delete cascade,
  data jsonb not null,
  shared_at text,
  updated_at timestamptz not null default now()
);
create index session_notes_party on public.session_notes (party_id);
create trigger session_notes_touch before insert or update on public.session_notes
  for each row execute function public.touch_updated_at();

-- data is the SessionSecret without id and partyId. DM (and admin) only.
create table public.session_note_secrets (
  id text primary key references public.session_notes (id) on delete cascade,
  party_id text not null references public.parties (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index session_note_secrets_party on public.session_note_secrets (party_id);
create trigger session_note_secrets_touch before insert or update on public.session_note_secrets
  for each row execute function public.touch_updated_at();

alter table public.session_notes enable row level security;
alter table public.session_note_secrets enable row level security;
revoke all on public.session_notes from anon, authenticated;
revoke all on public.session_note_secrets from anon, authenticated;
grant select, insert, update, delete on public.session_notes to authenticated;
grant select, insert, update, delete on public.session_note_secrets to authenticated;

create policy session_notes_read on public.session_notes for select to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin() or (shared_at is not null and is_party_member(party_id)));
create policy session_notes_dm_insert on public.session_notes for insert to authenticated
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy session_notes_dm_update on public.session_notes for update to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin())
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy session_notes_dm_delete on public.session_notes for delete to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin());

create policy session_note_secrets_dm on public.session_note_secrets for all to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin())
  with check (
    (party_dm(party_id) = current_account_id() or is_admin())
    and exists (select 1 from public.session_notes n where n.id = session_note_secrets.id and n.party_id = session_note_secrets.party_id)
  );

alter publication supabase_realtime add table public.session_notes;
alter publication supabase_realtime add table public.session_note_secrets;
