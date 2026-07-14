-- Gate the owner-side scope-creep change-request RPCs to Freelancer+ (tier_1/tier_2).
-- The client UI is gated (ChangeRequestsPanel), but these SECURITY DEFINER RPCs are callable
-- directly with a user's JWT, so the tier check must live here too. Public token flows
-- (get_public_change_request / respond_to_change_request) stay OPEN — the client approving a
-- change request is not the gated action; the freelancer CREATING/billing one is.
-- CREATE OR REPLACE only; never mutate the original 20260708161417 / 20260708163422 migrations.

create or replace function public.send_change_request(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_tier subscription_tier;
begin
  select subscription_tier into v_tier from public.profiles where id = auth.uid();
  if coalesce(v_tier, 'free') not in ('tier_1', 'tier_2') then
    raise exception 'FEATURE_NOT_IN_TIER'
      using errcode = 'P0001', detail = 'change_requests requires a Freelancer or Studio plan';
  end if;

  update public.change_requests
     set status = case when status = 'draft' then 'sent' else status end,
         sent_at = coalesce(sent_at, now()),
         public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', ''))
   where id = p_id and user_id = auth.uid()
   returning public_token into v_token;
  return v_token;
end;
$$;

create or replace function public.bill_change_request(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tier subscription_tier;
  cr record;
  v_invoice_id uuid;
  v_number text;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select subscription_tier into v_tier from public.profiles where id = v_user;
  if coalesce(v_tier, 'free') not in ('tier_1', 'tier_2') then
    raise exception 'FEATURE_NOT_IN_TIER'
      using errcode = 'P0001', detail = 'change_requests requires a Freelancer or Studio plan';
  end if;

  -- Owner-scoped, approved, and not already billed — the guard that makes this idempotent.
  select * into cr
  from public.change_requests
  where id = p_id and user_id = v_user and status = 'approved' and billed_invoice_id is null;
  if not found then
    raise exception 'NOT_BILLABLE' using errcode = 'P0001';
  end if;

  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, project_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, cr.client_id, cr.project_id, v_number, 'draft', cr.currency, current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  values (
    v_user, v_invoice_id, cr.title,
    case when cr.hours is not null and cr.hourly_rate is not null then cr.hours else 1 end,
    case when cr.hours is not null and cr.hourly_rate is not null then cr.hourly_rate else cr.amount end,
    0, 0, 0
  );

  update public.change_requests set billed_invoice_id = v_invoice_id where id = cr.id;

  return v_invoice_id;
end;
$$;

-- Re-assert the owner-only grant posture (must match 20260708163422 after CREATE OR REPLACE).
revoke all on function public.send_change_request(uuid) from public, anon;
revoke all on function public.bill_change_request(uuid) from public, anon;
grant execute on function public.send_change_request(uuid) to authenticated;
grant execute on function public.bill_change_request(uuid) to authenticated;

-- regenerate_change_request_link mints a fresh public_token (same "activate" effect as send), so
-- gate it too. CREATE OR REPLACE preserves its original body (20260708161417) plus the tier check.
create or replace function public.regenerate_change_request_link(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_tier subscription_tier;
begin
  select subscription_tier into v_tier from public.profiles where id = auth.uid();
  if coalesce(v_tier, 'free') not in ('tier_1', 'tier_2') then
    raise exception 'FEATURE_NOT_IN_TIER'
      using errcode = 'P0001', detail = 'change_requests requires a Freelancer or Studio plan';
  end if;
  update public.change_requests set public_token = v_token
   where id = p_id and user_id = auth.uid();
  if not found then return null; end if;
  return v_token;
end;
$$;
revoke all on function public.regenerate_change_request_link(uuid) from public, anon;
grant execute on function public.regenerate_change_request_link(uuid) to authenticated;

-- change_requests RLS is FOR ALL, so an owner could bypass the gated RPCs with a direct REST PATCH
-- that sets status='sent' / a public_token. Gate the "activate the public link" transition at the
-- data layer, regardless of how it's written. The public approve/decline path
-- (respond_to_change_request) sets status to approved/declined and never touches public_token, so
-- it is unaffected.
create or replace function public.enforce_change_request_send_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_tier subscription_tier;
begin
  if (new.status = 'sent'::change_request_status and old.status is distinct from 'sent'::change_request_status)
     or (new.public_token is distinct from old.public_token and new.public_token is not null) then
    select subscription_tier into v_tier from public.profiles where id = new.user_id;
    if coalesce(v_tier, 'free') not in ('tier_1', 'tier_2') then
      raise exception 'FEATURE_NOT_IN_TIER'
        using errcode = 'P0001', detail = 'change_requests requires a Freelancer or Studio plan';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists change_requests_enforce_send_tier on public.change_requests;
create trigger change_requests_enforce_send_tier
  before update on public.change_requests
  for each row execute function public.enforce_change_request_send_tier();
