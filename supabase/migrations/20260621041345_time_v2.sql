-- Time Page v2: per-entry contract link, contract hourly rate, per-project time-billing RPC.

alter table public.time_entries
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;
create index if not exists time_entries_contract_id_idx on public.time_entries (contract_id);

alter table public.contracts
  add column if not exists hourly_rate numeric;

-- Per-project time billing (replaces the per-client generate_invoice_from_time).
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
  v_number text;
  v_currency text;
  v_count int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select client_id into v_client
  from public.projects
  where id = p_project_id and user_id = v_user;
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
  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, project_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, v_client, p_project_id, v_number, 'draft', coalesce(v_currency, 'USD'), current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select
    v_user, v_invoice_id,
    coalesce(c.title, pr.name || ' — time'),
    round(sum(te.duration_minutes)::numeric / 60, 2),
    coalesce(te.hourly_rate, 0),
    0, 0,
    (row_number() over (order by c.title nulls last, te.hourly_rate)) - 1
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

drop function if exists public.generate_invoice_from_time(uuid);
