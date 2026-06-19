# Continuation Context — LoomLance Dashboard

> **Purpose:** Hand off this work session to a fresh Claude Code session (possibly on another computer) so it can pick up with no re-explanation. Read top-to-bottom, then see **"Where we are right now."**
>
> **Last updated:** 2026-06-19, after **Phase 4 fully shipped** (all 5 sub-projects: branding, time tracking, expenses, recurring invoices, reports). No sub-project is currently in progress.

---

## 0. TL;DR

The LoomLance Dashboard's **Phase 4 "Tier features" is complete** — all five sub-projects built via the superpowers **brainstorming → writing-plans → (subagent-driven or inline) executing** flow. Everything is committed on **`main`** (we work directly on main; **the user pushes manually** — never push unless asked). As of this writing ~30 commits are unpushed. There is **no queued next task**; await direction. Tests: **68/68** unit (Vitest) green, lint clean, prod build OK.

---

## 1. Project overview

**LoomLance Dashboard** — a SaaS web app for tech freelancers: clients, projects (kanban), contracts, invoicing (PDF + email + online pay), time tracking, expenses, recurring invoices, reports. It's the **post-login** product. Signup, pricing, and Stripe subscription Checkout live in a **separate sibling repo, "Loomlance Splash."** Both point at the **same Supabase project** so auth + subscription state are shared. This repo owns **login only**.

