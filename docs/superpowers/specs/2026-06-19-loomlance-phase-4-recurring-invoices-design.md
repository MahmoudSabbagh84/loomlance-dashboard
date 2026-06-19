# LoomLance Phase 4 — Recurring Invoices Design

**Status:** Approved 2026-06-19
**Phase 4 sub-project 4 of 5** (branding ✅ → time tracking ✅ → expenses ✅ → **recurring invoices** → reports). Each sub-project gets its own spec → plan → build cycle.

## 1. Goal

Let Tier 1+ freelancers define recurring invoice templates (client + line items + cadence) that a daily background job turns into **draft** invoices automatically, so repeat/retainer billing is one-time setup.

## 2. Scope

### In scope
- `recurring_invoice_templates` table (Tier 1+): client/project, cadence (weekly/monthly/quarterly/yearly), `line_items jsonb` snapshot, currency, due-days, `next_run_at`, `active`, optional `end_date`.
- A **daily pure-SQL `pg_cron` job** (matching the existing overdue/due-soon jobs — no Edge Function) that finds due active templates, generates a **draft** invoice + line items from the snapshot, advances `next_run_at` by one cadence interval, raises an in-app "Recurring invoice ready" notification, and flips `active=false` once `end_date` passes.
- A **"Generate now"** user RPC for immediate generation of a single template (first run / testing).
- UI at **`/invoices/recurring`** (Tier-gated `RECURRING_INVOICES`, tier_1+): a templates list (client, cadence, next run, active toggle, estimated amount), a standalone create/edit modal with a mini line-item editor, pause/resume, delete, and "Generate now". Reached via a **"Recurring"** button on the Invoices page header.

### Out of scope (later/never)
- **Auto-send** — dropped until real email is wired (Phase 3 "send" is mock). Generated invoices ALWAYS land as `draft`; the user reviews and sends manually. No `auto_send` column.
- Proration, mid-cycle edits to already-generated invoices, occurrence limits.
- **Catch-up generation** — at most ONE invoice per template per cron run; a long-dormant template does not back-fill missed cycles.
- Reports on recurring revenue (that is the Reports sub-project).

## 3. Data model (one migration)

