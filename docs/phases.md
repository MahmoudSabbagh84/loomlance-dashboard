# LoomLance Dashboard — Phases Roadmap

> Single source of truth for **what's been built** and **what's slated next**. Compiled from `docs/superpowers/plans/`, `docs/superpowers/specs/`, `context.md`, and the live QA log (`docs/qa-findings.md`).
>
> **Status legend:** ✅ Done & shipped · 🔜 Slated (planned, not started) · 🧪 Brainstorming (needs a `superpowers:brainstorming` design pass before build) · 🐞 QA fix (from the current QA session)
>
> **Last updated:** 2026-06-21 (SES email LIVE; autosave Phase 1 shipped).

---

## Snapshot

| Phase | Theme | Status |
|------|-------|--------|
| Phase 1 | Foundation & core rebuild | ✅ Done |
| Phase 2 | Polish & PDF | ✅ Done |
| Phase 3 | Send & Pay (mock) | ✅ Done (real integrations deferred → Phase 5) |
| Phase 4 | Tier features | ✅ Done |
| **— QA pass —** | Live QA findings (F1–F10) | 🐞 In progress (capturing) |
| Phase 5 | Real integrations (SES + Stripe + PayPal, per-user) | ✅ **Done** — 5a SES email LIVE, 5b Stripe pay LIVE (test mode), 5c PayPal link MVP shipped |
| Phase 6 | Hardening & reliability | 🔜 Slated |
| Phase 7 | Reports & export polish | 🔜 Slated |
| Phase 8 | Navigation & UX (F6/F4b/F10 done) | ✅ Done |
| Phase 9 | Time tracking v2 + Expenses v2 (F2/F3/F7/F12c done) | ✅ Done |
| Phase 10 | Client/contacts rework (F9/F8 done) | ✅ Done |
| Phase 11 | Test coverage (E2E) | 🔜 Slated |
| Phase 12 | Autosave everywhere (drop manual Save) | ✅ Done (invoice editor + all modals + profile) |

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

### Phase 5 — Real integrations ✅  *(spec: `docs/superpowers/specs/2026-06-21-phase-5-real-integrations.md`)*
Replace the Phase 3 MOCKs with real services via **Supabase Edge Functions** (already scaffolded). Email = **AWS SES**; payments = **Stripe + PayPal**, **optional per user**; cash/bank is the universal baseline.
- ✅ **5a — LIVE & verified (2026-06-21):** migration `profiles.online_payments_enabled` + `default_payment_instructions` + `paypal_link`; `send-invoice` Edge Function rewritten Resend→**SES** (SigV4 via aws4fetch, platform-from + reply-to user); `providers.js` accepts `ses`; `PaymentsTab` master toggle + default-instructions card; new invoices prefill instructions from the profile; public `can_pay` now also requires `online_payments_enabled`. **Cash already works** (`MarkPaidModal` method `cash`).
  - **Go-live done:** SES domain `send.loomlance.com` verified in AWS account `183631341841` (Easy DKIM + custom MAIL FROM `bounce.send.loomlance.com` + DMARC `p=none`, all in Route 53); SES **production access granted**; least-privilege IAM user `loomlance-ses-sender` (scoped to `ses:SendEmail` on the identity); Supabase secrets set (`AWS_*`, `SES_FROM_EMAIL=invoices@send.loomlance.com`, `PUBLIC_SITE_URL=https://app.loomlance.com`); `send-invoice` deployed (**v2** — fixed silent Gmail quarantine by adding `Date`/`Message-ID` headers + RFC-2045 76-col base64 wrapping). **Real platform send confirmed delivered to inbox.**
  - **Outstanding (USER):** delete the root access key pasted during setup; replace the `loomlance` AWS CLI profile (currently root) with a scoped non-root user.
