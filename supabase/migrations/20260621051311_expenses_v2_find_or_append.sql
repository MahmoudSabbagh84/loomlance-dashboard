-- Expenses v2 + unify: find-or-append a per-project (or per-client) draft invoice.

-- Internal: return the latest matching draft for (user, client, project-or-null, currency), else create one.
create or replace function public._find_or_create_draft(p_user uuid, p_client uuid, p_project uuid, p_currency text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.invoices
  where user_id = p_user and status = 'draft' and currency = p_currency
    and client_id = p_client and project_id is not distinct from p_project
  order by created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.invoices (user_id, client_id, project_id, invoice_number, status, currency, issue_date, due_date)
  values (p_user, p_client, p_project, public.next_invoice_number(p_user), 'draft', p_currency, current_date, current_date + 30)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public._find_or_create_draft(uuid,uuid,uuid,text) from public, anon, authenticated;

-- Time billing: now find-or-append onto the project's draft (was: always insert).
create or replace function public.generate_invoice_from_time_for_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_client uuid;
  v_invoice_id uuid;
  v_currency text;
  v_count int;
  v_base int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select client_id into v_client from public.projects where id = p_project_id and user_id = v_user;
  if v_client is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.time_entries te
  where te.user_id = v_user and te.project_id = p_project_id
    and te.billable and te.invoiced_on_invoice_id is null and te.ended_at is not null;
  if v_count = 0 then
    raise exception 'NO_UNBILLED_TIME' using errcode = 'P0001';
  end if;

  select default_currency into v_currency from public.profiles where id = v_user;
  v_currency := coalesce(v_currency, 'USD');

  v_invoice_id := public._find_or_create_draft(v_user, v_client, p_project_id, v_currency);
  select coalesce(max(position), -1) into v_base from public.invoice_line_items where invoice_id = v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select
    v_user, v_invoice_id,
    coalesce(c.title, pr.name || ' — time'),
    round(sum(te.duration_minutes)::numeric / 60, 2),
    coalesce(te.hourly_rate, 0),
    0, 0,
    v_base + (row_number() over (order by c.title nulls last, te.hourly_rate))
  from public.time_entries te
  join public.projects pr on pr.id = te.project_id
  left join public.contracts c on c.id = te.contract_id
  where te.user_id = v_user and te.project_id = p_project_id
    and te.billable and te.invoiced_on_invoice_id is null and te.ended_at is not null
  group by c.id, c.title, pr.name, te.hourly_rate;

  update public.time_entries te
  set invoiced_on_invoice_id = v_invoice_id
  where te.user_id = v_user and te.project_id = p_project_id
    and te.billable and te.invoiced_on_invoice_id is null and te.ended_at is not null;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_time_for_project(uuid) from public, anon;
grant execute on function public.generate_invoice_from_time_for_project(uuid) to authenticated;

-- Expenses billing: per project, find-or-append.
create or replace function public.generate_invoice_from_expenses_for_project(p_project_id uuid, p_currency text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_client uuid;
  v_invoice_id uuid;
  v_count int;
  v_base int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  select client_id into v_client from public.projects where id = p_project_id and user_id = v_user;
  if v_client is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.expenses e
  where e.user_id = v_user and e.project_id = p_project_id
    and e.billable and e.invoiced_on_invoice_id is null and e.currency = p_currency;
  if v_count = 0 then
    raise exception 'NO_BILLABLE_EXPENSES' using errcode = 'P0001';
  end if;

  v_invoice_id := public._find_or_create_draft(v_user, v_client, p_project_id, p_currency);
  select coalesce(max(position), -1) into v_base from public.invoice_line_items where invoice_id = v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select v_user, v_invoice_id,
    coalesce(nullif(btrim(e.description), ''), e.category),
    1, e.amount, 0, 0,
    v_base + (row_number() over (order by e.spent_on, e.id))
  from public.expenses e
  where e.user_id = v_user and e.project_id = p_project_id
    and e.billable and e.invoiced_on_invoice_id is null and e.currency = p_currency;

  update public.expenses e
  set invoiced_on_invoice_id = v_invoice_id
  where e.user_id = v_user and e.project_id = p_project_id
    and e.billable and e.invoiced_on_invoice_id is null and e.currency = p_currency;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_expenses_for_project(uuid,text) from public, anon;
grant execute on function public.generate_invoice_from_expenses_for_project(uuid,text) to authenticated;

-- Expenses billing: client-only (no project), find-or-append onto a per-client draft.
create or replace function public.generate_invoice_from_expenses_for_client(p_client_id uuid, p_currency text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invoice_id uuid;
  v_count int;
  v_base int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id and user_id = v_user) then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.expenses e
  where e.user_id = v_user and e.project_id is null and e.client_id = p_client_id
    and e.billable and e.invoiced_on_invoice_id is null and e.currency = p_currency;
  if v_count = 0 then
    raise exception 'NO_BILLABLE_EXPENSES' using errcode = 'P0001';
  end if;

  v_invoice_id := public._find_or_create_draft(v_user, p_client_id, null, p_currency);
  select coalesce(max(position), -1) into v_base from public.invoice_line_items where invoice_id = v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select v_user, v_invoice_id,
    coalesce(nullif(btrim(e.description), ''), e.category),
    1, e.amount, 0, 0,
    v_base + (row_number() over (order by e.spent_on, e.id))
  from public.expenses e
  where e.user_id = v_user and e.project_id is null and e.client_id = p_client_id
    and e.billable and e.invoiced_on_invoice_id is null and e.currency = p_currency;

  update public.expenses e
  set invoiced_on_invoice_id = v_invoice_id
  where e.user_id = v_user and e.project_id is null and e.client_id = p_client_id
    and e.billable and e.invoiced_on_invoice_id is null and e.currency = p_currency;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_expenses_for_client(uuid,text) from public, anon;
grant execute on function public.generate_invoice_from_expenses_for_client(uuid,text) to authenticated;

drop function if exists public.generate_invoice_from_expenses(uuid);
