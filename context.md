# Continuation Context — LoomLance Dashboard

> **Purpose:** Hand off an in-progress work session to a fresh Claude Code session (possibly on another computer) so it can pick up EXACTLY where we left off, with no re-explanation. Read this top-to-bottom first, then jump to **"Where we are right now"** and **"How to resume."**
>
> **Last updated:** 2026-06-18, mid-build of the Expenses sub-project (Task 1 of 9 complete).

---

## 0. TL;DR — resume in one paragraph

We're building the **Expenses** feature (Phase 4 sub-project 3 of 5) for the LoomLance Dashboard, using the **subagent-driven-development** workflow: dispatch one fresh implementer subagent per task from the plan, run a task-review subagent after each, fix Critical/Important findings, then move on. Working **directly on `main`** (user's established pattern; user pushes manually). The spec and a detailed 9-task plan are written and committed. **Task 1 (DB migration) is done, applied to the hosted Supabase DB, and reviewed clean.** Next up is **Task 2** (pure helpers in `src/lib/expenses.js` + unit tests). Just continue dispatching tasks 2→9 from the plan.

---

## 1. Project overview

**LoomLance Dashboard** is a SaaS web app for tech freelancers — clients, projects (with kanban), contracts, invoicing (PDF + email + online pay), time tracking, expenses, reports. It's the **post-login** product. Signup, pricing, and Stripe subscription Checkout live in a **separate sibling repo, "Loomlance Splash."** Both point at the **same Supabase project** so auth + subscription state are shared. This repo owns **login only**, not signup.