- ✅ **5b — Stripe: LIVE & verified (test mode, 2026-06-21).** Deployed `stripe-connect` (JWT), `stripe-checkout` (no-JWT), `stripe-webhook` (no-JWT) via MCP. DB ready (`stripe_events`, `invoice_payments.stripe_payment_intent_id`). User: enabled Connect platform + Express onboarding, set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` secrets, registered webhook for `checkout.session.completed`. Flipped `VITE_PAYMENTS_PROVIDER=stripe`; **disabled `app_config.mock_payments_enabled`**. Verified: 2 test-card payments → webhook → invoices auto-marked `paid` with `invoice_payments` rows (method `stripe`, real PI ids).
  - **Go-live TODO (USER):** switch to `sk_live_` + live webhook secret + activate Stripe live mode; set Edge `PUBLIC_SITE_URL` + `VITE_PUBLIC_SITE_URL` to the deployed dashboard URL (currently `app.loomlance.com` for email/redirect, `localhost:4173` locally).
- ✅ **5c — PayPal (link MVP): shipped 2026-06-21.** `get_public_invoice` now returns `paypal_link` (gated on `online_payments_enabled` + payable status; migration `20260621230000_phase5c_paypal_public.sql`, live-verified). `PaymentsTab` has an autosaving PayPal.me link field; public invoice renders a **"Pay with PayPal"** button (`src/lib/paypal.js` `paypalHref` builds the URL + appends amount, 8 tests). `MarkPaidModal` + payment schema gain a **`paypal`** method for manual confirmation (no webhook — confirm receipt via Mark as paid). Commit `a254508`. **Later upgrade:** PayPal Orders API + webhook for auto-reconcile.
- **Live prerequisites (USER):** AWS SES (verify domain DKIM/SPF/DMARC + request prod access + IAM keys), Stripe (keys + webhook), PayPal; `supabase functions deploy …`; set secrets (`AWS_*`, `SES_FROM_EMAIL`, `STRIPE_*`); flip `VITE_EMAIL_PROVIDER=ses` / `VITE_PAYMENTS_PROVIDER=stripe`; **disable `app_config.mock_payments_enabled`**.

### Phase 6 — Hardening & reliability 🔜
- ✅ **Server-side tier-feature enforcement (2026-06-22):** UI gating (`tier.js`/`TierGate`/page UpgradeCards) was bypassable via the public REST API with a user's own JWT. Added `enforce_tier_feature()` + `before insert` triggers on `time_entries`/`recurring_invoice_templates` (require tier_1+) and `expenses` (require tier_2), mirroring `enforce_project_limit`. Raises `FEATURE_NOT_IN_TIER`. Migration `20260622010000_tier_feature_enforcement.sql`; verified live across free/tier_1/tier_2 (atomic, rolled-back probe). Tier value itself was already service_role-only (no self-upgrade) and the **project limit** was already DB-enforced. *(Audit verdict: branding data is settable but display is tier-gated in the public invoice → low risk; reports are read-only on own data → low risk; not enforced.)*
  - **Follow-up (downgrade handling, deferred):** a user who downgrades tier_1→free keeps existing recurring templates → cron still processes them (trigger only guards INSERT). Decide pause/skip-on-downgrade when subscriptions (F6) land.

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

### Phase 8 — Navigation & UX intuitiveness ✅ *(shipped 2026-06-21)*
Make the platform more intuitive to move around. Sources: **F4b, F6, F10** — all done.
- ✅ **F6** — consistent **breadcrumb** navigation: reusable `Breadcrumbs` (parent-route based) on all detail pages (Clients/Projects/Contracts/Invoices + Invoices/Recurring). Commit pending. Done 2026-06-21.
- ✅ **F4b** — dashboard revenue chart bars are clickable → drill into **Reports → Revenue** scoped to that month (`/reports?tab=&from=&to=` deep-link via `useSearchParams`). Done 2026-06-21.
- ✅ **F10** — client **Activity timeline**: `ActivityTab` aggregates the client's invoices, contracts, and expenses into a chronological timeline (time entries deferred). Done 2026-06-21.

### Phase 9 — Time tracking v2 ✅ *(shipped 2026-06-21; F7 still open)*
Redesigned the time experience. Sources: **F2, F3** (done), **F7** (deferred). Spec: `docs/superpowers/specs/2026-06-20-time-page-v2-design.md` (FINAL); plan: `docs/superpowers/plans/2026-06-21-time-page-v2.md`.
- **Model (revised during brainstorm):** bill **per PROJECT** (not per contract); contract is optional-on-top. Ready-to-bill panel (one row per project with unbilled time → one-click draft invoice); ledger Client + Contract columns/filters; real `time_entries.contract_id` tagging; contract `hourly_rate` pre-fills tagged entries.
- ✅ **F2** — client/contract shown on each entry.
- ✅ **F3** — replaced the pick-a-client modal with the per-project panel.
- ✅ **F7** — topbar timer rework: true pause (one entry, paused time excluded) ⇄ resume, commit (✓) / discard (✕ with confirm), breathing red/amber dot. `time_entries.paused_at` + `paused_seconds`; verified live. Commit `df7cb3a`.
- Built across commits `52bc781`→`3c1c7c4`; verified live via MCP (per-project invoice, contract→rate line grouping, `NO_UNBILLED_TIME`, RLS).
- ✅ **Paired Expenses v2 (F12) — shipped 2026-06-21:** `/expenses` now has a per-project + per-client **Ready-to-bill panel** with **find-or-append** billing — generating for a project (time OR expenses) appends to one unified per-project draft via shared `_find_or_create_draft`. Client-only expenses bill per-client. Plan `docs/superpowers/plans/2026-06-21-expenses-v2.md`; commit `40874c0`; verified live. (F12a/b shipped earlier in Track A.)

### Phase 10 — Client / contacts rework ✅ *(F9 shipped 2026-06-21; F8 done in Track A)*
Source: **F8, F9**.
- ✅ **F9** — folded the multi-contact management into the client **Overview** as a `PeopleCard` and removed the confusing "Contacts" tab; renamed Overview's "Contact" card → "Details". `client_contacts` capability preserved.
- ✅ **F8** — per-row quick actions (Edit/Email/Delete) on the Clients list (shipped in Track A).

### Phase 11 — Test coverage 🔜
- Broaden **Playwright E2E** for the new Tier-2 pages (Time, Expenses, Recurring, Reports).
- Current: **87/87 Vitest unit tests green** (14 files).

### Phase 12 — Autosave everywhere ✅ *(brainstorm + plan: `docs/superpowers/specs|plans/2026-06-21-autosave*`)*
Manual **Save** removed across the app; edits persist automatically. Decisions: pilot on invoice editor → read-only after send → modals autosave too (via a create/edit split) → creation stays an explicit step.
- ✅ **Phase 1:** `useAutosave` hook (debounce + per-field validation gate + serialized latest-wins writes + retain/retry) and `<SaveStatus>` indicator; **invoice editor** converted (drafts autosave, sent/paid/void read-only). Commit `dc35bf4`.
- ✅ **Phase 2:** `useAutosaveForm` (whole-form, commit-based); **client / project / contract / expense / recurring** modals — edit autosaves (no Save button, SaveStatus + Done), create stays explicit; receipt upload + line add/remove handled. Commit `c32311c`.
- ✅ **Phase 3:** profile sweep — **Business / Account (display name) / Branding / Payments default-instructions** autosave (RHF tabs use `values` + `resetOptions.keepDirtyValues`); password change, logo upload, Stripe connect stay explicit. Commit `145207e`.
- **11 autosave hook unit tests** (92 suite total). Explicit-only actions everywhere: Send, Generate-from-time/expenses, Mark-paid, Void, Delete, uploads, password, Stripe connect.
- Also fixed the **invoice client-default bug** (new invoices silently bound to client #1 → explicit `NewInvoiceModal` picker; commit `2f30f64`).

---

## Working agreements (carry-forward)
- **User pushes manually** — never `git push` unless asked. Commit freely; work on `main`.
- Every substantive phase follows the superpowers flow: **brainstorming → writing-plans → executing** (HARD GATE — get approval before building).
- Live-verify via Supabase MCP as the tier-2 user; scope test data to `ZZ-` markers; never bulk-delete (user uses the app live).
