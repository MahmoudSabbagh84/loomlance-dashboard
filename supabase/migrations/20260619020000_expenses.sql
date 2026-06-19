create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  spent_on date not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null,
  category text not null,
  description text,
  receipt_path text,
  billable boolean not null default false,
  invoiced_on_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_user_spent_idx on public.expenses (user_id, spent_on desc);
create index expenses_project_idx on public.expenses (project_id);
create index expenses_client_idx on public.expenses (client_id);

create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;
create policy "expenses_select_own" on public.expenses for select using (user_id = auth.uid());
create policy "expenses_insert_own" on public.expenses for insert with check (user_id = auth.uid());
create policy "expenses_update_own" on public.expenses for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses_delete_own" on public.expenses for delete using (user_id = auth.uid());

-- Private receipts bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "receipts_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "receipts_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));

create or replace function public.generate_invoice_from_expenses(p_client_id uuid)
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

  select default_currency into v_currency from public.profiles where id = v_user;
  v_currency := coalesce(v_currency, 'USD');

  select count(*) into v_count
  from public.expenses e
  left join public.projects p on p.id = e.project_id
  where e.user_id = v_user and e.billable and e.invoiced_on_invoice_id is null
    and e.currency = v_currency
    and (e.client_id = p_client_id or (p.id is not null and p.client_id = p_client_id and p.user_id = v_user));
  if v_count = 0 then
    raise exception 'NO_BILLABLE_EXPENSES' using errcode = 'P0001';
  end if;

  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, p_client_id, v_number, 'draft', v_currency, current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select
    v_user, v_invoice_id,
    coalesce(nullif(btrim(e.description), ''), e.category),
    1,
    e.amount,
    0, 0,
    (row_number() over (order by e.spent_on, e.id)) - 1
  from public.expenses e
  left join public.projects p on p.id = e.project_id
  where e.user_id = v_user and e.billable and e.invoiced_on_invoice_id is null
    and e.currency = v_currency
    and (e.client_id = p_client_id or (p.id is not null and p.client_id = p_client_id and p.user_id = v_user));

  update public.expenses e
  set invoiced_on_invoice_id = v_invoice_id
  from (
    select e2.id
    from public.expenses e2
    left join public.projects p on p.id = e2.project_id
    where e2.user_id = v_user and e2.billable and e2.invoiced_on_invoice_id is null
      and e2.currency = v_currency
      and (e2.client_id = p_client_id or (p.id is not null and p.client_id = p_client_id and p.user_id = v_user))
  ) sel
  where e.id = sel.id;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_expenses(uuid) from public, anon;
grant execute on function public.generate_invoice_from_expenses(uuid) to authenticated;
