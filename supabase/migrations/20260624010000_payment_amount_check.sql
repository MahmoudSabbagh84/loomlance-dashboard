-- Data-quality guard: a recorded payment must be a positive amount.
alter table public.invoice_payments
  add constraint invoice_payments_amount_positive check (amount > 0);
