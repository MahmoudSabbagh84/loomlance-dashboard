-- LOO-91: the master online-payments flag is gone — availability is derived from connection
-- state (see 20260625100000_payflow_connection_derived). Verified at design time: 0 accounts
-- were "online-off but provider-connected", so dropping changes no current account's behavior.
alter table public.profiles drop column if exists online_payments_enabled;
