-- GitHub integration foundation: connection tables + commit-completion scope toggle.

-- Per-user smart-commit resolution scope.
alter table public.profiles
  add column if not exists commit_completion_scope text not null default 'project'
    check (commit_completion_scope in ('project', 'cross_project'));

-- GitHub App installations (one row per installation the user authorized).
create table public.github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login text,
  account_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.github_installations enable row level security;
create policy "github_installations_select_own" on public.github_installations for select using (user_id = auth.uid());
create policy "github_installations_insert_own" on public.github_installations for insert with check (user_id = auth.uid());
create policy "github_installations_update_own" on public.github_installations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "github_installations_delete_own" on public.github_installations for delete using (user_id = auth.uid());

-- One repo linked per project (the link drives the issues lane).
create table public.project_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  installation_id bigint not null,
  repo_id bigint not null,
  repo_full_name text not null,
  default_branch text not null default 'main',
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz
);
alter table public.project_repos enable row level security;
create policy "project_repos_select_own" on public.project_repos for select using (user_id = auth.uid());
create policy "project_repos_insert_own" on public.project_repos for insert with check (user_id = auth.uid());
create policy "project_repos_update_own" on public.project_repos for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "project_repos_delete_own" on public.project_repos for delete using (user_id = auth.uid());

-- Read-only mirror of OPEN GitHub issues (rendered in the board's Issues lane).
-- Writes come from the webhook (service_role); users only read their own rows.
create table public.github_issue_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  repo_id bigint not null,
  issue_number integer not null,
  title text not null,
  state text not null default 'open',
  html_url text,
  labels jsonb not null default '[]'::jsonb,
  assignee_login text,
  github_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (project_id, issue_number)
);
alter table public.github_issue_cards enable row level security;
create policy "github_issue_cards_select_own" on public.github_issue_cards for select using (user_id = auth.uid());
-- no insert/update/delete policies: service_role (webhook) only.

-- Webhook delivery idempotency (service_role only; RLS on, no policies -> users have no access).
create table public.github_events (
  delivery_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);
alter table public.github_events enable row level security;
