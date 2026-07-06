-- CRITICAL SECURITY FIX: `profiles.is_admin` (added in 20260706200014_blog_foundation.sql)
-- is guarded by RLS at the row level only, so any authenticated user could UPDATE their own
-- `is_admin` column directly via the REST API and self-escalate to admin (bypassing every
-- posts_*_admin / blog_images_*_admin policy that gates on public.is_admin()). Fold the same
-- pin into the existing protect_billing_columns() trigger (20260622020000) rather than adding
-- a second trigger: for end-user (authenticated/anon) updates, is_admin is forced back to its
-- previous value. service_role (Edge Functions) and direct/no-JWT infra connections (e.g. the
-- owner granting admin via the SQL editor, which runs as postgres with no request.jwt.claims)
-- still bypass the pin, exactly as the other server-controlled columns already do.
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
    new.is_admin                  := old.is_admin;
  end if;
  return new;
end;
$$;
