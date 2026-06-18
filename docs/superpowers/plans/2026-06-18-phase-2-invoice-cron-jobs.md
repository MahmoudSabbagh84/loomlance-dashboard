# Invoice Background Jobs Implementation Plan (Phase 2 · Milestone 5)

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Daily scheduled jobs that (1) mark sent/viewed invoices overdue once past their due date, and (2) create in-app "due soon" notifications for invoices due within 3 days.

**Architecture:** Both jobs are pure database operations, so they run as `SECURITY DEFINER` SQL functions scheduled with `pg_cron` — no Edge Function/HTTP needed (email reminders are Phase 3). Functions are owned by the migration role (bypass RLS to act across all users) and have `EXECUTE` revoked from `anon`/`authenticated` so end users can't invoke them (privilege-escalation guard). The due-soon notifier dedupes by `link_to` so each invoice is notified at most once.

**Tech Stack:** Postgres `pg_cron` 1.6.4 · existing `invoices` (status enum incl. `overdue`) · `user_notifications` (`kind`, `payload` jsonb `{title,body}`, `link_to`, `read_at`). Applied to the hosted project via MCP; local migration file written to match.

**Schedule (06:00 UTC per spec):** `mark_overdue_invoices` at `0 6 * * *`; `notify_due_soon_invoices` at `15 6 * * *` (after overdue, so past-due invoices aren't also flagged "due soon").

---

### Task 1: Migration — extension, functions, grants, schedule

**Files:**
- Create: `supabase/migrations/<version>_invoice_cron_jobs.sql` (mirror what MCP applies)

- [ ] **Step 1:** Apply via MCP `apply_migration`:
  - `create extension if not exists pg_cron;`
  - `public.mark_overdue_invoices()` → `update invoices set status='overdue' where status in ('sent','viewed') and due_date < current_date`; returns row count. `security definer`, `set search_path = public`.
  - `public.notify_due_soon_invoices()` → insert into `user_notifications (user_id, kind='invoice_due_soon', payload=jsonb{title,body}, link_to='/invoices/'||id)` for invoices `status in ('sent','viewed') and due_date between current_date and current_date+3`, deduped via `not exists` on same `kind`+`link_to`. Returns count. `security definer`, `set search_path = public`.
  - `revoke all on function ...() from public, anon, authenticated;` for both.
  - `select cron.schedule('mark-overdue-invoices','0 6 * * *', $$select public.mark_overdue_invoices();$$);`
  - `select cron.schedule('notify-due-soon-invoices','15 6 * * *', $$select public.notify_due_soon_invoices();$$);`
- [ ] **Step 2:** `list_migrations` (MCP) → write `supabase/migrations/<version>_invoice_cron_jobs.sql` to match. Commit.

---

### Task 2: Verify and commit

- [ ] **Step 1:** Confirm via MCP: `pg_cron` installed; `cron.job` has both jobs; `EXECUTE` revoked from authenticated.
- [ ] **Step 2:** Functional test (MCP, self-cleaning): seed for the test user (a) a sent invoice with `due_date = current_date - 1` → run `mark_overdue_invoices()` → assert it became `overdue`; (b) a sent invoice with `due_date = current_date + 2` → run `notify_due_soon_invoices()` → assert one `invoice_due_soon` notification row created with correct `payload.title`/`link_to`; run it again → assert NO duplicate. Delete seeded invoices + notifications.
- [ ] **Step 3:** Commit: `feat(invoices): pg_cron jobs for overdue marking + due-soon notifications`.

---
```
