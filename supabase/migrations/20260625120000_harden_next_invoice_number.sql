-- LOO-91 go-live audit: next_invoice_number is SECURITY DEFINER and EXECUTE-able by
-- authenticated (the app calls it on invoice create). Without a guard, a signed-in user
-- could pass another user's id and advance/observe their invoice sequence. Add an ownership
-- guard. auth.uid() is null for internal SECURITY DEFINER / pg_cron recurring callers, which
-- legitimately pass the template owner's id — allow those through.
create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  insert into public.invoice_number_sequences (user_id, last_number)
    values (p_user_id, 1)
  on conflict (user_id) do update set last_number = invoice_number_sequences.last_number + 1
  returning last_number into v_next;
  return 'INV-' || lpad(v_next::text, 4, '0');
end;
$$;
