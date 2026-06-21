# Time Page v2 — Design Spec (FINAL — ready for planning)

> **STATUS: FINAL.** Brainstorm complete 2026-06-21. All sections settled. Next step: produce an implementation plan (superpowers not installed on this Mac — plan will be authored manually in `docs/superpowers/plans/`), then build behind the usual review gate. **No implementation yet — awaiting approval to plan.**

**Origin:** QA findings **F2** (entries don't show client/contract) and **F3** (generate-invoice lists ALL clients). Guiding principle: **easy for a new user to grasp** — mental model first, mechanics follow (memory: `loomlance-onboarding-simplicity`).

## Mental model (onboarding narrative)
**Client → Project → _(optional)_ Contract → track Time & Expenses → Invoice → get paid.**
1. Add a **client** (who pays). 2. Create a **project** (the work; LoomLance is projects-first). 3. From the dashboard, **pick a project from a dropdown** and track time. 4. **Generate an invoice** from unbilled time → send → paid. 5. **Contracts are optional** agreements you can attach (and they can carry an hourly rate).

## Locked decisions
1. **Structure:** "Ready to bill" panel atop `/time` + entries **ledger** below (new columns/filters).
2. **Billing unit = PROJECT.** "Generate invoice" acts on a project → one invoice per project covering all its unbilled billable time. Contract is optional-on-top, not the billing unit.
3. **Per-entry contract tagging:** real `time_entries.contract_id` + a contract picker (timer popover + manual/edit form), scoped to the chosen project's contracts.
4. **Contract sets the rate:** contracts gain optional `hourly_rate`; tagging an entry to such a contract **pre-fills** the entry rate (contract rate > profile default), still **editable**.
5. **Untagged time** just bills at its own rate inside the project's invoice (no separate per-client bucket — a project always has a client).

## Section 1 — Goal & Scope
**Goal:** Show *whose* work each entry is, and make billing an obvious one-click action **per project** — replacing the "pick a client from all clients" modal.

**In scope:** entry→contract link + picker; `contracts.hourly_rate` + rate pre-fill; ledger Client/Contract columns + Client/Contract filters; per-project "Ready to bill" panel; one-click per-project invoice generation; remove old `GenerateInvoiceModal`.

**Out of scope:** expenses/recurring billing (separate Expenses v2 / F12c); multi-currency mixing; reassigning billed time; contract creation; **F7** topbar-timer visual rework (play/pause + animation) — kept a separate effort; this only adds the contract picker + rate pre-fill to the timer.

## Section 2 — Data model
- **`time_entries.contract_id`**: `uuid null references contracts(id) on delete set null` + index. SET NULL preserves time history when a contract is deleted.
- **`contracts.hourly_rate`**: `numeric null` (optional). A contract may be fixed-`value`, hourly, or both.
- **Contract picker scope** (after a project is chosen): `client_id = <project's client>` AND (`project_id = <chosen project>` OR `project_id IS NULL`) AND `status IN ('active','draft')`.
- **Timer popover:** contract optional/secondary — fast-start needs only a project; contract can be added later via the edit form.
- **Rate pre-fill:** selecting a contract with `hourly_rate` pre-fills the entry rate (overrides profile default); user-editable; existing entries unchanged; clearing the contract leaves the rate as-is.
- **API SELECT** (`src/api/time-entries.js`): add `contract_id, contracts(title, hourly_rate)` (already joins `projects(name, client_id, clients(name))`).

## Section 3 — Billing logic / RPCs
- **New RPC `generate_invoice_from_time_for_project(p_project_id)`** — SECURITY DEFINER, scoped to `auth.uid()`. Creates a **draft** invoice: client = project's `client_id`, project = `p_project_id`, currency = profile default. Bills all **completed, billable, unbilled** entries on the project. Stamps those entries billed (`invoiced_on_invoice_id`). Raises `NO_UNBILLED_TIME` (errcode P0001) when none.
- **Line-item grouping:** by **contract, then rate**. One line per (contract_id, rate) combo; untagged time (`contract_id IS NULL`) groups by rate as its own lines. Line description = contract title (or "Time" when untagged) + hours; qty = hours, unit_price = rate.
- **Retire** `generate_invoice_from_time(p_client_id)` (per-client) — the per-client modal is removed.
- **"Ready to bill" aggregation:** group completed/billable/unbilled entries by `project_id` → `{ project, client, hours, amount }` rows; only projects with such time appear. (Running timers excluded — not billable until stopped.)

## Section 4 — UI / components
- **`/time` layout:** `ReadyToBillPanel` (per-project rows: `Project · Client · hours · amount · [Generate invoice]`) on top; toolbar with Project/Client/Contract/status filters; ledger below.
- **Generate flow:** one-click on a row → create draft via the new RPC → **navigate to the existing invoice editor** (the editor is the preview; nothing is sent). Toast on success; map `NO_UNBILLED_TIME`.
- **`TimeEntriesTable`:** add **Client** and **Contract** columns (Contract shows `contracts.title` or "—").
- **Filters:** add **Client** and **Contract** filters (keep Project + status).
- **`TimerWidget`:** after project is chosen, show an optional contract picker (scoped per Section 2); on contract select, pre-fill rate from `hourly_rate`. Still startable with project only.
- **`TimeEntryFormModal`:** add contract picker (scoped) + rate pre-fill on select.
- **`ContractFormModal`:** add optional `hourly_rate` input.
- **Remove** `GenerateInvoiceModal` and its `useClients`-driven client list.
- **Hooks/api:** `useTimeEntries` — add `generateInvoiceFromTimeForProject` + a ready-to-bill query; start/manual/update accept `contractId`. Contract schema (`src/api/schemas/contracts`) + time-entry schema add the new fields. Selects use controlled dropdowns (per F11/F15 — value+setValue, since options load async).

## Section 5 — Testing
- **Unit (Vitest, deterministic, injected data):** ready-to-bill per-project aggregation helper; line-item grouping by contract+rate (extend/adjust `groupTimeForInvoice` in `src/lib/time.js`).
- **Live MCP verification** as the tier-2 user (uid `cb6e852e-…`), with `ZZ-` markers + FK-ordered cleanup: tag entries to a contract (verify rate pre-fill), generate a per-project invoice (verify line items grouped by contract+rate, entries stamped billed), `NO_UNBILLED_TIME` on empty, RLS scoping (set_config jwt claims). Build/lint/test green before review.

## Migration plan
One migration file `supabase/migrations/<ts>_time_v2.sql` (+ apply via MCP `apply_migration`): add `time_entries.contract_id` (FK SET NULL + index), `contracts.hourly_rate`, create `generate_invoice_from_time_for_project`, drop `generate_invoice_from_time`.

## Relevant existing code
- `src/pages/TimePage.jsx`, `src/features/time/TimeEntriesTable.jsx`, `GenerateInvoiceModal.jsx` (remove), `TimeEntryFormModal.jsx`, `TimerWidget.jsx`.
- `src/api/time-entries.js`, `src/lib/time.js` (`groupTimeForInvoice`, `formatDuration`, `hoursFromMinutes`), `src/hooks/useTimeEntries.js`.
- `src/features/contracts/ContractFormModal.jsx`, `src/api/schemas/contracts`.
- DB: `time_entries` (`20260619014123_time_tracking.sql`), `contracts` (`client_id`, `project_id` nullable, `title`, `status`, `value`, `currency`, + new `hourly_rate`).
