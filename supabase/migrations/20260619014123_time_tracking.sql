alter table public.profiles add column if not exists default_hourly_rate numeric(10,2);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  description text,
  billable boolean not null default true,
  hourly_rate numeric(10,2),
  invoiced_on_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_user_started_idx on public.time_entries (user_id, started_at desc);
create index time_entries_project_idx on public.time_entries (project_id);
create unique index time_entries_one_running on public.time_entries (user_id) where ended_at is null;

create trigger time_entries_set_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;
create policy "time_entries_select_own" on public.time_entries for select using (user_id = auth.uid());
create policy "time_entries_insert_own" on public.time_entries for insert with check (user_id = auth.uid());
create policy "time_entries_update_own" on public.time_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "time_entries_delete_own" on public.time_entries for delete using (user_id = auth.uid());

create or replace function public.generate_invoice_from_time(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invoice_id uuid;
  v_number text;
  v_currency text;
  v_count int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.time_entries te
  join public.projects p on p.id = te.project_id
  where te.user_id = v_user and te.billable and te.invoiced_on_invoice_id is null
    and te.ended_at is not null and p.client_id = p_client_id and p.user_id = v_user;
  if v_count = 0 then
    raise exception 'NO_UNBILLED_TIME' using errcode = 'P0001';
  end if;

  select default_currency into v_currency from public.profiles where id = v_user;
  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, p_client_id, v_number, 'draft', coalesce(v_currency, 'USD'), current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select
    v_user, v_invoice_id,
    p.name || ' — time',
    round(sum(te.duration_minutes)::numeric / 60, 2),
    coalesce(te.hourly_rate, 0),
    0, 0,
    (row_number() over (order by p.name, te.hourly_rate)) - 1
  from public.time_entries te
  join public.projects p on p.id = te.project_id
  where te.user_id = v_user and te.billable and te.invoiced_on_invoice_id is null
    and te.ended_at is not null and p.client_id = p_client_id and p.user_id = v_user
  group by p.id, p.name, te.hourly_rate;

  update public.time_entries te
  set invoiced_on_invoice_id = v_invoice_id
  from public.projects p
  where te.project_id = p.id and te.user_id = v_user and te.billable
    and te.invoiced_on_invoice_id is null and te.ended_at is not null
    and p.client_id = p_client_id and p.user_id = v_user;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_time(uuid) from public, anon;
grant execute on function public.generate_invoice_from_time(uuid) to authenticated;
