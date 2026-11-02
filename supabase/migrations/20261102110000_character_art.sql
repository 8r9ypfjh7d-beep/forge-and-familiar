-- Character art (src/art): portraits, token art and gallery pictures in a public bucket `art`.
-- Paths are `<account id>/<character id>/<random>.jpg`: reads go through unguessable public links, and only
-- the owning account (or the admin) may add, list or remove files in its own folder.
-- Guarded so the plain-Postgres RLS test database skips it.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('art', 'art', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$create policy art_own_read on storage.objects for select to authenticated
    using (bucket_id = 'art' and ((storage.foldername(name))[1] = public.current_account_id() or public.is_admin()))$p$;
  execute $p$create policy art_own_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'art' and (storage.foldername(name))[1] = public.current_account_id())$p$;
  execute $p$create policy art_own_delete on storage.objects for delete to authenticated
    using (bucket_id = 'art' and ((storage.foldername(name))[1] = public.current_account_id() or public.is_admin()))$p$;
end
$$;
