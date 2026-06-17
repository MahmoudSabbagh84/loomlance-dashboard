create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  link_to text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_notifications_user_idx on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
create policy "user_notifications_select_own" on public.user_notifications for select using (user_id = auth.uid());
create policy "user_notifications_update_own" on public.user_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Inserts come from server-side jobs (service_role), not end users.

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;
create policy "usage_events_insert_own"
  on public.usage_events for insert
  with check (user_id is null or user_id = auth.uid());
-- No SELECT for end users; analytics consumes via service_role.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.error_logs enable row level security;
create policy "error_logs_insert_own"
  on public.error_logs for insert
  with check (user_id is null or user_id = auth.uid());
