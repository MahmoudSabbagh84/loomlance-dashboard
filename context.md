# Continuation Context — LoomLance Dashboard

> **Purpose:** Hand off this work session to a fresh Claude Code session (possibly on another computer) so it can pick up with no re-explanation. Read top-to-bottom, then see **"Where we are right now."**
>
> **Last updated:** 2026-06-21 (later session — **Phase 5a SES email is now LIVE** + **autosave Phase 1 shipped**). Everything committed to `main` (HEAD `dc35bf4` or later); **not pushed unless you ask**. Live-QA COMPLETE (F1–F17 ✅); Phases 8/9/10 shipped; **5a email = LIVE & verified**. Source of truth: `docs/phases.md` + `docs/qa-findings.md` + `docs/superpowers/specs/2026-06-21-phase-5-real-integrations.md` + `docs/superpowers/{specs,plans}/2026-06-21-autosave*`.
>
> ### ⏭️ RESUME HERE
> 1. `git pull` if syncing machines. `npm install` if deps differ; recreate `.env.local` if missing (see §0 — note `VITE_EMAIL_PROVIDER=ses` now). `npx vitest run` (**87 green**).
> 2. **Autosave everywhere = DONE** (Phase 12) — invoice editor + all 5 modals + profile tabs autosave; no manual Save. `useAutosave` (per-field) + `useAutosaveForm` (whole-form) in `src/hooks/useAutosave.js`; `<SaveStatus>`. Explicit-only: Send, Generate, Mark-paid, Delete, uploads, password, Stripe connect. Plan: `docs/superpowers/plans/2026-06-21-autosave.md`.
> 3. **Phase 5a (SES email) + 5b (Stripe pay) are LIVE & verified** (Stripe in test mode). Remaining chores (USER): delete the root AWS access key pasted during setup; swap the `loomlance` CLI profile (currently root in `183631341841`) for a scoped non-root user; for Stripe go-live switch to `sk_live_` + live webhook + activate live mode + point `PUBLIC_SITE_URL`/`VITE_PUBLIC_SITE_URL` at the deployed dashboard.
> 4. Then **5c (PayPal link MVP)** — code-buildable now; see the Phase 5 spec. (`.env.local` now: `VITE_EMAIL_PROVIDER=ses`, `VITE_PAYMENTS_PROVIDER=stripe`, `VITE_PUBLIC_SITE_URL=http://localhost:4173`; `app_config.mock_payments_enabled=false`.)
> 5. **superpowers** plugin not installed on this Mac — brainstorm/plan run manually (artifacts still in `docs/superpowers/`).

---

## 0. TL;DR / environment

- Working on **macOS** now (was Windows). **Superpowers plugin is NOT installed on this machine** — the brainstorm → spec → plan flow was run **manually** (same artifacts land in `docs/superpowers/specs|plans/`). Don't try to invoke `superpowers:*` skills here.
- **Env (gitignored `.env.local` exists):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (fetched via Supabase MCP), `VITE_PUBLIC_SITE_URL=http://localhost:5173`, **`VITE_EMAIL_PROVIDER=ses`** (real email — SES is live), `VITE_PAYMENTS_PROVIDER=mock`. If `.env.local` is missing, recreate from `.env.example` (URL = `https://zbipqfsqxnvrzhpdjvvy.supabase.co`; anon key via `mcp__supabase__get_publishable_keys`).
- **AWS SES (Phase 5a, LIVE):** account `183631341841`; identity `send.loomlance.com` (Easy DKIM + MAIL FROM `bounce.send.loomlance.com` + DMARC, in Route 53); production access granted; IAM sender `loomlance-ses-sender` (scoped `ses:SendEmail`); Supabase secrets set; `send-invoice` deployed **v2** (Date/Message-ID + 76-col base64 — fixed Gmail quarantine). CLI profile `loomlance` (⚠️ currently root — user to replace).
- **Servers:** `npm run dev` → :5173; `npm run preview` → :4173 (use preview to verify the **invoice PDF** — react-pdf only renders in a prod build).
- **Tests/build:** `npx vitest run` (**81 tests**, green), `npm run lint` (clean), `npm run build` (OK). Run all three before every commit.
- **Git:** on `main`, HEAD `4c13ffe`, **everything pushed to `origin/main`**. We commit per task; **user says when to push** (they did, repeatedly).

---

## 1. Project overview

**LoomLance Dashboard** — a SaaS web app for tech freelancers: clients, projects (kanban), contracts, invoicing (PDF + email + online pay), time tracking, expenses, recurring invoices, reports. It's the **post-login** product. Signup, pricing, and Stripe subscription Checkout live in a **separate sibling repo, "Loomlance Splash."** Both point at the **same Supabase project** so auth + subscription state are shared. This repo owns **login only**.

