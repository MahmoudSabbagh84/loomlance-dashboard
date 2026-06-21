# LoomLance Dashboard — Phases Roadmap

> Single source of truth for **what's been built** and **what's slated next**. Compiled from `docs/superpowers/plans/`, `docs/superpowers/specs/`, `context.md`, and the live QA log (`docs/qa-findings.md`).
>
> **Status legend:** ✅ Done & shipped · 🔜 Slated (planned, not started) · 🧪 Brainstorming (needs a `superpowers:brainstorming` design pass before build) · 🐞 QA fix (from the current QA session)
>
> **Last updated:** 2026-06-20.

---

## Snapshot

| Phase | Theme | Status |
|------|-------|--------|
| Phase 1 | Foundation & core rebuild | ✅ Done |
| Phase 2 | Polish & PDF | ✅ Done |
| Phase 3 | Send & Pay (mock) | ✅ Done (real integrations deferred → Phase 5) |
| Phase 4 | Tier features | ✅ Done |
| **— QA pass —** | Live QA findings (F1–F10) | 🐞 In progress (capturing) |
| Phase 5 | Real integrations (Resend + Stripe Connect) | 🔜 Slated |
| Phase 6 | Hardening & reliability | 🔜 Slated |
| Phase 7 | Reports & export polish | 🔜 Slated |
| Phase 8 | Navigation & UX (F6/F4b done; F10 open) | 🔶 In progress |
| Phase 9 | Time tracking v2 + Expenses v2 (F2/F3/F7/F12c done) | ✅ Done |
| Phase 10 | Client/contacts rework | 🧪 Brainstorming |
| Phase 11 | Test coverage (E2E) | 🔜 Slated |

---

## ✅ PAST — shipped

### Phase 1 — Foundation & core rebuild ✅
Core product rebuild from the ground up.
- Auth (login only — signup/pricing/Stripe live in the sibling *Loomlance Splash* repo, shared Supabase).
- Clients, Projects (kanban), Contracts, Invoices CRUD, Profiles.
- Tier gating (`src/lib/tier.js`): Free / Tier 1 / Tier 2.
- Projects-first data model, RLS on every table scoped by `auth.uid()`.
- **Slate Pro UI** design system (`src/components/ui/*`).
- Plans/specs: `2026-06-04-loomlance-phase-1-foundation.md`, `2026-06-04-loomlance-rebuild-design.md`, `2026-06-17-ui-redesign-slate-pro*`.

### Phase 2 — Polish & PDF ✅
- Invoice **PDF** (react-pdf) — *note: only renders correctly in a prod build (`npm run preview`)*.
- **Dashboard insights** (Recharts, lazy-loaded).
- **Cmd+K global search** (CommandPalette).
- Invoice **branding** groundwork, **invoices board view**.
- **pg_cron** jobs: overdue + due-soon invoice notifications.
- **Mobile pass** (responsive nav).
- Plans: `2026-06-17-phase-2-*`, `2026-06-18-phase-2-invoice-cron-jobs.md`, `2026-06-18-phase-2-mobile-pass.md`.

### Phase 3 — Send & Pay (mock) ✅
- Public invoice page `/i/:token`, share-link controls.
- **MOCK** send / connect / pay flows; viewed/paid notifications.
- ⚠️ `mock_pay_invoice` is a dev-gated public write — **disable `app_config.mock_payments_enabled` before prod**.
- Real Resend + Stripe deferred → **Phase 5**.
- Plan/spec: `2026-06-18-loomlance-phase-3-send-and-pay*`.

### Phase 4 — Tier features ✅
Five sub-projects, each with its own spec → plan → build:
1. **Invoice branding** (Tier 1) ✅
2. **Time tracking** (Tier 1) ✅ — `time_entries`, `/time`, topbar timer, `generate_invoice_from_time` RPC.
3. **Expenses** (Tier 2) ✅ — `expenses` + private `receipts` bucket, `/expenses`, `generate_invoice_from_expenses` RPC.
4. **Recurring invoices** (Tier 1) ✅ — `recurring_invoice_templates`, `/invoices/recurring`, daily cron 06:30 UTC.
5. **Reports** (Tier 2) ✅ — `/reports` (Revenue / P&L / Aging / Time tabs), CSV export, per-currency, date presets.
- Plans/specs: `2026-06-18`/`2026-06-19-loomlance-phase-4-*`.

---

## 🐞 CURRENT — Live QA pass (findings F1–F10)

Live QA on the tier-2 user; findings logged in `docs/qa-findings.md`. **Fixes are planned/applied after QA is marked "done."** Several findings feed the future phases below.

**Quick fixes (batchable):**
- **F1** [P2] — Downloaded invoice PDF: "INVOICE" title collides with the invoice number (`InvoicePDF.jsx`).
- **F4a** [P2] — Dashboard revenue chart shows a text-selection rectangle on click/drag (add `select-none`).
- **F5** [P1] — Mobile sidebar drawer mispositioned (drawer is `fixed` inside a `backdrop-blur` header → portal it to `document.body`).
- **F8** [P3] — Clients list rows have no per-row quick actions (confirm action set at triage).
- **F10** [P2] — Client → Activity tab is a stale stub ("Phase 2."); fix copy now or build the timeline (→ Phase 8/future).

