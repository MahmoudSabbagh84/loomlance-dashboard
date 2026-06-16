create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier subscription_tier;
  v_limit integer;
  v_active_count integer;
  is_becoming_active boolean;
begin
  -- On INSERT: count only if new row will be active.
  -- On UPDATE: count only if status is transitioning into 'active' from a non-active state.
  if (tg_op = 'INSERT') then
    is_becoming_active := (new.status = 'active' and new.archived_at is null);
  else
    is_becoming_active := (new.status = 'active' and new.archived_at is null and (old.status <> 'active' or old.archived_at is not null));
  end if;

  if not is_becoming_active then
    return new;
  end if;

  select subscription_tier into v_tier from public.profiles where id = new.user_id;
  if v_tier is null then v_tier := 'free'; end if;

  v_limit := case v_tier
    when 'free' then 1
    when 'tier_1' then 5
    when 'tier_2' then 2147483647
  end;

  select count(*) into v_active_count
  from public.projects
  where user_id = new.user_id
    and status = 'active'
    and archived_at is null
    and id <> new.id;

  if v_active_count >= v_limit then
    raise exception 'PROJECT_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger projects_enforce_limit_insert
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

create trigger projects_enforce_limit_update
  before update of status, archived_at on public.projects
  for each row execute function public.enforce_project_limit();
