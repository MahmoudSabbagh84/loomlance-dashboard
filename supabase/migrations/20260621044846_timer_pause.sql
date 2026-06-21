-- F7 timer rework: pause support on time entries.
alter table public.time_entries
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;