- **Stack:** React + Vite, React Router, TanStack Query, react-hook-form, Sonner (toasts), Tailwind design-system components in `src/components/ui/*`, Supabase JS client (`src/lib/supabase`), Vitest for unit tests, Playwright for E2E.
- **Tiers:** Free / Tier 1 / Tier 2. Feature gating in `src/lib/tier.js` (`FEATURES`, `hasFeature(tier, feature)`, `TIER_LIMITS`, `UPGRADE_COPY`). Subscription tier comes from `profiles.subscription_tier` (written by Splash's Stripe webhook).
- **Data model is Projects-first.** RLS on every table, scoped by `auth.uid()`.

### Supabase (hosted — NO local Docker)
- **Dev project id:** `zbipqfsqxnvrzhpdjvvy` — develop directly against this hosted project.
- Apply migrations via the **Supabase MCP** tool `mcp__supabase__apply_migration` (load via ToolSearch: `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql`). Always ALSO write the migration file to `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`.
- There's a separate hosted project for tests. pgTAP is skipped (no infra).
- **Test user is `tier_2`** (so all features unlock). When live-testing, sign in as this user.
- To call a `SECURITY DEFINER` `auth.uid()` RPC via MCP `execute_sql`, prefix in the same call:
  `select set_config('request.jwt.claims','{"sub":"<uid>","role":"authenticated"}', true);`

### Working agreements (IMPORTANT — these are user preferences)
- **User pushes manually** — do NOT `git push` unless asked. Commit freely.
- **Work on `main`** — the whole of Phase 4 (branding, time tracking) was committed straight to main. User confirmed this for Expenses too.
- **User uses the app LIVE during sessions.** Scope any test-data cleanup to your OWN markers (prefix seeded rows with `ZZ-`); never do bulk deletes.
- react-pdf only works in a prod build — verify PDF via `npm run preview`, NOT the dev server.
- Toasts: `<Toaster richColors position="top-right" offset="76px" closeButton />` in `src/app/providers.jsx` (offset keeps them clear of the topbar bell).

---

## 2. Project history (what's already built & shipped)

- **Phase 1** — core rebuild: auth (login), clients, projects, kanban, contracts, invoices CRUD, profiles, tier gating. Slate Pro UI redesign. ✅
- **Phase 2 "Polish & PDF"** — invoice PDF (react-pdf), dashboard insights (Recharts), Cmd+K search, logo/branding, invoices board view, pg_cron overdue/due-soon jobs, mobile nav. ✅
- **Phase 3 "Send & Pay"** — hosted public invoice page `/i/:token`, link controls (regenerate/expiry), MOCK send/connect/pay, viewed/paid notifications. ⚠️ `mock_pay_invoice` is a dev-gated public write — disable `app_config.mock_payments_enabled` before prod. Real Resend+Stripe wiring deferred. ✅
- **Phase 4 "Tier features"** — decomposed into 5 sub-projects, each its own spec→plan→build:
  1. **Invoice branding (Tier 1)** ✅ done (commit `707d344`)
  2. **Time tracking (Tier 1)** ✅ done (commit `c07a232`)
  3. **Expenses (Tier 2)** ⬅️ **IN PROGRESS — this is what we're doing now**
  4. Recurring invoices (Tier 1) — not started
  5. Reports (Tier 2, last; aggregates the others) — not started

All commits through `c07a232` are pushed to `origin/main`. The Expenses spec, plan, and Task 1 commits are committed locally (push is the user's call).

---

## 3. ⚠️ Carry-forward gotchas (learned the hard way — DO NOT re-learn)

1. **Storage upload + RLS:** `supabase.storage.from(bucket).upload(path, file, { upsert: true })` on a bucket with no SELECT policy → 400 "new row violates row-level security policy" (upsert runs an existence-check SELECT that RLS denies). **FIX: plain `.upload(path, file, { contentType })` with a UNIQUE timestamped path, NO upsert.**
2. **Storage RLS form:** use canonical `for insert to authenticated with check ((storage.foldername(name))[1] = (select auth.uid()::text))` — NOT `to public` + bare `auth.uid()`.
3. **Deleting storage objects:** direct `delete from storage.objects` is blocked by a `protect_delete` trigger → delete via the Storage API `.remove([paths])`.
4. **Deleting an expense does NOT delete its receipt object** — remove the storage object explicitly during cleanup.
5. **Errors:** all API calls go through `mapPostgresError` (`src/lib/errors.js`); RPCs `raise exception 'CODE' using errcode = 'P0001'` and `detectCode` maps the bare keyword to a friendly message. Add new codes to `CODE_MESSAGES`.

---

## 4. Expenses sub-project — design summary

**Spec:** `docs/superpowers/specs/2026-06-18-loomlance-phase-4-expenses-design.md`
**Plan:** `docs/superpowers/plans/2026-06-18-loomlance-phase-4-expenses.md`

**Goal:** Tier 2 freelancers record categorized business expenses (optional receipt) and push **billable** expenses onto a client's draft invoice — mirroring the time-tracking flow.

**Decisions made during brainstorming (all locked in):**
- **Billable + invoiceable** (full scope): `billable` flag + `invoiced_on_invoice_id`, atomic per-client RPC.
- **Categories:** preset list + free-text custom (a `<datalist>` combobox). Presets: Software, Hardware, Travel, Meals, Subscriptions, Office, Contractors, Fees, Other.
- **Invoice lines:** ONE line per expense, NO markup (transparent pass-through; qty 1, unit_price = amount).
- **Per-expense `currency` stored**; the generate-invoice RPC bills ONLY expenses whose `currency == profiles.default_currency` (no FX conversion).
- **Receipts** in a PRIVATE bucket `receipts`, surfaced via on-demand signed URLs; upload optional.
- **FK on-delete:** `expenses.project_id` and `client_id` are `ON DELETE SET NULL` (preserve the ledger — intentionally UNLIKE time_entries' cascade). `invoiced_on_invoice_id` is `ON DELETE SET NULL`.
- **Tier gate:** `FEATURES.EXPENSES` (tier_2) — flag, upgrade copy, AND the sidebar `/expenses` nav item ALREADY EXIST. Do not re-add.

**The 9 tasks (see plan for full code of each):**
1. DB migration — `expenses` table, RLS, trigger, private `receipts` bucket + storage RLS, `generate_invoice_from_expenses(p_client_id)` RPC. ✅ DONE
2. `src/lib/expenses.js` pure helpers (`EXPENSE_CATEGORIES`, `RECEIPT_TYPES`, `RECEIPT_MAX_BYTES`, `validateReceiptFile`, `buildExpenseInvoiceLines`, `expenseTotals`) + Vitest tests (TDD).
3. `src/api/expenses.js` (list/create/update/delete, uploadReceipt/removeReceipt/getReceiptUrl, generateInvoiceFromExpenses) + `NO_BILLABLE_EXPENSES` in `src/lib/errors.js`.
4. `src/hooks/useExpenses.js` (query + mutation hooks).
5. `src/features/expenses/ExpensesTable.jsx`.
6. `src/features/expenses/ExpenseFormModal.jsx` (incl. receipt upload).
7. `src/features/expenses/GenerateExpenseInvoiceModal.jsx`.
8. `src/pages/ExpensesPage.jsx` + register `/expenses` route in `src/app/routes.jsx`.
9. Live verification as tier-2 user + cleanup (incl. foreign-currency exclusion check + explicit receipt-object deletion) + final `npm run test`.

Patterns to mirror are the just-shipped time-tracking files: `src/api/time-entries.js`, `src/hooks/useTimeEntries.js`, `src/lib/time.js`, `src/features/time/*`, `src/pages/TimePage.jsx`, migration `supabase/migrations/20260619014123_time_tracking.sql`.

---

## 5. Where we are RIGHT NOW

- **Workflow:** subagent-driven-development (skill `superpowers:subagent-driven-development`), executing the Expenses plan on `main`.
- **Task 1 (DB migration): ✅ COMPLETE & REVIEWED CLEAN.**
  - Commit `0bb6ce8 feat(expenses): expenses table, receipts bucket, generate-invoice-from-expenses RPC`.
  - Migration file: `supabase/migrations/20260619020000_expenses.sql`. Applied to hosted project `zbipqfsqxnvrzhpdjvvy`. Verified: table exists, 4 RLS policies, `receipts` bucket exists, RPC exists.
  - Review verdict: Approved, no Critical/Important; only Minor style notes (an optional comment noting the RPC's 3-pass WHERE design). Nothing to fix.
- **Tasks 2–9: NOT STARTED.**
- Git HEAD is `0bb6ce8` on `main`. Nothing pushed yet for Expenses (and the prior 22 Phase-4 commits up to `c07a232` ARE on origin; the Expenses spec/plan/Task-1 commits are local only).
- **Commits made this session (local, on main):**
  - `17e3b58 docs: Phase 4 expenses design spec`
  - `a2543dc docs: Phase 4 expenses implementation plan`
  - `0bb6ce8 feat(expenses): expenses table, receipts bucket, generate-invoice-from-expenses RPC`

### Local-only state that will NOT transfer to another computer
- The subagent-driven ledger + task briefs/reports live under `.git/sdd/` (NOT pushed — `.git` is local). On a fresh machine they won't exist; that's fine — this `context.md` + the committed plan are the source of truth. Re-create the ledger if you want (`<git-dir>/sdd/progress.md`), or just track progress via the plan's checkboxes / the task list.
- The `~/.claude/.../memory/` files (project memories) are on the original machine only. The essentials are reproduced in this doc.

---

## 6. How to RESUME (do this next)

1. Confirm git state: `git log --oneline -5` should show `0bb6ce8` at HEAD on `main`. Confirm `supabase/migrations/20260619020000_expenses.sql` exists.
2. If Supabase MCP is connected, optionally re-verify Task 1 objects exist (table `expenses`, 4 policies, `receipts` bucket, fn `generate_invoice_from_expenses`). If MCP points at a fresh DB, re-apply the migration file.
3. Continue subagent-driven-development from **Task 2**:
   - Extract the task brief (the skill's `scripts/task-brief <plan-file> 2`) OR just read Task 2's section of the plan directly.
   - Dispatch a fresh implementer subagent (model: a cheap/fast tier is fine — Task 2's code is fully written in the plan; it's transcription + TDD). Give it: where the task fits, the brief/plan-section, the global constraints, and a report-file path.
   - After it reports DONE, generate a review diff (`scripts/review-package <BASE> <HEAD>`, BASE = `0bb6ce8`) and dispatch a task-reviewer subagent.
   - Fix any Critical/Important findings via a fix subagent; re-review; then mark complete and move to Task 3.
   - Repeat through Task 9.
4. Task 9 is manual live verification — do it as the tier-2 test user, with `ZZ-` markers, then clean up ALL seeded data (expenses, the generated draft invoice, and the uploaded receipt objects via the Storage API).
5. After all tasks: dispatch a final whole-branch code review, then use `superpowers:finishing-a-development-branch`. Update the project memory (`loomlance_phase4_progress.md`) to mark Expenses ✅ and set next = recurring invoices. Do NOT push — that's the user's call.

### Per-task dispatch reminders (subagent-driven-development)
- Fresh subagent per task; never paste accumulated history into dispatches — give each only its task brief + interfaces + global constraints.
- Always specify the subagent `model` explicitly. Implementers from fully-written plan code → cheap tier; reviewers → mid-tier (scale to risk).
- Two verdicts required per task review: spec compliance AND code quality.
- Don't push; commit per task; work on `main`.

---

## 7. Quick command reference

- Run unit tests: `npm run test` (Vitest). Suite was at 42 tests before Expenses; Task 2 adds ~4+.
- Lint: `npm run lint`
- Build: `npm run build` ; preview prod build (needed for PDF): `npm run preview`
- Dev server: `npm run dev`
- Git is via Git Bash; this is a Windows machine (PowerShell also available).
