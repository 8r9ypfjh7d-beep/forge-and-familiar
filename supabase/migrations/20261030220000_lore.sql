-- Campaign Codex (src/lore): chapters that group the DM's hand-out entries, and a picture bucket so
-- entry pictures stop travelling inside rows. Runs after 20261030150000_end_party.sql.

-- ---------- Chapters ----------

-- data is the LoreChapter (src/lore/types.ts) without id and partyId. Only the party's DM writes;
-- every member reads (a chapter row holds a title and a teaser count, nothing secret).
create table public.lore_chapters (
  id text primary key,
  party_id text not null references public.parties (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index lore_chapters_party on public.lore_chapters (party_id);
create trigger lore_chapters_touch before insert or update on public.lore_chapters
  for each row execute function public.touch_updated_at();

alter table public.lore_chapters enable row level security;
revoke all on public.lore_chapters from anon, authenticated;
grant select, insert, update, delete on public.lore_chapters to authenticated;

create policy lore_chapters_read on public.lore_chapters for select to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin() or is_party_member(party_id));
create policy lore_chapters_dm_insert on public.lore_chapters for insert to authenticated
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy lore_chapters_dm_update on public.lore_chapters for update to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin())
  with check (party_dm(party_id) = current_account_id() or is_admin());
create policy lore_chapters_dm_delete on public.lore_chapters for delete to authenticated
  using (party_dm(party_id) = current_account_id() or is_admin());

alter publication supabase_realtime add table public.lore_chapters;

-- ---------- Pictures ----------

-- Bucket `lore`: public reads (paths carry a random id, like an unlisted link), writes only by the DM
-- of the party named by the first folder. Guarded so the plain-Postgres RLS test database skips it.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('lore', 'lore', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$create policy lore_pictures_read on storage.objects for select to public using (bucket_id = 'lore')$p$;
  execute $p$create policy lore_pictures_dm_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'lore' and (public.party_dm((storage.foldername(name))[1]) = public.current_account_id() or public.is_admin()))$p$;
  execute $p$create policy lore_pictures_dm_delete on storage.objects for delete to authenticated
    using (bucket_id = 'lore' and (public.party_dm((storage.foldername(name))[1]) = public.current_account_id() or public.is_admin()))$p$;
end
$$;
