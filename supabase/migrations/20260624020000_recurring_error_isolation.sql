-- Per-template error isolation for the daily recurring-invoice cron.
-- One bad template (malformed line_items, deleted client FK, …) previously raised
-- and aborted the whole batch, silently denying every later freelancer their invoice.
-- Each iteration now runs in its own subtransaction: a failure rolls back only that
-- template's partial writes, logs a warning, and the loop continues.
create or replace function public.generate_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.recurring_invoice_templates
    where active and next_run_at <= current_date and (end_date is null or current_date <= end_date)
  loop
    begin
      if public.run_recurring_template(r.id) is not null then
        n := n + 1;
      end if;
    exception when others then
      raise warning '[recurring] template % failed: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;
revoke all on function public.generate_due_recurring_invoices() from public, anon, authenticated;
