# LoomLance Phase 4 — Time Tracking Design

**Status:** Approved 2026-06-18
**Phase 4 sub-project 2 of 5** (branding ✅ → **time tracking** → expenses → recurring → reports).

## 1. Goal

Let Tier 1+ freelancers track time against their projects — via a persistent topbar start/stop timer and manual entries — and turn unbilled billable time into a draft invoice with one click.

## 2. Scope

### In scope
- `time_entries` table (Tier 1+), every entry tied to a project.
- A **DB-backed** topbar timer: start (pick a project) → live elapsed → stop. One running timer per user; survives reload/device.
- Manual time entries (project, date, duration, description, billable, rate).
- A `/time` page: filterable entries list (project, date range, billed/unbilled), edit/delete, total hours, a default-rate field.
- **Generate invoice from unbilled time** (per client): group billable, unbilled entries by project + rate into a draft invoice, atomically, stamping the entries billed.
- `profiles.default_hourly_rate` to pre-fill new entries.
- Tier gating: `/time` route + topbar timer require `TIME_TRACKING` (tier_1+).

### Out of scope (later/never)
- Timesheets/approvals, per-user teams, idle detection, Pomodoro, calendar sync.
- Editing a *running* timer's project mid-run (stop, then edit).
- Reports on time (that's the Reports sub-project, which will read `time_entries`).

## 3. Data model (one migration)

```
time_entries
  id uuid pk
  user_id uuid not null            -- RLS scope
  project_id uuid not null         -- FK projects(id) on delete cascade
  task_id uuid                     -- FK tasks(id) on delete set null (nullable)
  started_at timestamptz not null
  ended_at timestamptz             -- NULL ⇒ running
  duration_minutes int             -- NULL while running; set on stop / entered for manual
  description text
  billable boolean not null default true
  hourly_rate numeric(10,2)        -- nullable; pre-filled from profiles.default_hourly_rate
  invoiced_on_invoice_id uuid      -- FK invoices(id) on delete set null; NULL ⇒ unbilled
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```
- Indexes: `(user_id, started_at desc)`; `(project_id)`.
- **Partial unique index** `time_entries_one_running on (user_id) where ended_at is null` — at most one running timer per user.
- RLS: 4 policies, all `user_id = auth.uid()`. `set_updated_at` trigger (BEFORE UPDATE).
- `profiles` gains `default_hourly_rate numeric(10,2)` (nullable).

**FK choices:** `project_id` ON DELETE CASCADE (deleting a project removes its time entries — consistent with tasks); `task_id` ON DELETE SET NULL; `invoiced_on_invoice_id` ON DELETE SET NULL (deleting/voiding the generated invoice frees the time to be billed again).

## 4. Duration math

- **Timer:** `start` inserts `{ started_at: now(), ended_at: null, duration_minutes: null }`. `stop` sets `ended_at = now()`, `duration_minutes = round((ended_at - started_at) / 60s)`. The UI shows live elapsed from `started_at` (a 1s tick).
- **Manual:** the user enters a **date** + a **duration** (hours/minutes). Stored as `started_at = date at 09:00`, `ended_at = started_at + duration`, `duration_minutes = entered`. (Exact clock times don't matter for manual; the date + duration do.)
- Hours for display/invoicing = `duration_minutes / 60`, rounded to 2 decimals.

## 5. Components

### 5.1 API + hooks (`src/api/time-entries.js`, `src/hooks/useTimeEntries.js`)
- `listTimeEntries({ projectId, from, to, status })` — `status` ∈ `all|unbilled|billed`; joins `projects(name, client_id, clients(name))`.
- `getRunningTimer()` — the single `ended_at is null` entry (or null).
- `startTimer({ projectId, description, hourlyRate })` — insert running entry (fails if one already runs → friendly "A timer is already running").
- `stopTimer(id)` — set `ended_at` + computed `duration_minutes`.
- `createManualEntry({ projectId, date, durationMinutes, description, billable, hourlyRate })`.
- `updateEntry(id, patch)`, `deleteEntry(id)`.
- `generateInvoiceFromTime(clientId)` — calls the RPC (below).
- Hooks wrap each with TanStack Query; the running-timer query uses a short `refetchInterval` so the topbar stays in sync across tabs.

### 5.2 Topbar `TimerWidget` (`src/features/time/TimerWidget.jsx`)
- Rendered in the Topbar **only for Tier 1+** (`hasFeature(tier, TIME_TRACKING)`).
- **Idle:** a "Start timer" button → a small popover with a **project select** (+ optional description) → `startTimer`.
- **Running:** shows the live elapsed `H:MM:SS` (ticking via a 1s interval off `started_at`) + the project name + a **Stop** button → `stopTimer`.
- Reads `getRunningTimer` so the state is correct on load and across devices.

### 5.3 `/time` page (`src/pages/TimePage.jsx` + `src/features/time/*`)
- Tier-gated: if not `hasFeature(tier, TIME_TRACKING)` → `<UpgradeCard feature={TIME_TRACKING} target="tier_1" />`.
- Header: a **Default rate** input (persists `profiles.default_hourly_rate` via `useUpdateProfile`), a **Log time** button (manual `TimeEntryFormModal`), and a **Generate invoice** button (`GenerateInvoiceModal`).
- Toolbar filters: project select, date range, billed/unbilled toggle.
- `TimeEntriesTable`: date, project, description, duration (h:mm), billable, rate, billed badge; row actions edit/delete. A footer **total hours** for the filtered set.
- `TimeEntryFormModal`: create/edit a manual entry (project, date, duration h+m, description, billable, rate pre-filled from default).
- `GenerateInvoiceModal`: a **client** select (clients with unbilled billable time); a preview of the grouped lines (project + rate → hours → amount); **Generate** → RPC → navigate to `/invoices/:id`.

### 5.4 Routing / nav
- New protected route `/time` (alongside the others, under `AuthGate`/`AppShell`). The Sidebar already lists **Time** as a Tier-1-locked item (unlocks for paid tiers; free → `UpgradeDialog`). The page itself also guards (defense in depth).

## 6. Invoice generation (atomic RPC)

`generate_invoice_from_time(p_client_id uuid) returns uuid` — `SECURITY DEFINER`, `set search_path = public`, scoped to `auth.uid()`:
1. Resolve `v_user = auth.uid()`; if null → raise `UNAUTHORIZED`.
2. Select the caller's `time_entries` where `billable` and `invoiced_on_invoice_id is null` and `ended_at is not null`, joined to `projects` where `projects.client_id = p_client_id and projects.user_id = v_user`. If none → raise `NO_UNBILLED_TIME`.
3. `next_invoice_number(v_user)` → number; insert a `draft` invoice (`user_id`, `client_id = p_client_id`, currency = `profiles.default_currency`, issue_date today, due_date +30).
4. Insert one `invoice_line_items` row per `(project_id, hourly_rate)` group: `description = project name`, `quantity = round(sum(duration_minutes)/60, 2)`, `unit_price = coalesce(hourly_rate, 0)`, `tax_rate = 0`, `discount_rate = 0`, `position` by group order.
5. `update time_entries set invoiced_on_invoice_id = <new id>` for the selected entries.
6. Return the new invoice id.

Atomic (single function) so time is never stamped without an invoice and vice-versa. New error codes `NO_UNBILLED_TIME` → "No unbilled time for this client." added to `lib/errors.js`.

## 7. Error handling
- Starting a second timer → `time_entries_one_running` unique violation → mapped to a friendly "A timer is already running."
- `generate_invoice_from_time` with no eligible time → `NO_UNBILLED_TIME` toast.
- Standard `mapPostgresError`/toast elsewhere.

## 8. Testing
- **Unit:** duration math (`stop` rounding; manual hours→minutes) and the time→line-items grouping helper (group by project+rate, sum hours).
- **Live Playwright (tier-2 test user, self-cleaning `ZZ`/seeded markers):** start timer on a project → elapsed ticks → stop → entry with duration; log a manual entry; filter unbilled; **Generate invoice** for the client → draft invoice opens with the grouped lines; the billed entries now show "billed" and drop from unbilled. Then delete the seeded entries + the generated invoice; clear the test user's `default_hourly_rate`.

## 9. Decisions made during brainstorming
- **DB-backed timer, project required up front** (one running timer per user; reload/device-safe).
- **Invoice generation groups by project + rate** (one line per group), scoped to one client, atomic via an RPC, stamping entries billed.
- **`profiles.default_hourly_rate`** added to pre-fill entries (set on the Time page).
- **Topbar timer kept** (Tier 1+).
