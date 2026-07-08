-- Atomic "Bill this change": create the draft invoice + line item and stamp billed_invoice_id
-- in one transaction, guarded so an approved change can be billed at most once. Mirrors
-- generate_invoice_from_time_for_project. Also revokes the default PUBLIC execute on the two
-- owner-only RPCs (convention: owner RPCs are authenticated-only), matching regenerate_invoice_link.
create or replace function public.bill_change_request(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  cr record;
  v_invoice_id uuid;
  v_number text;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  -- Owner-scoped, approved, and not already billed — the guard that makes this idempotent.
  select * into cr
  from public.change_requests
  where id = p_id and user_id = v_user and status = 'approved' and billed_invoice_id is null;
  if not found then
    raise exception 'NOT_BILLABLE' using errcode = 'P0001';
  end if;

  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, project_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, cr.client_id, cr.project_id, v_number, 'draft', cr.currency, current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  values (
    v_user, v_invoice_id, cr.title,
    case when cr.hours is not null and cr.hourly_rate is not null then cr.hours else 1 end,
    case when cr.hours is not null and cr.hourly_rate is not null then cr.hourly_rate else cr.amount end,
    0, 0, 0
  );

  update public.change_requests set billed_invoice_id = v_invoice_id where id = cr.id;

  return v_invoice_id;
end;
$$;

revoke all on function public.send_change_request(uuid) from public, anon;
revoke all on function public.regenerate_change_request_link(uuid) from public, anon;
revoke all on function public.bill_change_request(uuid) from public, anon;
grant execute on function public.bill_change_request(uuid) to authenticated;
