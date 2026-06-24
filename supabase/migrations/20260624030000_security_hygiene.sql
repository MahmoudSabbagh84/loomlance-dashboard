-- Security hygiene (advisors 0011, 0028, 0029).

-- 0011: pin a stable search_path on the one flagged function.
alter function public.set_updated_at() set search_path = public;

-- 0028/0029: these are TRIGGER functions — they must not be reachable via the REST RPC
-- surface (/rest/v1/rpc/...). Triggers fire regardless of EXECUTE grants, so revoking is safe.
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.enforce_project_limit() from anon, authenticated, public;
revoke execute on function public.enforce_tier_feature() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.protect_billing_columns() from anon, authenticated, public;
revoke execute on function public.seed_default_columns() from anon, authenticated, public;

-- next_invoice_number is an authenticated app RPC; the anon role never needs it.
revoke execute on function public.next_invoice_number(uuid) from anon, public;
