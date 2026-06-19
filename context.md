# Continuation Context — LoomLance Dashboard

> **Purpose:** Hand off this work session to a fresh Claude Code session (possibly on another computer) so it can pick up EXACTLY where we left off, with no re-explanation. Read top-to-bottom, then jump to **"Where we are right now"** and **"How to resume."**
>
> **Last updated:** 2026-06-19, after **Phase 4 sub-project 4 (Recurring Invoices) shipped**. Next up: the final sub-project, **Reports**.

---

## 0. TL;DR — resume in one paragraph

We're building **Phase 4 "Tier features"** of the LoomLance Dashboard, decomposed into 5 sub-projects, each via its own **spec → plan → build** cycle using the **superpowers brainstorming → writing-plans → subagent-driven-development** skills. Sub-projects 1–4 are DONE (branding, time tracking, expenses, recurring invoices). **Only sub-project 5, Reports, remains** — it has NO spec/plan yet; start it with brainstorming. We work **directly on `main`** (user's established pattern) and the **user pushes manually** (never push unless asked). Everything since the last push is committed locally.

---

## 1. Project overview

**LoomLance Dashboard** is a SaaS web app for tech freelancers — clients, projects (kanban), contracts, invoicing (PDF + email + online pay), time tracking, expenses, recurring invoices, reports. It's the **post-login** product. Signup, pricing, and Stripe subscription Checkout live in a **separate sibling repo, "Loomlance Splash."** Both point at the **same Supabase project** so auth + subscription state are shared. This repo owns **login only**, not signup.

