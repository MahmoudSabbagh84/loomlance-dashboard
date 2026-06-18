-- Public bucket: logos must load on the anonymous public invoice page + emailed PDFs.
insert into storage.buckets (id, name, public) values ('branding-logos', 'branding-logos', true)
on conflict (id) do nothing;

-- Public read is automatic for a public bucket. Writes are scoped to the caller's own folder.
create policy "branding_logos_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'branding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_logos_update_own"
  on storage.objects for update
  using (bucket_id = 'branding-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "branding_logos_delete_own"
  on storage.objects for delete
  using (bucket_id = 'branding-logos' and (storage.foldername(name))[1] = auth.uid()::text);
