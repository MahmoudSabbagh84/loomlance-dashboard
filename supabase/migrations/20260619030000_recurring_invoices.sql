create table public.recurring_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text,
  cadence text not null check (cadence in ('weekly','monthly','quarterly','yearly')),
  line_items jsonb not null,
  currency text not null,
  due_days int not null default 30,
  notes text,
  next_run_at date not null,
  end_date date,
  active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_user_created_idx on public.recurring_invoice_templates (user_id, created_at desc);
create index recurring_due_idx on public.recurring_invoice_templates (next_run_at) where active;

create trigger recurring_set_updated_at before update on public.recurring_invoice_templates
  for each row execute function public.set_updated_at();

alter table public.recurring_invoice_templates enable row level security;
create policy "recurring_select_own" on public.recurring_invoice_templates for select using (user_id = auth.uid());
create policy "recurring_insert_own" on public.recurring_invoice_templates for insert with check (user_id = auth.uid());
create policy "recurring_update_own" on public.recurring_invoice_templates for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recurring_delete_own" on public.recurring_invoice_templates for delete using (user_id = auth.uid());

-- Internal worker: generate ONE invoice from a template, advance the schedule, notify. No auth check.
create or replace function public.run_recurring_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.recurring_invoice_templates%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_interval interval;
  v_next date;
  v_client_name text;
begin
  select * into t from public.recurring_invoice_templates where id = p_template_id;
  if not found or not t.active then
    return null;
  end if;

  v_number := public.next_invoice_number(t.user_id);

  insert into public.invoices (user_id, client_id, project_id, invoice_number, status, currency, issue_date, due_date, notes)
  values (t.user_id, t.client_id, t.project_id, v_number, 'draft', t.currency, current_date, current_date + t.due_days, t.notes)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, position, description, quantity, unit_price, tax_rate, discount_rate)
  select
    t.user_id, v_invoice_id, (li.ord - 1)::int,
    coalesce(li.elem->>'description', ''),
    coalesce((li.elem->>'quantity')::numeric, 1),
    coalesce((li.elem->>'unit_price')::numeric, 0),
    coalesce((li.elem->>'tax_rate')::numeric, 0),
    coalesce((li.elem->>'discount_rate')::numeric, 0)
  from jsonb_array_elements(t.line_items) with ordinality as li(elem, ord);

  v_interval := case t.cadence
    when 'weekly' then interval '7 days'
    when 'monthly' then interval '1 month'
    when 'quarterly' then interval '3 months'
    when 'yearly' then interval '1 year'
  end;
  v_next := (t.next_run_at + v_interval)::date;

  update public.recurring_invoice_templates
  set next_run_at = v_next,
      last_generated_at = now(),
      active = case when t.end_date is not null and v_next > t.end_date then false else active end
  where id = p_template_id;

  select name into v_client_name from public.clients where id = t.client_id;
  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (
    t.user_id,
    'recurring_invoice_created',
    jsonb_build_object('title', 'Recurring invoice ' || v_number || ' created', 'body', coalesce(v_client_name, 'A client')),
    '/invoices/' || v_invoice_id
  );

  return v_invoice_id;
end;
$$;
revoke all on function public.run_recurring_template(uuid) from public, anon, authenticated;

-- Cron entry point: generate all due templates. Global (runs across users).
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
    if public.run_recurring_template(r.id) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.generate_due_recurring_invoices() from public, anon, authenticated;

-- User-facing manual trigger.
create or replace function public.generate_recurring_invoice_now(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recurring_invoice_templates where id = p_template_id and user_id = v_user) then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  return public.run_recurring_template(p_template_id);
end;
$$;
revoke all on function public.generate_recurring_invoice_now(uuid) from public, anon;
grant execute on function public.generate_recurring_invoice_now(uuid) to authenticated;

-- Schedule daily at 06:30 UTC (after the existing 06:00 overdue + 06:15 due-soon jobs).
select cron.schedule('generate-recurring-invoices', '30 6 * * *', $$select public.generate_due_recurring_invoices();$$);
