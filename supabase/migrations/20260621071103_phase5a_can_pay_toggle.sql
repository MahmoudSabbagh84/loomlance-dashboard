-- Phase 5a: public can_pay must also respect the per-user online_payments_enabled toggle.
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
         p.stripe_connect_account_id, p.online_payments_enabled
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
    'can_pay', (inv.online_payments_enabled and inv.stripe_connect_account_id is not null and inv.status not in ('paid','void')),
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
