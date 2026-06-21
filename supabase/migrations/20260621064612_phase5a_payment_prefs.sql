-- Phase 5a: per-user payment preferences.
alter table public.profiles
  add column if not exists online_payments_enabled boolean not null default false,
  add column if not exists default_payment_instructions text,
  add column if not exists paypal_link text;