**Feed future phases (brainstorming-tagged):** F2/F3 → Phase 9, F4b → Phase 8, F6 → Phase 8, F7 → Phase 9, F9 → Phase 10, F10 timeline → future.

---

## 🔜 / 🧪 FUTURE — slated

### Phase 5 — Real integrations 🔜  *(biggest deferred item)*
Replace the Phase 3 MOCKs with real services via **Supabase Edge Functions** (none exist yet).
- **Email:** real **Resend** (flip `VITE_EMAIL_PROVIDER` off `mock`).
- **Payments:** real **Stripe Connect** (flip `VITE_PAYMENTS_PROVIDER` off `mock`).
- Deploy Edge Functions + set their secrets; **disable `app_config.mock_payments_enabled`** for prod.
- Gate: needs its own brainstorm → spec → plan before build.

### Phase 6 — Hardening & reliability 🔜
Deferred items noted during Phase 4 review (`context.md` §3/§4):
- **Cron robustness:** per-template `begin/exception` isolation across all 3 cron jobs (today a poison row aborts the whole run).
- **`check (due_days >= 0)`** constraint on `recurring_invoice_templates`.
- Revisit the **contract-pdfs upload** path (never tested; may share the old `{ upsert: true }` RLS bug).

### Phase 7 — Reports & export polish 🔜
Explicitly deferred during Phase 4 brainstorming:
- CSV/PDF **export for invoices**.
- **Report drill-downs**.
- **Accrual-basis** revenue toggle (vs. cash basis).
- **FX / multi-currency** handling beyond per-currency grouping.

### Phase 8 — Navigation & UX intuitiveness 🔶 *(in progress)*
Make the platform more intuitive to move around. Sources: **F4b, F6, F10**.
- ✅ **F6** — consistent **breadcrumb** navigation: reusable `Breadcrumbs` (parent-route based) on all detail pages (Clients/Projects/Contracts/Invoices + Invoices/Recurring). Commit pending. Done 2026-06-21.
- ✅ **F4b** — dashboard revenue chart bars are clickable → drill into **Reports → Revenue** scoped to that month (`/reports?tab=&from=&to=` deep-link via `useSearchParams`). Done 2026-06-21.
- **F10** — client **Activity timeline** (aggregate per-client events) — replaces the stale "Phase 2" stub.

### Phase 9 — Time tracking v2 ✅ *(shipped 2026-06-21; F7 still open)*
Redesigned the time experience. Sources: **F2, F3** (done), **F7** (deferred). Spec: `docs/superpowers/specs/2026-06-20-time-page-v2-design.md` (FINAL); plan: `docs/superpowers/plans/2026-06-21-time-page-v2.md`.
- **Model (revised during brainstorm):** bill **per PROJECT** (not per contract); contract is optional-on-top. Ready-to-bill panel (one row per project with unbilled time → one-click draft invoice); ledger Client + Contract columns/filters; real `time_entries.contract_id` tagging; contract `hourly_rate` pre-fills tagged entries.
- ✅ **F2** — client/contract shown on each entry.
- ✅ **F3** — replaced the pick-a-client modal with the per-project panel.
- ✅ **F7** — topbar timer rework: true pause (one entry, paused time excluded) ⇄ resume, commit (✓) / discard (✕ with confirm), breathing red/amber dot. `time_entries.paused_at` + `paused_seconds`; verified live. Commit `df7cb3a`.
- Built across commits `52bc781`→`3c1c7c4`; verified live via MCP (per-project invoice, contract→rate line grouping, `NO_UNBILLED_TIME`, RLS).
- ✅ **Paired Expenses v2 (F12) — shipped 2026-06-21:** `/expenses` now has a per-project + per-client **Ready-to-bill panel** with **find-or-append** billing — generating for a project (time OR expenses) appends to one unified per-project draft via shared `_find_or_create_draft`. Client-only expenses bill per-client. Plan `docs/superpowers/plans/2026-06-21-expenses-v2.md`; commit `40874c0`; verified live. (F12a/b shipped earlier in Track A.)

### Phase 10 — Client / contacts rework 🧪 *(brainstorming)*
Source: **F8, F9**.
- **F9** — resolve the confusing overlap between the Overview "Contact" section (client's own fields) and the empty "Contacts" tab (`client_contacts` multi-person model): remove/fold-in, rename to "People"/"Team", or clarify. Check `useSetPrimaryContact` + all `client_contacts` consumers before removing.
- **F8** — per-row quick actions on the Clients list (and possibly the per-client contacts table).

### Phase 11 — Test coverage 🔜
- Broaden **Playwright E2E** for the new Tier-2 pages (Time, Expenses, Recurring, Reports).
- Current: 68/68 Vitest unit tests green (12 files).

---

## Working agreements (carry-forward)
- **User pushes manually** — never `git push` unless asked. Commit freely; work on `main`.
- Every substantive phase follows the superpowers flow: **brainstorming → writing-plans → executing** (HARD GATE — get approval before building).
- Live-verify via Supabase MCP as the tier-2 user; scope test data to `ZZ-` markers; never bulk-delete (user uses the app live).
