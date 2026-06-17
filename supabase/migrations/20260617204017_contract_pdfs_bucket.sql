insert into storage.buckets (id, name, public) values ('contract-pdfs', 'contract-pdfs', false) on conflict do nothing;

create policy "contract_pdfs_select_own"
  on storage.objects for select
  using (bucket_id = 'contract-pdfs' and (storage.foldername(name))[1] in (
    select id::text from public.contracts where user_id = auth.uid()
  ));

create policy "contract_pdfs_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'contract-pdfs' and (storage.foldername(name))[1] in (
    select id::text from public.contracts where user_id = auth.uid()
  ));

create policy "contract_pdfs_delete_own"
  on storage.objects for delete
  using (bucket_id = 'contract-pdfs' and (storage.foldername(name))[1] in (
    select id::text from public.contracts where user_id = auth.uid()
  ));
