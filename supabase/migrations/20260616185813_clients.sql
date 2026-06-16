create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on public.clients (user_id);
create index clients_user_id_name_idx on public.clients (user_id, name);
create index clients_archived_at_idx on public.clients (user_id) where archived_at is null;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_select_own" on public.clients for select using (user_id = auth.uid());
create policy "clients_insert_own" on public.clients for insert with check (user_id = auth.uid());
create policy "clients_update_own" on public.clients for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clients_delete_own" on public.clients for delete using (user_id = auth.uid());

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_contacts_client_id_idx on public.client_contacts (client_id);

create trigger client_contacts_set_updated_at
  before update on public.client_contacts
  for each row execute function public.set_updated_at();

-- Enforce at most one primary contact per client
create unique index client_contacts_one_primary_per_client
  on public.client_contacts (client_id)
  where is_primary;

alter table public.client_contacts enable row level security;

create policy "client_contacts_select_own" on public.client_contacts for select using (user_id = auth.uid());
create policy "client_contacts_insert_own" on public.client_contacts for insert with check (user_id = auth.uid());
create policy "client_contacts_update_own" on public.client_contacts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "client_contacts_delete_own" on public.client_contacts for delete using (user_id = auth.uid());
