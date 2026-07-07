-- admin_user_list() v2: has_stripe_subscription now means a LIVE subscription — a canceled
-- (deleted) Stripe subscription emits no further webhook events, so churned ex-subscribers
-- can safely be comped and must not read as "live in Stripe" in the admin UI.
-- Same SECURITY DEFINER / service_role-only posture as v1 (20260707213642).
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
    (p.stripe_subscription_id is not null and p.subscription_status <> 'canceled') as has_stripe_subscription
  from auth.users u
  join public.profiles p on p.id = u.id
  order by u.created_at desc;
$$;

-- Restated so this migration is independently replay-safe (create-or-replace preserves the
-- ACL in-sequence, but a standalone replay would otherwise leave default PUBLIC execute).
revoke all on function public.admin_user_list() from public;
revoke all on function public.admin_user_list() from anon;
revoke all on function public.admin_user_list() from authenticated;
grant execute on function public.admin_user_list() to service_role;
