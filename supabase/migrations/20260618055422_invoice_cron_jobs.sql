-- Background jobs for invoice lifecycle (Phase 2).
-- Pure-SQL jobs scheduled with pg_cron; no Edge Function needed (email is Phase 3).

create extension if not exists pg_cron;

-- 1) Mark sent/viewed invoices overdue once their due date has passed.
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.invoices
  set status = 'overdue'
  where status in ('sent', 'viewed')
    and due_date < current_date;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 2) Create in-app "due soon" notifications for invoices due within 3 days.
--    Deduped by link_to so each invoice is notified at most once.
create or replace function public.notify_due_soon_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.user_notifications (user_id, kind, payload, link_to)
  select
    i.user_id,
    'invoice_due_soon',
    jsonb_build_object(
      'title', 'Invoice ' || i.invoice_number || ' is due soon',
      'body', coalesce(c.name, 'A client') || ' · due ' || to_char(i.due_date, 'Mon DD')
    ),
    '/invoices/' || i.id
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  where i.status in ('sent', 'viewed')
    and i.due_date >= current_date
    and i.due_date <= current_date + 3
    and not exists (
      select 1
      from public.user_notifications un
      where un.user_id = i.user_id
        and un.kind = 'invoice_due_soon'
        and un.link_to = '/invoices/' || i.id
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- These act across all users (cron context). End users must not be able to call them.
revoke all on function public.mark_overdue_invoices() from public;
revoke all on function public.notify_due_soon_invoices() from public;
revoke all on function public.mark_overdue_invoices() from anon, authenticated;
revoke all on function public.notify_due_soon_invoices() from anon, authenticated;

-- Schedule daily at 06:00 UTC (overdue first, then due-soon at 06:15 so past-due
-- invoices are excluded from the due-soon window). cron.schedule is idempotent by name.
select cron.schedule('mark-overdue-invoices', '0 6 * * *', $$select public.mark_overdue_invoices();$$);
select cron.schedule('notify-due-soon-invoices', '15 6 * * *', $$select public.notify_due_soon_invoices();$$);
