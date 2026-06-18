-- Use the canonical Supabase storage-RLS form: `TO authenticated` + `(select auth.uid())`.
-- Keeps the own-folder restriction; only the formulation changes.
drop policy if exists "branding_logos_insert_own" on storage.objects;
drop policy if exists "branding_logos_update_own" on storage.objects;
drop policy if exists "branding_logos_delete_own" on storage.objects;

create policy "branding_logos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding-logos' and (select auth.uid()::text) = (storage.foldername(name))[1]);

create policy "branding_logos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'branding-logos' and (select auth.uid()::text) = (storage.foldername(name))[1])
  with check (bucket_id = 'branding-logos' and (select auth.uid()::text) = (storage.foldername(name))[1]);

create policy "branding_logos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'branding-logos' and (select auth.uid()::text) = (storage.foldername(name))[1]);
