-- LOO-5: remove the dev-only mock payment path before production. mock_pay_invoice was an
-- anon-callable SECURITY DEFINER write that marked invoices paid without Stripe; in prod the
-- stripe-webhook records payments. app_config only ever held mock_payments_enabled for it.
drop function if exists public.mock_pay_invoice(text);
drop table if exists public.app_config;
