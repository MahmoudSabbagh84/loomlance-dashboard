-- Enforce tier feature gating at the DATA layer.
-- UI gating (tier.js / TierGate / page UpgradeCards) is bypassable via the public REST API
-- with a user's own JWT, so a lower-tier user could create gated rows directly. This mirrors
-- enforce_project_limit and blocks the insert server-side. Matches src/lib/tier.js:
--   time tracking  -> tier_1, tier_2
--   recurring      -> tier_1, tier_2
--   expenses       -> tier_2 only
-- (Free has none of these. tier value itself is already service_role-only, so no self-upgrade.)
create or replace function public.enforce_tier_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier subscription_tier;
  v_feature text := tg_argv[0];
  v_ok boolean;
begin
  select subscription_tier into v_tier from public.profiles where id = new.user_id;
  if v_tier is null then v_tier := 'free'; end if;

  v_ok := case v_feature
    when 'time_tracking' then v_tier in ('tier_1', 'tier_2')
    when 'recurring'     then v_tier in ('tier_1', 'tier_2')
    when 'expenses'      then v_tier = 'tier_2'
    else false
  end;

  if not v_ok then
    raise exception 'FEATURE_NOT_IN_TIER'
      using errcode = 'P0001',
            detail = format('%s requires a higher plan (current tier: %s)', v_feature, v_tier);
  end if;
  return new;
end;
$$;

create trigger time_entries_enforce_tier
  before insert on public.time_entries
  for each row execute function public.enforce_tier_feature('time_tracking');

create trigger recurring_templates_enforce_tier
  before insert on public.recurring_invoice_templates
  for each row execute function public.enforce_tier_feature('recurring');

create trigger expenses_enforce_tier
  before insert on public.expenses
  for each row execute function public.enforce_tier_feature('expenses');
