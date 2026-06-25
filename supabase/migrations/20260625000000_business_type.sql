-- business_type drives ONLY the BusinessTab labels (registered business vs. solo under own
-- name). The stored "from" field stays business_name; nothing downstream changes.
-- Default 'business' keeps every existing account identical to today.
alter table public.profiles
  add column if not exists business_type text not null default 'business';

alter table public.profiles
  drop constraint if exists profiles_business_type_check;
alter table public.profiles
  add constraint profiles_business_type_check
  check (business_type in ('business', 'individual'));