- **Stack:** React + Vite, React Router, TanStack Query, react-hook-form (incl. `useFieldArray`), Sonner toasts, Tailwind design-system components in `src/components/ui/*`, Supabase JS (`src/lib/supabase`), Vitest + Playwright, Recharts (lazy), pg_cron.
- **Tiers:** Free / Tier 1 / Tier 2. Gating in `src/lib/tier.js` (`FEATURES`, `hasFeature`, `TIER_LIMITS`, `UPGRADE_COPY`). Tier from `profiles.subscription_tier`. branding/recurring/time = tier_1+; expenses/reports = tier_2.
- **Projects-first** data model. RLS on every table, scoped by `auth.uid()`.

### Supabase (hosted — NO local Docker)
- **Dev project id:** `zbipqfsqxnvrzhpdjvvy`. Apply migrations via Supabase MCP `apply_migration` (ToolSearch `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql`) AND write the file to `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`. Latest migrations: `20260621041345_time_v2.sql`, `20260621044846_timer_pause.sql`, `20260621051311_expenses_v2_find_or_append.sql`, `20260621064612_phase5a_payment_prefs.sql`, `20260621071103_phase5a_can_pay_toggle.sql`.
- **Test user is `tier_2`** (uid `cb6e852e-0709-4627-8601-4a6641b3fa4d`; default currency USD; client "Mahmoud Sabbagh" `3881306f-4cec-4a0c-93f3-20fbaf0a4c17`; project `6779ac12-d1b2-4708-a3c0-bf48d47614b5`). Re-query if unsure.
- **MCP `execute_sql` returns only the LAST statement's rows.** One read per call, or join.
- To call an `auth.uid()` SECURITY DEFINER RPC via MCP: prefix `select set_config('request.jwt.claims','{"sub":"<uid>","role":"authenticated"}', true);`. MCP runs as service role (bypasses RLS) — seed rows with explicit `user_id`.

### Working agreements (IMPORTANT — user preferences)
- **User pushes manually** — never `git push` unless asked. Commit freely.
- **Work on `main`** — confirmed workflow; commit per task.
- **User uses the app LIVE.** For live DB verification, create **isolated `ZZ-`-marked** clients/projects/etc., verify, then **FK-ordered cleanup**. NEVER bulk-delete or bill against the user's real seeded data (per-project billing would stamp their entries — always isolate).
- **Design for onboarding simplicity** (memory `loomlance-onboarding-simplicity`): nail the user's mental model first, mechanics follow.

---

## 2. Project history (all shipped & pushed)

- **Phase 1** — core rebuild: login, clients, projects, kanban, contracts, invoices CRUD, profiles, tier gating, Slate Pro UI. ✅
- **Phase 2 "Polish & PDF"** — invoice PDF (react-pdf), dashboard insights (Recharts), Cmd+K search, branding, invoices board, pg_cron overdue/due-soon jobs, mobile nav. ✅
- **Phase 3 "Send & Pay"** — public invoice `/i/:token`, link controls, MOCK send/connect/pay, viewed/paid notifications. ⚠️ `mock_pay_invoice` is a dev-gated public write — disable `app_config.mock_payments_enabled` before prod. Real Resend+Stripe deferred (→ Phase 5). ✅
- **Phase 4 "Tier features"** — branding, time tracking, expenses, recurring invoices, reports. ✅
- **Live-QA pass (this session)** — F1–F17 captured in `docs/qa-findings.md`, triaged, and **all fixed**. Highlights:
  - **Quick fixes:** PDF title spacing (F1), chart `select-none` (F4a/F13), mobile drawer portal (F5), Clients row actions (F8), invoice line-item spinner removal + toggleable Tax/Discount columns (F14), expenses project/client column (F12a).
  - **Bug class — uncontrolled selects with async options:** edit modals opened blank / lost selection / login bounced. Fixed by making client/project selects **controlled** (`value={watch()}` + `setValue`) across InvoiceEditor, Contract/Project/Expense/Recurring form modals (F11, F15); seeded the `['session']` cache on login to stop the auth bounce (F16).
- **Phase 8 — Navigation & UX** ✅ — `Breadcrumbs` on detail pages (F6); dashboard revenue chart click → Reports drill via URL params (F4b); client **Activity timeline** aggregating invoices/contracts/expenses (F10).
- **Phase 9 — Time v2 + Expenses v2** ✅ — see §3/§ below. Billing is now **per project** with **find-or-append** (one draft per project), contract tagging + contract hourly-rate prefill (F2/F3/F12c), and a topbar timer with **pause/commit/discard** (F7).
- **Phase 10 — Client/contacts** ✅ — folded multi-contact management into a `PeopleCard` on the client Overview; removed the confusing "Contacts" tab; renamed Overview "Contact" → "Details" (F9). Clients row quick actions (F8).
- **F17** — project form color picker: 10 preset swatches + custom (`ColorPicker`, palette in `src/lib/colors.js`).

