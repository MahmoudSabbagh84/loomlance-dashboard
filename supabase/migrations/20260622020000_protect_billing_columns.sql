-- F6 subscription billing columns.
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz;

-- CRITICAL SECURITY FIX: the `profiles_update_own` RLS policy is row-level only, so an
-- authenticated user could UPDATE their own `subscription_tier` / `subscription_status` /
-- `stripe_*` columns directly via the REST API (self-upgrade to any tier, defeating all
-- gating including the enforce_tier_feature triggers). RLS can't restrict columns, so guard
-- them with a trigger: for end-user (authenticated/anon) updates, the server-controlled
-- columns are forced back to their previous values. service_role (Edge Functions / webhook)
-- and direct/no-JWT infra connections may still set them.
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  if v_role in ('authenticated', 'anon') then
    new.subscription_tier         := old.subscription_tier;
    new.subscription_status       := old.subscription_status;
    new.stripe_customer_id        := old.stripe_customer_id;
    new.stripe_subscription_id    := old.stripe_subscription_id;
    new.current_period_end        := old.current_period_end;
    new.stripe_connect_account_id := old.stripe_connect_account_id;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_billing
  before update on public.profiles
  for each row execute function public.protect_billing_columns();
