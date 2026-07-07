-- admin_user_list(): per-user support roster for the admin Users page (Phase 3).
-- SECURITY DEFINER because auth.users is not readable by app roles; EXECUTE locked to
-- service_role (called only by the admin-users edge function behind the admin gate).
-- Returns account/subscription state only — no password hashes, tokens, or auth internals.
-- Unlike admin_user_stats(), the demo user IS included (support tooling sees every account).
create or replace function public.admin_user_list()
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  subscription_tier text,
  subscription_status text,
  current_period_end timestamptz,
  is_admin boolean,
  has_stripe_subscription boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    p.display_name,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    p.subscription_tier::text,
    p.subscription_status::text,
    p.current_period_end,
    p.is_admin,
    (p.stripe_subscription_id is not null) as has_stripe_subscription
  from auth.users u
  join public.profiles p on p.id = u.id
  order by u.created_at desc;
$$;

revoke all on function public.admin_user_list() from public;
revoke all on function public.admin_user_list() from anon;
revoke all on function public.admin_user_list() from authenticated;
grant execute on function public.admin_user_list() to service_role;
