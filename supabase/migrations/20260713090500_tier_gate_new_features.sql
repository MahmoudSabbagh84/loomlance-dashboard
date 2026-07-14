-- Data-layer tier enforcement for the three differentiators (GitHub, scope-creep change requests,
-- credential vault) — Freelancer+ (tier_1/tier_2), mirroring src/lib/tier.js. Extends the existing
-- enforce_tier_feature() (20260622010000) and adds BEFORE INSERT triggers so a lower-tier user
-- can't create these rows directly via the REST API (bypassing the client UpgradeCards). These
-- gate CREATE only — read / reveal / update / delete are untouched, so no one is ever locked out
-- of data they already own. Pre-flight audit (2026-07-13) confirmed 0 free users hold any of these
-- rows, so there is nothing to grandfather.

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
    when 'time_tracking'   then v_tier in ('tier_1', 'tier_2')
    when 'recurring'       then v_tier in ('tier_1', 'tier_2')
    when 'expenses'        then v_tier = 'tier_2'
    when 'change_requests' then v_tier in ('tier_1', 'tier_2')
    when 'vault'           then v_tier in ('tier_1', 'tier_2')
    when 'github'          then v_tier in ('tier_1', 'tier_2')
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

-- Backstop the REST-bypass CREATE path for each differentiator. The vault trigger fires even on
-- the service-role insert inside the vault-store edge function (it reads profiles by NEW.user_id),
-- so a free owner cannot populate a vault even if the edge 403 were bypassed.
drop trigger if exists change_requests_enforce_tier on public.change_requests;
create trigger change_requests_enforce_tier
  before insert on public.change_requests
  for each row execute function public.enforce_tier_feature('change_requests');

drop trigger if exists vault_credentials_enforce_tier on public.vault_credentials;
create trigger vault_credentials_enforce_tier
  before insert on public.vault_credentials
  for each row execute function public.enforce_tier_feature('vault');

drop trigger if exists github_installations_enforce_tier on public.github_installations;
create trigger github_installations_enforce_tier
  before insert on public.github_installations
  for each row execute function public.enforce_tier_feature('github');

-- project_repos is the other GitHub write path an authenticated user can reach directly via REST
-- (its RLS allows an owner INSERT), so gate it too — otherwise "close the REST-create path" is
-- only half done.
drop trigger if exists project_repos_enforce_tier on public.project_repos;
create trigger project_repos_enforce_tier
  before insert on public.project_repos
  for each row execute function public.enforce_tier_feature('github');

-- Enforce one ACTIVE link per repo GLOBALLY. github-link-repo enforced this only in app code, which
-- a direct REST insert bypasses; without it, another tenant could insert a row with a victim's
-- (public, enumerable) repo_id and make the webhook's repo lookup ambiguous, silently breaking the
-- victim's issue mirroring + commit auto-completion. Verified 0 existing duplicates before adding.
create unique index if not exists project_repos_active_repo_uniq
  on public.project_repos (repo_id) where disconnected_at is null;
