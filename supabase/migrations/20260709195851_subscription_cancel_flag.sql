-- Track whether a subscription is set to cancel at period end (Stripe cancel_at_period_end).
-- Lets the Subscription tab show "won't renew / cancels on <date>" while the user still has
-- access, instead of implying the plan will renew. Written only by the subscription webhook.
alter table public.profiles
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

-- Extend the billing-column guard so end users (authenticated/anon) can't flip this flag
-- themselves via the REST API — same posture as the other server-controlled billing columns.
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
    new.subscription_tier                 := old.subscription_tier;
    new.subscription_status               := old.subscription_status;
    new.stripe_customer_id                := old.stripe_customer_id;
    new.stripe_subscription_id            := old.stripe_subscription_id;
    new.current_period_end                := old.current_period_end;
    new.stripe_connect_account_id         := old.stripe_connect_account_id;
    new.subscription_cancel_at_period_end := old.subscription_cancel_at_period_end;
  end if;
  return new;
end;
$$;