- **Stack:** React + Vite, React Router, TanStack Query, react-hook-form (incl. `useFieldArray`), Sonner toasts, Tailwind design-system components in `src/components/ui/*`, Supabase JS (`src/lib/supabase`), Vitest + Playwright, Recharts (lazy), pg_cron.
- **Tiers:** Free / Tier 1 / Tier 2. Gating in `src/lib/tier.js` (`FEATURES`, `hasFeature(tier, feature)`, `TIER_LIMITS`, `UPGRADE_COPY`). Tier from `profiles.subscription_tier` (written by Splash's Stripe webhook). branding/recurring/time = tier_1+; expenses/reports = tier_2.
- **Projects-first** data model. RLS on every table, scoped by `auth.uid()`.

### Supabase (hosted — NO local Docker)
- **Dev project id:** `zbipqfsqxnvrzhpdjvvy`. Apply migrations via Supabase MCP `apply_migration` (ToolSearch `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql`) AND write the file to `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` (latest is `20260619030000_recurring_invoices.sql`).
- **Test user is `tier_2`** (uid `cb6e852e-0709-4627-8601-4a6641b3fa4d`; default currency USD; client "Mahmoud Sabbagh" `3881306f-4cec-4a0c-93f3-20fbaf0a4c17`; a project `6779ac12-d1b2-4708-a3c0-bf48d47614b5`). Re-query if unsure.
- **MCP `execute_sql` returns only the LAST statement's rows.** One read per call, or join.
- To call an `auth.uid()` SECURITY DEFINER RPC via MCP: same call, prefix `select set_config('request.jwt.claims','{"sub":"<uid>","role":"authenticated"}', true);`. MCP runs as service role (bypasses RLS) — seed rows with explicit `user_id`.

### Working agreements (IMPORTANT — user preferences)
- **User pushes manually** — never `git push` unless asked. Commit freely.
- **Work on `main`** — all of Phase 1–4 went straight to main; user confirms per sub-project.
- **User uses the app LIVE during sessions.** Scope test cleanup to OWN `ZZ-` markers; never bulk-delete.
- react-pdf only works in a prod build — verify PDF via `npm run preview`, NOT dev.
- Toasts: `<Toaster richColors position="top-right" offset="76px" closeButton />` in `src/app/providers.jsx`.

---

## 2. Project history (all shipped)

- **Phase 1** — core rebuild: login, clients, projects, kanban, contracts, invoices CRUD, profiles, tier gating, Slate Pro UI. ✅
- **Phase 2 "Polish & PDF"** — invoice PDF (react-pdf), dashboard insights (Recharts), Cmd+K search, branding, invoices board, pg_cron overdue/due-soon jobs, mobile nav. ✅
- **Phase 3 "Send & Pay"** — public invoice page `/i/:token`, link controls, MOCK send/connect/pay, viewed/paid notifications. ⚠️ `mock_pay_invoice` is a dev-gated public write — disable `app_config.mock_payments_enabled` before prod. Real Resend+Stripe deferred. ✅
- **Phase 4 "Tier features"** — 5 sub-projects, each own spec→plan→build (specs/plans under `docs/superpowers/`):
  1. Invoice branding (Tier 1) ✅ `707d344`
  2. Time tracking (Tier 1) ✅ `c07a232`
  3. Expenses (Tier 2) ✅ `0bb6ce8`→`3df03df`
  4. Recurring invoices (Tier 1) ✅ `471c786`→`6eedac4`
  5. Reports (Tier 2) ✅ `1f0396e`→`1d2c14d`

Pushed through `c07a232`; everything after (Expenses, Recurring, Reports, specs/plans, this file) is **local-only / unpushed**.

### Feature reference (where each lives)
- **Time:** `time_entries` table; `src/lib/time.js`; `src/api/time-entries.js`; `/time` + topbar timer; `generate_invoice_from_time` RPC.
- **Expenses:** `expenses` table (private `receipts` bucket); `src/lib/expenses.js`; `/expenses`; `generate_invoice_from_expenses` RPC.
- **Recurring:** `recurring_invoice_templates` table; `src/lib/recurring.js`; `/invoices/recurring`; `run_recurring_template`/`generate_due_recurring_invoices`(daily cron 06:30 UTC)/`generate_recurring_invoice_now` RPCs.
- **Reports:** NO new DB; `src/lib/reports.js` (pure aggregators) + `src/lib/download.js`; `src/api/reports.js`; `src/hooks/useReports.js`; `src/features/reports/*`; `/reports` (Revenue/P&L/Aging/Time tabs, CSV, per-currency, date presets).
- **Money/totals:** `src/lib/money.js` `invoiceTotals(lines)` / `lineTotal(line)` — the canonical invoice math (invoices have NO `total` column).

---

## 3. ⚠️ Carry-forward gotchas (DO NOT re-learn)

1. **Storage upload + RLS:** never `{ upsert: true }` (RLS-denied existence-check SELECT → 400). Plain `.upload(path,file,{contentType})` + unique timestamped path.
2. **Storage RLS:** `for insert to authenticated with check ((storage.foldername(name))[1] = (select auth.uid()::text))`. Private buckets → `createSignedUrl`, not `getPublicUrl`. Delete via Storage API `.remove()` (a `protect_delete` trigger blocks raw deletes).
3. **Errors:** all API calls → `mapPostgresError` (`src/lib/errors.js`); RPCs `raise exception 'CODE' using errcode='P0001'`; `detectCode` maps the bare keyword to a friendly `CODE_MESSAGES` entry.
4. **invoices has NO `total` column** — use `invoiceTotals(lines)` from `src/lib/money.js`. Reuse `@/features/invoices/LineItemsTable` + `TotalsPanel` for any line-item editor.
5. **`Button` (`src/components/ui/Button.jsx`) has NO `asChild`/Slot** — link-buttons use `<Button onClick={() => navigate(...)}>`. It DOES support `size="sm"`.
6. **Recharts:** lazy-load and theme via CSS vars (`var(--color-primary|danger|success|fg-subtle|fg-muted|border|bg-elevated|bg-muted)`, all defined in `src/styles/tokens.css`). Pattern: `src/features/dashboard/RevenueChart.jsx`, `src/features/reports/ReportChart.jsx`.
7. **Date helpers:** `formatDate` (`src/lib/date.js`), `formatCurrency`/`SUPPORTED_CURRENCIES` (`src/lib/currency.js`). For report date filtering, timestamptz columns use half-open `[from, (to+1day))`; date columns inclusive.
8. **Determinism in helpers:** anything date-dependent takes an injected `today: Date` (never `Date.now()` internally) so Vitest is deterministic — see `rangeForPreset`/`agingReport`.
9. **Cron robustness (known, deferred):** `generate_due_recurring_invoices` loops in one transaction — a poison template aborts the run; same shape in the other cron jobs. Hardening = per-template `begin/exception` across all 3 jobs.

---

## 4. Where we are RIGHT NOW

- **Phase 4 COMPLETE.** No sub-project in progress; nothing queued. Await user direction.
- **Git HEAD ≈ `1d2c14d`** on `main`, working tree clean. **68/68** unit tests, lint clean, build OK.
- **~30 commits unpushed** (Expenses → Reports + specs/plans + this file). User pushes manually.
- **Deferred minor hardening** (non-blocking, from the Recurring review): cron-loop per-template exception isolation (apply across all 3 cron jobs together); a `check (due_days >= 0)` constraint on `recurring_invoice_templates`.

### Local-only state that will NOT transfer to another machine
- `.git/sdd/` ledgers + task briefs/reports (not pushed) — fine; committed specs/plans + this file are the source of truth; completed work is in `git log`.
- `~/.claude/.../memory/` project memories (incl. `loomlance_phase4_progress.md`) — essentials reproduced here.

---

## 5. Possible next directions (none chosen yet)

If the user wants more work, likely candidates (each would need its own brainstorm → spec → plan → build):
- **Wire real integrations** (the big deferred item): replace the Phase 3 MOCK email/payments with real **Resend** + **Stripe Connect** via Supabase **Edge Functions** (none exist yet) — and gate/disable `app_config.mock_payments_enabled` for prod.
- **Hardening pass:** the deferred cron exception isolation + `due_days` check (§4); revisit the contract-pdfs upload (never tested, may share the old upsert bug per earlier notes).
- **Polish:** CSV/PDF export for invoices, report drill-downs, accrual-basis revenue toggle, FX handling — all explicitly deferred during Phase 4 brainstorming.
- **Tests:** broaden Playwright E2E coverage for the new Tier-2 pages.

Do NOT start any of these without brainstorming + user approval (superpowers HARD GATE).

### How to resume building (when a task is chosen)
1. Confirm state: `git log --oneline -5`, `npx vitest run` (68/68). 2. `superpowers:brainstorming` → spec in `docs/superpowers/specs/`. 3. `superpowers:writing-plans` → `docs/superpowers/plans/`. 4. Execute via `superpowers:subagent-driven-development` (fresh subagent/task, task-review each, final whole-branch review on the most capable model) or `superpowers:executing-plans` (inline). 5. Live-verify via MCP as the tier-2 user with `ZZ-` markers, then clean up. 6. Update `~/.claude/.../memory/loomlance_phase4_progress.md` + this file; remind user to push.

---

## 6. Quick command reference

- Tests: `npm run test` / `npx vitest run` (68 tests, 12 files). Lint: `npm run lint`. Build: `npm run build`. PDF preview: `npm run preview`. Dev: `npm run dev`.
- Git via Git Bash; Windows machine (PowerShell also available).
- Superpowers scripts: `C:/Users/mahmo/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.2/skills/subagent-driven-development/scripts/` (`task-brief`, `review-package`).
