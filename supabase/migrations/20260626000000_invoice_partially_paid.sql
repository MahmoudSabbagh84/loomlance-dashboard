-- LOO-35: partial (manual) payments. An invoice with some but not all of its
-- balance recorded sits in 'partially_paid' until the balance clears.
alter type public.invoice_status add value if not exists 'partially_paid';
