-- Fix: contracts default to status 'active', so send_contract must move ANY not-yet-signed
-- contract to 'sent' (the old draft-only guard left default-'active' contracts stuck, which
-- made the public page render a fake "Signed" state). Also drop the redundant index — the
-- public_token UNIQUE constraint already provides one.
create or replace function public.send_contract(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  update public.contracts
     set status = case when signed_at is null then 'sent'::contract_status else status end,
         sent_at = coalesce(sent_at, now()),
         public_token = coalesce(public_token, encode(extensions.gen_random_bytes(16), 'hex'))
   where id = p_id and user_id = auth.uid()
   returning public_token into v_token;
  return v_token;
end; $$;

drop index if exists public.contracts_public_token_idx;
