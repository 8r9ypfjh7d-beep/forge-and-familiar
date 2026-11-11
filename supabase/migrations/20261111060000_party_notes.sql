-- Party notes (src/notes): notes players (and the DM) write about their campaign. The writer picks who reads
-- a note (only them, chosen players, or the whole party); the party's DM (and admin) reads every note; only
-- the writer saves or deletes it. Replaces the DM's shared session recaps: each shared recap is copied in as a
-- diary note by the DM for the whole party, then made private to the DM again. Runs after
-- 20261102110000_character_art.sql.

-- data is the PartyNote (src/notes/types.ts) without id, partyId, authorId and to.
create table public.party_notes (
  id text primary key,
  party_id text not null references public.parties (id) on delete cascade,
  author_id text not null,
  to_all boolean not null default false,
  to_ids text[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index party_notes_party on public.party_notes (party_id);
create trigger party_notes_touch before insert or update on public.party_notes
  for each row execute function public.touch_updated_at();

alter table public.party_notes enable row level security;
revoke all on public.party_notes from anon, authenticated;
grant select, insert, update, delete on public.party_notes to authenticated;

create policy party_notes_read on public.party_notes for select to authenticated
  using (
    author_id = current_account_id() or party_dm(party_id) = current_account_id() or is_admin()
    or (is_party_member(party_id) and (to_all or current_account_id() = any (to_ids)))
  );
create policy party_notes_insert on public.party_notes for insert to authenticated
  with check (author_id = current_account_id() and (is_party_member(party_id) or party_dm(party_id) = current_account_id()));
create policy party_notes_update on public.party_notes for update to authenticated
  using (author_id = current_account_id())
  with check (author_id = current_account_id() and (is_party_member(party_id) or party_dm(party_id) = current_account_id()));
create policy party_notes_delete on public.party_notes for delete to authenticated
  using (author_id = current_account_id() or is_admin());

alter publication supabase_realtime add table public.party_notes;

-- Shared recaps become diary notes (same text as recapToNote in src/notes/logic.ts, English list headings).
insert into public.party_notes (id, party_id, author_id, to_all, to_ids, data)
select
  'recap-' || s.id, s.party_id, s.data->>'fromId', true, '{}',
  jsonb_build_object(
    'kind', 'diary',
    'title', coalesce(nullif(btrim(s.data->>'title'), ''), 'Session ' || (s.data->>'number')),
    'text', concat_ws(e'\n\n',
      nullif(btrim(coalesce(s.data->>'recap', '')), ''),
      (select '**People met**' || e'\n' || string_agg('- ' || p, e'\n') from jsonb_array_elements_text(coalesce(s.data->'people', '[]')) p),
      (select '**Loot found**' || e'\n' || string_agg('- ' || l, e'\n') from jsonb_array_elements_text(coalesce(s.data->'loot', '[]')) l),
      (select '**Leads**' || e'\n' || string_agg('- ' || case when ld ? 'doneAt' then '✓ ' else '' end || (ld->>'text'), e'\n')
         from jsonb_array_elements(coalesce(s.data->'leads', '[]')) ld)
    ),
    'playedOn', s.data->>'playedOn',
    'createdAt', s.shared_at,
    'updatedAt', coalesce(s.data->>'updatedAt', s.shared_at)
  )
from public.session_notes s
where s.shared_at is not null and s.data->>'fromId' is not null
on conflict (id) do nothing;

update public.session_notes set shared_at = null where shared_at is not null;
