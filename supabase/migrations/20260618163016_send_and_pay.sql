-- 1. Optional link expiry.
alter table public.invoices add column if not exists link_expires_at timestamptz;

-- 2. Single-row app config; gates the mock payment RPC. RLS denies end-user access;
--    only SECURITY DEFINER functions (which bypass RLS) read it.
create table if not exists public.app_config (
  id boolean primary key default true check (id),
  mock_payments_enabled boolean not null default true
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;
alter table public.app_config enable row level security;

-- 3. Public read path: returns ONLY invoice-display fields by token; stamps viewed_at once.
create or replace function public.get_public_invoice(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select i.id, i.user_id, i.invoice_number, i.issue_date, i.due_date, i.currency, i.status,
         i.notes, i.terms, i.payment_instructions, i.viewed_at, i.link_expires_at,
         c.name as client_name, c.company as client_company, c.address as client_address,
         p.business_name, p.address as issuer_address, p.tax_id, p.logo_url,
         p.invoice_accent_color, p.invoice_footer, p.subscription_tier,
         p.stripe_connect_account_id
  into inv
  from public.invoices i
  join public.profiles p on p.id = i.user_id
  left join public.clients c on c.id = i.client_id
  where i.public_token = p_token;

  if not found then
    return null;
  end if;
  if inv.link_expires_at is not null and inv.link_expires_at < now() then
    return null;
  end if;

  if inv.viewed_at is null then
    update public.invoices set viewed_at = now() where id = inv.id;
    insert into public.user_notifications (user_id, kind, payload, link_to)
    values (
      inv.user_id, 'invoice_viewed',
      jsonb_build_object(
        'title', 'Invoice ' || inv.invoice_number || ' was viewed',
        'body', coalesce(inv.client_name, 'Your client') || ' opened it'
      ),
      '/invoices/' || inv.id
    );
  end if;

  return jsonb_build_object(
    'invoice_number', inv.invoice_number,
    'issue_date', inv.issue_date,
    'due_date', inv.due_date,
    'currency', inv.currency,
    'status', inv.status,
    'notes', inv.notes,
    'terms', inv.terms,
    'payment_instructions', inv.payment_instructions,
    'can_pay', (inv.stripe_connect_account_id is not null and inv.status not in ('paid','void')),
    'issuer', jsonb_build_object(
      'business_name', inv.business_name,
      'address', inv.issuer_address,
      'tax_id', inv.tax_id,
      'logo_url', inv.logo_url,
      'invoice_accent_color', inv.invoice_accent_color,
      'invoice_footer', inv.invoice_footer,
      'tier', inv.subscription_tier
    ),
    'client', jsonb_build_object(
      'name', inv.client_name,
      'company', inv.client_company,
      'address', inv.client_address
    ),
    'line_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', li.description, 'quantity', li.quantity, 'unit_price', li.unit_price,
        'tax_rate', li.tax_rate, 'discount_rate', li.discount_rate, 'position', li.position
      ) order by li.position)
      from public.invoice_line_items li where li.invoice_id = inv.id
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

-- 4. Owner-scoped token rotation (invalidates a shared link).
create or replace function public.regenerate_invoice_link(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  new_token := encode(extensions.gen_random_bytes(16), 'hex');
  update public.invoices set public_token = new_token
  where id = p_invoice_id and user_id = auth.uid();
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return new_token;
end;
$$;
revoke all on function public.regenerate_invoice_link(uuid) from public, anon;
grant execute on function public.regenerate_invoice_link(uuid) to authenticated;

-- 5. DEV-ONLY mock payment. Mirrors the real Stripe webhook's DB effect.
--    MUST be removed/disabled (app_config.mock_payments_enabled=false) in production.
create or replace function public.mock_pay_invoice(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  v_total numeric(14,2);
  v_enabled boolean;
begin
  select mock_payments_enabled into v_enabled from public.app_config where id = true;
  if not coalesce(v_enabled, false) then
    raise exception 'MOCK_PAYMENTS_DISABLED' using errcode = 'P0001';
  end if;

  select * into inv from public.invoices where public_token = p_token;
  if not found then
    raise exception 'INVOICE_LINK_INVALID' using errcode = 'P0001';
  end if;
  if inv.link_expires_at is not null and inv.link_expires_at < now() then
    raise exception 'INVOICE_LINK_INVALID' using errcode = 'P0001';
  end if;
  if inv.status in ('paid','void') then
    return jsonb_build_object('status', inv.status, 'already', true);
  end if;

  select coalesce(sum(
    round(
      (li.quantity*li.unit_price - round(li.quantity*li.unit_price*li.discount_rate/100.0, 2))
      + round((li.quantity*li.unit_price - round(li.quantity*li.unit_price*li.discount_rate/100.0, 2)) * li.tax_rate/100.0, 2)
    , 2)
  ), 0) into v_total
  from public.invoice_line_items li where li.invoice_id = inv.id;

  insert into public.invoice_payments (user_id, invoice_id, amount, currency, paid_at, method)
  values (inv.user_id, inv.id, v_total, inv.currency, now(), 'stripe');

  update public.invoices set status = 'paid', paid_at = now() where id = inv.id;

  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (
    inv.user_id, 'invoice_paid',
    jsonb_build_object(
      'title', 'Invoice ' || inv.invoice_number || ' was paid',
      'body', inv.currency || ' ' || to_char(v_total, 'FM999999990.00') || ' received'
    ),
    '/invoices/' || inv.id
  );

  return jsonb_build_object('status', 'paid', 'amount', v_total, 'currency', inv.currency);
end;
$$;
grant execute on function public.mock_pay_invoice(text) to anon, authenticated;
