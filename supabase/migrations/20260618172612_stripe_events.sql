-- Idempotency ledger for Stripe webhook events. Only the webhook (service role) touches it.
create table if not exists public.stripe_events (
  id text primary key,        -- Stripe event id (evt_...)
  type text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- No policies → end users (anon/authenticated) cannot read or write it.