- **Stack:** React + Vite, React Router, TanStack Query, react-hook-form (incl. `useFieldArray`), Sonner (toasts), Tailwind design-system components in `src/components/ui/*`, Supabase JS client (`src/lib/supabase`), Vitest unit tests, Playwright E2E. pg_cron for scheduled DB jobs.
- **Tiers:** Free / Tier 1 / Tier 2. Feature gating in `src/lib/tier.js` (`FEATURES`, `hasFeature(tier, feature)`, `TIER_LIMITS`, `UPGRADE_COPY`). Tier comes from `profiles.subscription_tier` (written by Splash's Stripe webhook). Feature→tier: branding/recurring/time = tier_1+; expenses/reports = tier_2.
- **Data model is Projects-first.** RLS on every table, scoped by `auth.uid()`.

### Supabase (hosted — NO local Docker)
- **Dev project id:** `zbipqfsqxnvrzhpdjvvy` — develop directly against this hosted project.
- Apply migrations via the **Supabase MCP** tool `mcp__supabase__apply_migration` (load via ToolSearch: `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql`). Always ALSO write the migration file to `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` (timestamp must sort after the latest existing one; latest is `20260619030000_recurring_invoices.sql`).
- Separate hosted project for tests. pgTAP skipped (no infra).
- **Test user is `tier_2`** (uid `cb6e852e-0709-4627-8601-4a6641b3fa4d`; default currency USD; a client "Mahmoud Sabbagh" `3881306f-4cec-4a0c-93f3-20fbaf0a4c17`). Re-query if unsure: `select id, default_currency from profiles where subscription_tier='tier_2'`.
- **MCP `execute_sql` returns only the LAST statement's rows.** Run one read per call, or join into one query.
- To call a `SECURITY DEFINER` `auth.uid()` RPC via MCP, prefix in the SAME call: `select set_config('request.jwt.claims','{"sub":"<uid>","role":"authenticated"}', true);` then the RPC. MCP runs as service role (bypasses RLS), so seed rows with explicit `user_id`; only the `auth.uid()`-dependent RPCs need the jwt prefix.

### Working agreements (IMPORTANT — user preferences)
- **User pushes manually** — do NOT `git push` unless asked. Commit freely.
- **Work on `main`** — all of Phase 4 was committed straight to main; user confirmed this explicitly for each sub-project.
- **User uses the app LIVE during sessions.** Scope test-data cleanup to your OWN markers (prefix seeded rows with `ZZ-`); never bulk-delete.
- react-pdf only works in a prod build — verify PDF via `npm run preview`, NOT the dev server.
- Toasts: `<Toaster richColors position="top-right" offset="76px" closeButton />` in `src/app/providers.jsx`.

---

## 2. Project history (what's already built & shipped)

- **Phase 1** — core rebuild: login auth, clients, projects, kanban, contracts, invoices CRUD, profiles, tier gating. Slate Pro UI. ✅
- **Phase 2 "Polish & PDF"** — invoice PDF (react-pdf), dashboard insights (Recharts), Cmd+K search, logo/branding, invoices board view, pg_cron overdue/due-soon jobs, mobile nav. ✅
- **Phase 3 "Send & Pay"** — hosted public invoice page `/i/:token`, link controls, MOCK send/connect/pay, viewed/paid notifications. ⚠️ `mock_pay_invoice` is a dev-gated public write — disable `app_config.mock_payments_enabled` before prod. Real Resend+Stripe deferred. ✅
- **Phase 4 "Tier features"** — 5 sub-projects, each own spec→plan→build:
  1. **Invoice branding (Tier 1)** ✅ (commit `707d344`)
  2. **Time tracking (Tier 1)** ✅ (commit `c07a232`)
  3. **Expenses (Tier 2)** ✅ (commits `0bb6ce8`→`3df03df`)
  4. **Recurring invoices (Tier 1)** ✅ (commits `471c786`→`6eedac4`)
  5. **Reports (Tier 2)** ⬅️ **NOT STARTED — the only remaining work. No spec/plan yet.**

Commits through `c07a232` are pushed to `origin/main`. **Everything after that (Expenses + Recurring + this context.md + specs/plans) is committed locally but NOT pushed** (user pushes manually).

---

## 3. ⚠️ Carry-forward gotchas (learned the hard way — DO NOT re-learn)

1. **Storage upload + RLS:** never use `{ upsert: true }` on `.upload()` (it runs an existence-check SELECT that RLS denies → 400). Use plain `.upload(path, file, { contentType })` with a UNIQUE timestamped path.
2. **Storage RLS form:** `for insert to authenticated with check ((storage.foldername(name))[1] = (select auth.uid()::text))`.
3. **Deleting storage objects:** via the Storage API `.remove([paths])`, never `delete from storage.objects` (blocked by a `protect_delete` trigger). Private buckets → use `createSignedUrl`, not `getPublicUrl`.
4. **Errors:** all API calls go through `mapPostgresError` (`src/lib/errors.js`); RPCs `raise exception 'CODE' using errcode = 'P0001'` and `detectCode` maps the bare keyword to a friendly message in `CODE_MESSAGES`. Add new codes there. `UNAUTHORIZED`/`NO_BILLABLE_EXPENSES`/`NO_UNBILLED_TIME` already exist.
5. **`invoices` has NO `total` column** — totals are derived from line items via `invoiceTotals(lines)` in `src/lib/money.js`. Reuse it; don't recompute. Reuse `@/features/invoices/LineItemsTable` (field-array `line_items`, props `{control, register}`) and `@/features/invoices/TotalsPanel` (prop `{control}`) for any line-item editor.
6. **This codebase's `Button` (`src/components/ui/Button.jsx`) has NO `asChild`/Slot support** — for link-buttons use `<Button onClick={() => navigate(...)}>`, not `<Button asChild><Link/>`.
7. **SECURITY DEFINER + pg_cron pattern:** see `mark_overdue_invoices`, `generate_invoice_from_time`, `run_recurring_template`. `next_invoice_number(user_id)` generates gap-free per-user `INV-XXXX` numbers. Global cron fns are revoked from public/anon/authenticated; user RPCs check `auth.uid()` ownership and are granted to authenticated.
8. **Cron robustness gap (known, deferred):** `generate_due_recurring_invoices` loops templates in one transaction — a poison template aborts the whole run. Same shape in the other cron jobs. Hardening (per-template `begin/exception`) is a future pass across all 3 jobs.

---

## 4. Reuse map for the Reports sub-project (sources to aggregate)

Reports (Tier 2, `FEATURES.REPORTS`, already in `tier.js`) will READ existing data — likely no new tables. Original rebuild spec (`docs/superpowers/specs/2026-06-04-loomlance-rebuild-design.md` §4.x) describes: tabs **Revenue** (by month/client/project), **P&L** (revenue − expenses), **Aging** (invoices by days outstanding), **Time** (billable vs non-billable by project); all date-filterable; CSV export. Data sources already in place:
- **Invoices/payments:** `invoices` (status enum draft/sent/viewed/paid/overdue/void; issue_date, due_date), `invoice_payments` (amount, paid_at, method), `invoice_line_items`. Totals via `invoiceTotals` (`src/lib/money.js`).
- **Time:** `time_entries` (duration_minutes, billable, hourly_rate, project_id, invoiced_on_invoice_id). Helpers in `src/lib/time.js`.
- **Expenses:** `expenses` (amount, currency, category, spent_on, billable). Helpers in `src/lib/expenses.js`.
- **Recurring:** `recurring_invoice_templates`.
- **Dashboard insights** already exist (`src/features/dashboard/*`, Recharts, `dashboardStats.js`) — a strong pattern to mirror for charts.
- Sidebar already has a **Reports** nav item (`/reports`, tier-2-locked) in `src/components/layout/SidebarNav.jsx` — just add the route + page.
- Tier-gate pattern: `UpgradeCard feature={FEATURES.REPORTS} target="tier_2"` (see `ExpensesPage.jsx`).

Open design questions to resolve in brainstorming: which tabs to build (all 4 vs subset), DB aggregation RPCs vs client-side rollups from existing queries, CSV export approach, date-range UX, multi-currency handling in aggregates.

---

## 5. Where we are RIGHT NOW

- **Workflow:** subagent-driven-development on `main`. Sub-projects 1–4 of Phase 4 COMPLETE.
- **Git HEAD = `6eedac4`** on `main` (Recurring Invoices, page+route+button). Working tree clean.
- **Unit suite: 55/55 passing.** Lint clean, prod build succeeds.
- **Recurring Invoices (sub-project 4) just finished & shipped** — final whole-branch review = ready-to-ship, no Critical/Important. Live-verified via MCP (cron generation, manual RPC, ownership guard, end_date flip). Two deferred minor hardening items (cron exception isolation; `check (due_days >= 0)`).
- **Reports (sub-project 5): NOT STARTED.** No spec, no plan.
- **Unpushed:** all commits after `c07a232` (Expenses, Recurring, specs/plans, this file). User pushes manually.

### Local-only state that will NOT transfer to another computer
- The subagent-driven ledger + task briefs/reports live under `.git/sdd/` (NOT pushed). On a fresh machine they won't exist — fine; this `context.md` + the committed specs/plans are the source of truth. The completed work is in `git log`.
- The `~/.claude/.../memory/` files (project memories incl. `loomlance_phase4_progress.md`) are on the original machine only. Essentials are reproduced here.

---

## 6. How to RESUME (do this next)

1. Confirm git state: `git log --oneline -5` → HEAD `6eedac4` on `main`. `npx vitest run` → 55/55. Migrations present through `20260619030000_recurring_invoices.sql`.
2. If continuing the build, the next step is **sub-project 5, Reports**:
   - Invoke `superpowers:brainstorming` first (it's new feature work — HARD GATE: design + user approval before any code). Use §4 above as the starting context; ask the open design questions (which tabs, aggregation approach, CSV, date-range, currency).
   - Then `superpowers:writing-plans` → save to `docs/superpowers/plans/YYYY-MM-DD-loomlance-phase-4-reports.md`.
   - Then `superpowers:subagent-driven-development` to execute: fresh implementer subagent per task (cheap model when the plan has full code; standard for integration; opus for the final whole-branch review), task-review after each (spec + quality), fix Critical/Important via a fix subagent + re-review, then a final whole-branch review.
3. Re-init the ledger for the new sub-project: write `<git-dir>/sdd/progress.md` (or just track via the plan's checkboxes / task list).
4. Live-verify against the hosted DB as the tier-2 user with `ZZ-` markers, then clean up. NO destructive bulk deletes (user runs the app live).
5. After Reports ships: update `~/.claude/.../memory/loomlance_phase4_progress.md` (mark Phase 4 fully complete), refresh THIS file, and remind the user to `git push` (their call).

### Per-task dispatch reminders (subagent-driven-development)
- Fresh subagent per task; hand it ONLY its task brief (`scripts/task-brief PLAN N`) + interfaces + global constraints — never paste session history.
- Always specify the subagent `model` explicitly. Plan-has-full-code → cheap (haiku); integration → standard (sonnet); final whole-branch review → opus.
- Two verdicts required per task review: spec compliance AND code quality. Generate the diff with `scripts/review-package BASE HEAD` (BASE = commit before the task) and pass the printed path to the reviewer.
- Don't pre-judge findings for reviewers. Don't push. Commit per task. Work on `main`.

---

## 7. Quick command reference

- Unit tests: `npm run test` (or `npx vitest run` for one-shot). Currently 55 tests, 11 files.
- Lint: `npm run lint` ; Build: `npm run build` ; PDF preview: `npm run preview` ; Dev: `npm run dev`
- Git via Git Bash; Windows machine (PowerShell also available).
- Superpowers skill scripts live under `C:/Users/mahmo/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.2/skills/subagent-driven-development/scripts/` (`task-brief`, `review-package`).
