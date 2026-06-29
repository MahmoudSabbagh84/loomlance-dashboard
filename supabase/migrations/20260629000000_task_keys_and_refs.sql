-- Per-project task keys + sequential task ref numbers (e.g. LLM-001).

-- 1. New columns (task_key nullable until backfilled).
alter table public.projects
  add column task_key text,
  add column last_task_number integer not null default 0;

alter table public.tasks
  add column ref_number integer;

-- 2. Backfill a unique-per-user task_key for every existing project.
do $$
declare
  p record;
  base text;
  candidate text;
  n int;
begin
  for p in select id, user_id, name from public.projects order by created_at loop
    base := upper(regexp_replace(coalesce(p.name, ''), '[^a-zA-Z0-9]', '', 'g'));
    if base !~ '^[A-Za-z]' then base := 'P' || base; end if;
    if length(base) < 2 then base := 'PRJ'; end if;
    base := left(base, 5);
    candidate := base;
    n := 1;
    while exists (
      select 1 from public.projects
      where user_id = p.user_id and task_key = candidate
    ) loop
      n := n + 1;
      candidate := left(base, greatest(1, 5 - length(n::text))) || n::text;
    end loop;
    update public.projects set task_key = candidate where id = p.id;
  end loop;
end $$;

-- 3. Backfill ref_number per project (sequential by creation), and last_task_number.
with numbered as (
  select id,
         row_number() over (partition by project_id order by created_at, id) as rn
  from public.tasks
)
update public.tasks t
set ref_number = numbered.rn
from numbered
where numbered.id = t.id;

update public.projects p
set last_task_number = coalesce(
  (select max(ref_number) from public.tasks where project_id = p.id), 0
);

-- 4. Lock down task_key now that data exists.
alter table public.projects
  alter column task_key set not null,
  add constraint projects_user_id_task_key_key unique (user_id, task_key),
  add constraint projects_task_key_format check (task_key ~ '^[A-Z][A-Z0-9]{1,4}$');

-- 5. Assign ref_number on every future task insert (atomic per project).
create or replace function public.assign_task_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ref_number is null then
    update public.projects
      set last_task_number = last_task_number + 1
      where id = new.project_id
      returning last_task_number into new.ref_number;
  end if;
  return new;
end;
$$;

create trigger tasks_assign_ref
  before insert on public.tasks
  for each row execute function public.assign_task_ref();
