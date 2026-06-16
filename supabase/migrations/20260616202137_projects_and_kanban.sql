create type project_status as enum ('active', 'paused', 'archived');
create type task_priority as enum ('low', 'medium', 'high');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  status project_status not null default 'active',
  color text not null default '#2D3E50',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);
create index projects_client_id_idx on public.projects (client_id);
create index projects_active_idx on public.projects (user_id) where status = 'active';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
create policy "projects_select_own" on public.projects for select using (user_id = auth.uid());
create policy "projects_insert_own" on public.projects for insert with check (user_id = auth.uid());
create policy "projects_update_own" on public.projects for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "projects_delete_own" on public.projects for delete using (user_id = auth.uid());

create table public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  position integer not null,
  wip_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kanban_columns_project_id_idx on public.kanban_columns (project_id, position);

create trigger kanban_columns_set_updated_at
  before update on public.kanban_columns
  for each row execute function public.set_updated_at();

alter table public.kanban_columns enable row level security;
create policy "kanban_columns_select_own" on public.kanban_columns for select using (user_id = auth.uid());
create policy "kanban_columns_insert_own" on public.kanban_columns for insert with check (user_id = auth.uid());
create policy "kanban_columns_update_own" on public.kanban_columns for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kanban_columns_delete_own" on public.kanban_columns for delete using (user_id = auth.uid());

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  column_id uuid not null references public.kanban_columns(id) on delete cascade,
  title text not null,
  description text,
  position double precision not null default 0,
  due_date date,
  priority task_priority not null default 'medium',
  labels jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_column_position_idx on public.tasks (column_id, position) where archived_at is null;
create index tasks_project_idx on public.tasks (project_id) where archived_at is null;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select using (user_id = auth.uid());
create policy "tasks_insert_own" on public.tasks for insert with check (user_id = auth.uid());
create policy "tasks_update_own" on public.tasks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on public.tasks for delete using (user_id = auth.uid());

-- Auto-seed default columns when a project is created
create or replace function public.seed_default_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.kanban_columns (user_id, project_id, name, position) values
    (new.user_id, new.id, 'To Do', 0),
    (new.user_id, new.id, 'In Progress', 1),
    (new.user_id, new.id, 'Review', 2),
    (new.user_id, new.id, 'Done', 3);
  return new;
end;
$$;

create trigger projects_seed_columns
  after insert on public.projects
  for each row execute function public.seed_default_columns();