### Feature reference (where the new/changed stuff lives)
- **Billing model (per project, find-or-append):** internal RPC `_find_or_create_draft(user, client, project-or-null, currency)` returns the latest matching `draft` invoice or creates one. `generate_invoice_from_time_for_project(p_project_id)` and `generate_invoice_from_expenses_for_project(p_project_id, p_currency)` both **append** onto that one per-project draft (time lines grouped by contract→rate; expense lines one per expense). `generate_invoice_from_expenses_for_client(p_client_id, p_currency)` handles project-less expenses (per-client draft). **Dropped** the old per-client `generate_invoice_from_time` / `generate_invoice_from_expenses`.
- **Time:** `time_entries` (+ new `contract_id` FK→contracts ON DELETE SET NULL, `paused_at`, `paused_seconds`). `src/lib/time.js` (`activeSeconds`, `readyToBillByProject`, `groupTimeForInvoice`, `formatElapsed`). `src/api/time-entries.js` (`pauseTimer`/`resumeTimer`/`stopTimer`=commit; `generateInvoiceFromTimeForProject`). `/time` = `ReadyToBillPanel` + ledger (Client/Contract cols + filters). `TimerWidget` = pause/commit/discard + breathing dot. `TimeEntryFormModal` = contract picker + rate prefill.
- **Contracts:** new optional `contracts.hourly_rate` (prefills tagged time-entry rate). `listTaggableContracts({projectId, clientId})` (same client, project-or-null, active/draft). `ContractFormModal` has an Hourly-rate input.
- **Expenses:** `src/lib/expenses.js` `readyToBillExpenses` (project + client rows by currency). `ExpensesReadyToBillPanel` on `/expenses`. `generateInvoiceFromExpensesForProject/ForClient`.
- **Nav/UX:** `src/components/ui/Breadcrumbs.jsx` (parent-route based, on all detail pages). Dashboard `RevenueChart` bars clickable → `/reports?tab=revenue&from=&to=`; `ReportsPage` reads those via `useSearchParams`. `ActivityTab` = client timeline.
- **Clients:** `src/features/clients/PeopleCard.jsx` (multi-contact mgmt, in Overview). `ContactsTab.jsx` deleted.
- **UI:** `src/components/ui/ColorPicker.jsx` (+ `src/lib/colors.js` `PROJECT_COLORS`).
- **Money/totals:** `src/lib/money.js` `invoiceTotals(lines)` / `lineTotal(line)` — invoices have NO `total` column.

---

## 3. ⚠️ Carry-forward gotchas (DO NOT re-learn)

1. **Controlled selects for async options (F11/F15):** any `<Select>` whose `<option>`s come from an async query (clients/projects/contracts) MUST be controlled — `value={watch(field)}` + `onChange={(e)=>setValue(field, e.target.value, { shouldDirty: true })}` — NOT `{...register(field)}`. Uncontrolled selects render blank when options load after mount (lost selection / "blank edit modal"). All editor client/project selects are already converted.
2. **Per-project find-or-append billing:** generating an invoice for a project (time OR expenses) appends to the project's existing `draft` (matched on client+project+currency) via `_find_or_create_draft`. One draft per project per currency. Different currency → separate draft (no multi-currency mixing). Append positions continue from `max(position)+1`.
3. **Live DB verification:** always isolate with `ZZ-` rows; FK-ordered cleanup (line_items → invoices → time_entries/expenses → contracts → projects → clients). Per-project billing will bill ALL unbilled time/expenses on a project — never run it against the user's real project.
4. **Storage upload + RLS:** never `{ upsert: true }`. Plain `.upload(path,file,{contentType})` + unique timestamped path. Private buckets → `createSignedUrl`. Delete via Storage API `.remove()` (a `protect_delete` trigger blocks raw deletes).
5. **Errors:** all API calls → `mapPostgresError` (`src/lib/errors.js`); RPCs `raise exception 'CODE' using errcode='P0001'`; `detectCode` maps the keyword to `CODE_MESSAGES`. (New codes in use: `NO_UNBILLED_TIME`, `NO_BILLABLE_EXPENSES`, `UNAUTHORIZED`.)
6. **invoices has NO `total` column** — use `invoiceTotals(lines)`. Reuse `@/features/invoices/LineItemsTable` + `TotalsPanel` for any line-item editor. LineItemsTable has toggleable Tax/Discount columns + `.no-spinner` inputs.
7. **Recharts:** lazy-load, theme via CSS vars (`var(--color-…)` from `src/styles/tokens.css`). Wrap charts in `select-none`. Bars can be `onClick`-able.
8. **`Button`** has NO `asChild`/Slot — link-buttons use `navigate(...)`. Supports `size="sm"`. `Breadcrumbs` handles parent-route back nav.
9. **Determinism in helpers:** date-dependent helpers take an injected `today`/`now` (never `Date.now()` internally) so Vitest is deterministic — see `rangeForPreset`, `activeSeconds`, `readyToBill*`.
10. **Superpowers not installed here** — run brainstorm/plan manually; still write specs/plans to `docs/superpowers/`.

