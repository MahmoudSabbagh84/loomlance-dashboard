-- Project financials: optional budget + append-only change log + atomic setter.

alter table public.projects
  add column budget_amount numeric(12,2) check (budget_amount is null or budget_amount >= 0),
  add column budget_currency text;

create table public.project_budget_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  previous_amount numeric(12,2),
  new_amount numeric(12,2),
  currency text not null,
  note text,
  created_at timestamptz not null default now()
);
create index project_budget_changes_project_idx
  on public.project_budget_changes (project_id, created_at desc);

alter table public.project_budget_changes enable row level security;
create policy "pbc_select_own" on public.project_budget_changes
  for select using (user_id = auth.uid());
create policy "pbc_insert_own" on public.project_budget_changes
  for insert with check (user_id = auth.uid());

-- Single owner-checked path for every budget change -> guarantees the log row.
create or replace function public.set_project_budget(
  p_project_id uuid, p_amount numeric, p_currency text, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_prev numeric(12,2);
begin
  if v_user is null then raise exception 'UNAUTHORIZED' using errcode = 'P0001'; end if;
  select user_id, budget_amount into v_owner, v_prev
    from public.projects where id = p_project_id;
  if v_owner is null or v_owner <> v_user then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.projects
    set budget_amount = p_amount, budget_currency = p_currency
    where id = p_project_id;
  insert into public.project_budget_changes
    (user_id, project_id, previous_amount, new_amount, currency, note)
  values
    (v_user, p_project_id, v_prev, p_amount, p_currency,
     nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;
revoke all on function public.set_project_budget(uuid, numeric, text, text) from public, anon;
grant execute on function public.set_project_budget(uuid, numeric, text, text) to authenticated;
