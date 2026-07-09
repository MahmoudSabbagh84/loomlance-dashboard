-- Contract e-signature: signing lifecycle on the contracts table (no new table).
-- Client signs on a hosted /c/:token page; token-gated SECURITY DEFINER RPCs mirror the
-- change-request flow. Ciphertext-free — the drawn signature is a small base64 PNG stored inline.
alter table public.contracts
  add column public_token text unique,
  add column link_expires_at timestamptz,
  add column signing_pdf_url text,
  add column sent_at timestamptz,
  add column signed_at timestamptz,
  add column signer_name text,
  add column signature_image text,
  add column signer_ip text,
  add column signer_user_agent text,
  add column content_hash text,
  add column declined_at timestamptz,
  add column decline_reason text;
create index contracts_public_token_idx on public.contracts (public_token);

-- Owner: issue link + mark sent.
create or replace function public.send_contract(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  update public.contracts
     set status = case when status = 'draft' then 'sent'::contract_status else status end,
         sent_at = coalesce(sent_at, now()),
         public_token = coalesce(public_token, encode(extensions.gen_random_bytes(16), 'hex'))
   where id = p_id and user_id = auth.uid()
   returning public_token into v_token;
  return v_token;
end; $$;

-- Owner: rotate link.
create or replace function public.regenerate_contract_link(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  update public.contracts set public_token = v_token where id = p_id and user_id = auth.uid();
  if not found then return null; end if;
  return v_token;
end; $$;

-- Public read: curated fields by token; null on missing/expired.
create or replace function public.get_public_contract(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select ct.id, ct.title, ct.description, ct.value, ct.currency, ct.start_date, ct.end_date,
         ct.status, ct.signing_pdf_url, ct.signed_at, ct.signer_name, ct.link_expires_at,
         p.business_name, p.logo_url, p.invoice_accent_color,
         cl.name as client_name
    into c
    from public.contracts ct
    join public.profiles p on p.id = ct.user_id
    left join public.clients cl on cl.id = ct.client_id
   where ct.public_token = p_token;
  if not found then return null; end if;
  if c.link_expires_at is not null and c.link_expires_at < now() then return null; end if;
  return jsonb_build_object(
    'title', c.title, 'description', c.description, 'value', c.value, 'currency', c.currency,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'signing_pdf_url', c.signing_pdf_url, 'already_signed', c.signed_at is not null,
    'signer_name', c.signer_name, 'signed_at', c.signed_at,
    'business_name', c.business_name, 'logo_url', c.logo_url, 'accent_color', c.invoice_accent_color,
    'client_name', c.client_name);
end; $$;

-- Public write: sign. Idempotent — only a 'sent' contract is signable. Captures IP/UA + content hash.
create or replace function public.sign_contract(p_token text, p_signer_name text, p_signature_image text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; v_headers json; v_hash text;
begin
  select * into c from public.contracts where public_token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.link_expires_at is not null and c.link_expires_at < now() then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'sent' then return jsonb_build_object('status', c.status, 'already', true); end if;
  if coalesce(p_consent, false) is not true or coalesce(btrim(p_signer_name), '') = '' or coalesce(p_signature_image, '') = '' then
    return jsonb_build_object('error', 'invalid');
  end if;

  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_hash := encode(extensions.digest(
    concat_ws('|', c.title, coalesce(c.description,''), coalesce(c.value::text,''), c.currency,
              coalesce(c.start_date::text,''), coalesce(c.end_date::text,'')), 'sha256'), 'hex');

  update public.contracts
     set status = 'active'::contract_status, signed_at = now(), signer_name = btrim(p_signer_name),
         signature_image = p_signature_image, content_hash = v_hash,
         signer_ip = coalesce(v_headers->>'x-forwarded-for', ''),
         signer_user_agent = coalesce(v_headers->>'user-agent', '')
   where id = c.id;

  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (c.user_id, 'contract_signed',
          jsonb_build_object('title', 'Contract signed', 'body', c.title || ' was signed by ' || btrim(p_signer_name)),
          '/contracts/' || c.id::text);
  return jsonb_build_object('status', 'active', 'ok', true, 'content_hash', v_hash);
end; $$;

-- Public write: decline.
create or replace function public.decline_contract(p_token text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.contracts where public_token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if c.status <> 'sent' then return jsonb_build_object('status', c.status, 'already', true); end if;
  update public.contracts set status = 'canceled'::contract_status, declined_at = now(), decline_reason = p_reason where id = c.id;
  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (c.user_id, 'contract_declined',
          jsonb_build_object('title', 'Contract declined', 'body', c.title || ' was declined'),
          '/contracts/' || c.id::text);
  return jsonb_build_object('status', 'canceled', 'ok', true);
end; $$;

revoke all on function public.send_contract(uuid) from public, anon;
revoke all on function public.regenerate_contract_link(uuid) from public, anon;
grant execute on function public.send_contract(uuid) to authenticated;
grant execute on function public.regenerate_contract_link(uuid) to authenticated;
grant execute on function public.get_public_contract(text) to anon, authenticated;
grant execute on function public.sign_contract(text, text, text, boolean) to anon, authenticated;
grant execute on function public.decline_contract(text, text) to anon, authenticated;