---

## 4. Where we are RIGHT NOW

- **QA COMPLETE** (F1–F17 ✅). **Phases 8, 9, 10 shipped.** **Phase 5a built (code), deploy pending** (see RESUME HERE up top + §5). All pushed to `origin/main` (HEAD `0aeb10c`). 81 tests green, lint clean, build OK.
- **Phase 5a recap (built this session):** `send-invoice` Edge Function now uses **AWS SES** (raw MIME + PDF, SigV4 via `aws4fetch`, from platform domain + reply-to freelancer); `src/lib/providers.js` accepts `EMAIL_PROVIDER=ses`; new `profiles` columns `online_payments_enabled` / `default_payment_instructions` / `paypal_link`; `PaymentsTab` has a master online-payments toggle + a default payment-instructions card; new invoices prefill `payment_instructions` from the profile; `get_public_invoice.can_pay` now also requires `online_payments_enabled`; cash is already a `MarkPaidModal` method. **Not yet live** — needs AWS deploy.
- **Phase 5 remaining:** 5b (Stripe — finish/verify/deploy the existing `stripe-*` Edge Functions), 5c (PayPal link MVP). Spec: `docs/superpowers/specs/2026-06-21-phase-5-real-integrations.md`.
- The hosted dev DB (`zbipqfsqxnvrzhpdjvvy`) still has the **seeded QA example data** (§6) on the tier-2 user.

---

## 5. Possible next directions (none chosen yet — all FUTURE, none from QA)

See `docs/phases.md` for the full roadmap. Remaining:
- **Phase 5 — Real integrations** 🔶 IN PROGRESS (see RESUME HERE + §4): **5a done** (SES email + per-user toggle + cash, code-complete, deploy pending). **Remaining: 5b Stripe, 5c PayPal.** Edge Functions already scaffolded under `supabase/functions/`. Spec: `docs/superpowers/specs/2026-06-21-phase-5-real-integrations.md`. Go-live needs AWS/Stripe/PayPal accounts + `supabase functions deploy` + secrets + flip `VITE_*_PROVIDER` flags + **disable `app_config.mock_payments_enabled`**.
- **Phase 6 — Hardening:** per-template `begin/exception` isolation across all 3 cron jobs; `check (due_days >= 0)` on `recurring_invoice_templates`; revisit `contract-pdfs` upload (never tested; may share the old upsert bug).
- **Phase 7 — Reports/export polish:** CSV/PDF export for invoices, report drill-downs, accrual-basis toggle, FX handling.
- **Phase 11 — Test coverage:** broaden Playwright E2E for the Tier-2 pages.
- **Smaller:** invoice list date filtering (the F4b drill could then target Invoices too); reuse `ColorPicker` for branding accent.

For substantive work, follow brainstorm → spec (`docs/superpowers/specs/`) → plan (`docs/superpowers/plans/`) → build task-by-task (commit + lint/test/build each) → live-verify via MCP with `ZZ-` markers → update docs. Get user approval before building.

---

## 6. Seeded QA data (hosted DB, tier-2 user `cb6e852e-…`)

Rich **organic** example data (no markers) for QA, present from any machine (shared hosted DB). The user's pre-existing 16 clients were left untouched; this added: 5 clients (Northwind, Globex, Stark, Initech, **Lumière Studio (EUR)**) + contacts; 5 projects (3 active/1 paused/1 archived) + kanban + 7 tasks; 4 contracts; **13 invoices covering every status** + 5 payments (Revenue ≈ **$15,588 + €2,880**, all Aging buckets populated); 10 time entries; 10 expenses (1 EUR); 4 recurring templates (next_run_at future); 3 notifications. **No one-shot teardown** (organic). To wipe just this set, delete FK-ordered keyed on the 5 client names. (Any `ZZ-` rows from live verification were already cleaned up.)
