create type contract_status as enum ('draft', 'active', 'completed', 'expired', 'canceled');
create type invoice_status as enum ('draft', 'sent', 'viewed', 'paid', 'overdue', 'void');
create type payment_method as enum ('stripe', 'bank', 'cash', 'other', 'manual');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  start_date date,
  end_date date,
  value numeric(14,2),
  currency text not null default 'USD',
  status contract_status not null default 'active',
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_user_id_idx on public.contracts (user_id);
create index contracts_client_id_idx on public.contracts (client_id);

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

alter table public.contracts enable row level security;
create policy "contracts_select_own" on public.contracts for select using (user_id = auth.uid());
create policy "contracts_insert_own" on public.contracts for insert with check (user_id = auth.uid());
create policy "contracts_update_own" on public.contracts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "contracts_delete_own" on public.contracts for delete using (user_id = auth.uid());

create table public.invoice_number_sequences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_number integer not null default 0
);
alter table public.invoice_number_sequences enable row level security;
-- No user-visible policies; modified only via SECURITY DEFINER function below.

create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.invoice_number_sequences (user_id, last_number)
    values (p_user_id, 1)
  on conflict (user_id) do update set last_number = invoice_number_sequences.last_number + 1
  returning last_number into v_next;
  return 'INV-' || lpad(v_next::text, 4, '0');
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  currency text not null default 'USD',
  status invoice_status not null default 'draft',
  notes text,
  terms text,
  payment_instructions text,
  public_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_project_id_idx on public.invoices (project_id);
create index invoices_status_idx on public.invoices (user_id, status);
create unique index invoices_public_token_idx on public.invoices (public_token);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
create policy "invoices_select_own" on public.invoices for select using (user_id = auth.uid());
create policy "invoices_insert_own" on public.invoices for insert with check (user_id = auth.uid());
create policy "invoices_update_own" on public.invoices for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoices_delete_own" on public.invoices for delete using (user_id = auth.uid());

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  discount_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoice_line_items_invoice_id_idx on public.invoice_line_items (invoice_id, position);

create trigger invoice_line_items_set_updated_at
  before update on public.invoice_line_items
  for each row execute function public.set_updated_at();

alter table public.invoice_line_items enable row level security;
create policy "invoice_line_items_select_own" on public.invoice_line_items for select using (user_id = auth.uid());
create policy "invoice_line_items_insert_own" on public.invoice_line_items for insert with check (user_id = auth.uid());
create policy "invoice_line_items_update_own" on public.invoice_line_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoice_line_items_delete_own" on public.invoice_line_items for delete using (user_id = auth.uid());

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null,
  paid_at timestamptz not null default now(),
  method payment_method not null default 'manual',
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_id_idx on public.invoice_payments (invoice_id);
create unique index invoice_payments_stripe_pi_idx on public.invoice_payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

alter table public.invoice_payments enable row level security;
create policy "invoice_payments_select_own" on public.invoice_payments for select using (user_id = auth.uid());
create policy "invoice_payments_insert_own" on public.invoice_payments for insert with check (user_id = auth.uid());
create policy "invoice_payments_delete_own" on public.invoice_payments for delete using (user_id = auth.uid());
-- No UPDATE on payments — corrections are via delete + insert.