```
recurring_invoice_templates
  id uuid pk default gen_random_uuid()
  user_id uuid not null            -- RLS scope; FK auth.users(id) on delete cascade
  client_id uuid not null          -- FK clients(id) on delete cascade
  project_id uuid                  -- FK projects(id) on delete set null (nullable)
  title text                       -- optional label, e.g. "Acme monthly retainer"
  cadence text not null            -- check in ('weekly','monthly','quarterly','yearly')
  line_items jsonb not null        -- snapshot: [{description, quantity, unit_price, tax_rate, discount_rate}, ...]
  currency text not null           -- defaults from profiles.default_currency (app-side)
  due_days int not null default 30 -- generated invoice due_date = issue_date + due_days
  notes text                       -- optional; copied onto each generated invoice
  next_run_at date not null        -- next date the job should fire (user picks the first one)
  end_date date                    -- optional; stop after this date
  active boolean not null default true
  last_generated_at timestamptz    -- bookkeeping; null until first run
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

- **Indexes:** `(user_id, created_at desc)`; partial due index `recurring_due_idx on (next_run_at) where active` for the cron scan.
- **RLS:** 4 policies (select/insert/update/delete), all `user_id = auth.uid()`. `set_updated_at` trigger (BEFORE UPDATE).
- **FK choices:** `client_id` ON DELETE **CASCADE** (a template is a future intent and makes no sense without its client — intentionally unlike `invoices.client_id` which is `restrict`, because an invoice is a financial record that must not vanish). `project_id` ON DELETE SET NULL.
- `next_run_at`, `end_date` are **dates** (the job runs daily at a fixed UTC hour; date granularity matches `issue_date`/`due_date`).
- `line_items` validated app-side: a non-empty array; each element `{ description (required, non-empty), quantity, unit_price, tax_rate, discount_rate }`. The generator coalesces quantity to 1 and tax/discount/unit_price to 0 when absent.

## 4. Scheduling model

- The user picks the first `next_run_at` via a **"Starts on"** date in the create form (default: today).
- Each generation advances `next_run_at := next_run_at + interval(cadence)` **from the scheduled date** (no drift): `weekly` = `7 days`, `monthly` = `1 month`, `quarterly` = `3 months`, `yearly` = `1 year`. (Postgres `date + interval 'N months'` clamps end-of-month correctly, e.g. Jan 31 + 1 month → Feb 28.)
- A template is **due** when `active and next_run_at <= current_date and (end_date is null or current_date <= end_date)`.
- After advancing, if `end_date is not null and next_run_at > end_date`, set `active = false` (the template has ended).

## 5. Generation logic (functions in the migration)

All three follow the established `SECURITY DEFINER`, `set search_path = public`, revoke/grant pattern (see `mark_overdue_invoices`, `generate_invoice_from_time`).

### 5.1 `run_recurring_template(p_template_id uuid) returns uuid` — internal worker
No auth check (runs in cron context). For the given template:
1. Load the row; if not found or not `active`, return null.
2. `v_number := public.next_invoice_number(t.user_id)`.
3. Insert a `draft` invoice: `user_id = t.user_id`, `client_id`, `project_id`, `invoice_number = v_number`, `currency = t.currency`, `issue_date = current_date`, `due_date = current_date + t.due_days`, `notes = t.notes`, `status = 'draft'`. Capture `v_invoice_id`.
4. Insert `invoice_line_items` from `t.line_items` jsonb, using `with ordinality` for `position` (0-based): `description = elem->>'description'`, `quantity = coalesce((elem->>'quantity')::numeric, 1)`, `unit_price = coalesce((elem->>'unit_price')::numeric, 0)`, `tax_rate = coalesce((elem->>'tax_rate')::numeric, 0)`, `discount_rate = coalesce((elem->>'discount_rate')::numeric, 0)`, `user_id = t.user_id`.
5. `update recurring_invoice_templates set next_run_at = next_run_at + <cadence interval>, last_generated_at = now(), active = case when end_date is not null and (next_run_at + <interval>) > end_date then false else active end where id = p_template_id`.
6. Insert `user_notifications` (`user_id = t.user_id`, `kind = 'recurring_invoice_created'`, `payload = jsonb_build_object('title', 'Recurring invoice ' || v_number || ' created', 'body', coalesce(client name,'A client'))`, `link_to = '/invoices/' || v_invoice_id`).
7. Return `v_invoice_id`.
- Revoked from `public, anon, authenticated` (internal only).

### 5.2 `generate_due_recurring_invoices() returns integer` — cron entry point
Global (like `mark_overdue_invoices`). Loops template ids where `active and next_run_at <= current_date and (end_date is null or current_date <= end_date)`, calls `run_recurring_template(id)` for each, returns the count generated. Revoked from `public, anon, authenticated`. Scheduled: `select cron.schedule('generate-recurring-invoices', '30 6 * * *', $$select public.generate_due_recurring_invoices();$$);` (06:30 UTC, after the existing 06:00/06:15 jobs; `cron.schedule` is idempotent by name).

### 5.3 `generate_recurring_invoice_now(p_template_id uuid) returns uuid` — user-facing
Verifies `exists(select 1 from recurring_invoice_templates where id = p_template_id and user_id = auth.uid())`, else `raise exception 'UNAUTHORIZED' using errcode='P0001'`. Then `return public.run_recurring_template(p_template_id)`. Granted to `authenticated` (revoked from public, anon). Powers the "Generate now" button. Note: this also advances `next_run_at` (same single code path), which is the intended behavior.

## 6. Components

### 6.1 API + hooks (`src/api/recurring-templates.js`, `src/hooks/useRecurringTemplates.js`)
- `listTemplates()` — `select … , clients(name), projects(name)` order by `created_at desc`.
- `createTemplate(payload)`, `updateTemplate(id, patch)`, `deleteTemplate(id)`, `setActive(id, active)` (an `updateTemplate` convenience).
- `generateNow(templateId)` — calls the `generate_recurring_invoice_now` RPC.
- Hooks wrap each with TanStack Query against key `['recurring-templates']`; `generateNow` invalidates `['recurring-templates']` and `['invoices']`.

### 6.2 Pure helpers (`src/lib/recurring.js` + `src/lib/__tests__/recurring.test.js`)
- `CADENCES` — `[{value:'weekly',label:'Weekly'}, …]`; `cadenceLabel(value)`.
- `validateTemplateLineItems(items)` — throws `AppError('UNKNOWN', …)` if empty or any line lacks a non-empty description; numeric fields coerced.
- **Estimated amount reuses the existing `invoiceTotals(lines)` from `@/lib/money`** (which already does the per-line discount→tax math via `lineTotal`). Do NOT add a new totals function — the template's preview/estimate is `invoiceTotals(lineItems).total`. `recurring.js` is only the cadence + validation helpers.

### 6.3 `/invoices/recurring` page (`src/pages/RecurringInvoicesPage.jsx` + `src/features/recurring/*`)
- Tier-gated: if `!hasFeature(tier, FEATURES.RECURRING_INVOICES)` → `<UpgradeCard feature={FEATURES.RECURRING_INVOICES} currentTier={tier} target="tier_1" />` (page guard + the entry button's lock = defense in depth).
- Header: **New template** button (opens `RecurringTemplateFormModal`); a back-link/breadcrumb to `/invoices`.
- `RecurringTemplatesTable`: title/client, cadence (`cadenceLabel`), next run (`formatDate(next_run_at)`), status badge (active / paused / "ended" when `end_date` past), estimated amount (`invoiceTotals(line_items).total` + `formatCurrency`); row actions: **Generate now**, pause/resume (toggle `active`), edit, delete.
- `RecurringTemplateFormModal` (create/edit): title, client select (`useClients({pageSize:200})` → `rows`), project select (optional, `useProjects({status:'all'})`), currency (default `profile?.default_currency`), cadence select (`CADENCES`), **Starts on** date (default today → `next_run_at`), optional **end date**, **due-days** number (default 30), notes, and a **mini line-item editor** (rows of description / qty / unit price / tax % / discount %, add+remove) with a live total via `invoiceTotals`. On submit, `validateTemplateLineItems` then create/update. The `line_items` are stored as the jsonb array.
- `ConfirmDialog` for delete; Sonner toasts for every mutation (success + `e.userMessage` error with a fallback string).

### 6.4 Invoices page link + routing
- Add a **"Recurring"** button (secondary) to the Invoices page header → `navigate('/invoices/recurring')`. If the user lacks the feature, it behaves like other tier-locked entry points (opens the upgrade dialog) — but the destination page also guards itself.
- New protected route `{ path: 'invoices/recurring', element: <RecurringInvoicesPage /> }` placed **before** `{ path: 'invoices/:id' }` in `src/app/routes.jsx` so it does not match the `:id` param.

## 7. Error handling
- `generate_recurring_invoice_now` on another user's template → `UNAUTHORIZED` (P0001) → mapped friendly message.
- Empty/invalid line items in the form → `validateTemplateLineItems` toast.
- Standard `mapPostgresError` / toast elsewhere.

## 8. Testing
- **Unit:** `src/lib/recurring.js` — `validateTemplateLineItems` (accept valid, reject empty + missing description), `cadenceLabel`. (`invoiceTotals` from `@/lib/money` is already covered by `money.test.js`; no new total tests needed.)
- **Live (via Supabase MCP, tier-2 test user, `ZZ-` markers):**
  1. Seed a template (`ZZ-` title) with `next_run_at = current_date`, monthly cadence, 2 snapshot line items. Call `generate_due_recurring_invoices()` → a `draft` invoice with the 2 line items exists; template `next_run_at` advanced by 1 month; `last_generated_at` set; a `recurring_invoice_created` notification created.
  2. Call `generate_recurring_invoice_now(template_id)` (with the test user's JWT via `set_config`) on a not-yet-due template → immediate draft; `next_run_at` advances again.
  3. Set `end_date` to yesterday on a template due today, run the cron fn → invoice generated and `active` flips to `false`.
  4. RLS check: calling `generate_recurring_invoice_now` for the template under a different `sub` claim → `UNAUTHORIZED`.
  5. Clean up: delete seeded invoices (+ line items), templates, notifications.
- Build + lint + full unit suite green.

## 9. Decisions made during brainstorming
- **Always draft** (no auto-send) until real email is wired — no `auto_send` column.
- **Standalone template form** (not "make recurring from an invoice"); `line_items` stored as a **jsonb snapshot**.
- **Stop condition = active toggle + optional `end_date`** (no occurrence limit).
- **Pure-SQL `pg_cron`** generation (no Edge Function), one shared worker (`run_recurring_template`) used by both the daily job and the manual "Generate now".
- **`next_run_at` advances from the scheduled date** (no drift); the user picks the first run.
- **One invoice per template per run** (no catch-up back-fill).
