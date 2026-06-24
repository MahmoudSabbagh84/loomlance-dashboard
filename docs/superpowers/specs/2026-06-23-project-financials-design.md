# Project Financials — Design Spec

- **Date:** 2026-06-23
- **Status:** Approved in brainstorm → ready for implementation plan
- **Linear:** LOO-86
- **Related:** LOO-85 (invoice status visibility + lock-on-send) — built separately via Impeccable, **not** part of this spec.

## Summary

Give each Project an **optional budget** and a **financial panel** on its detail page showing budget burn-down plus actuals: invoiced, paid, expenses, unbilled-to-invoice, and profit. The budget is editable, and every change is recorded in a change log. Rollups are computed client-side (reusing existing money logic) in the project's single currency.

## Goals

- Owner sets an optional budget (amount + currency) on a project; can adjust it anytime; changes are recorded.
- A Financials panel answers, at a glance: how much of the budget is invoiced, how much is left, how much is paid, what's been spent (expenses), what's delivered but not yet billed, and the project's profit.
- Invoices / expenses / time entries already linked to the project roll up automatically.

## Non-goals (YAGNI)

- Multi-currency conversion / FX. Mismatched-currency linked items are **excluded + flagged**, never silently converted.
- Financials on the project **list** (detail page only for now).
- Counting **draft** invoices toward "invoiced."
- Cost-of-own-time in profit — a freelancer's own hours are billable *value*, not a cash cost.

## Decisions (from brainstorm)

1. **Full panel:** budget, invoiced, paid, expenses, unbilled-to-invoice, profit.
2. **Hours/expenses play both roles:** billable + not-yet-invoiced → "unbilled to invoice"; expenses also subtract in profit.
3. **One currency per project;** different-currency linked items excluded + flagged.
4. **Budget editable + change log** (history table).
5. **Rollups computed client-side** (reuse `invoiceTotals`); not a DB function (avoids re-implementing tax/discount math in SQL).
6. **Drafts not counted** toward invoiced (shown faded/separately).

## Data model

### `projects` (alter)
- `budget_amount numeric null`
- `budget_currency text null` — set alongside the amount; defaults to the account default currency when the budget is first set.

### `project_budget_changes` (new)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | default `gen_random_uuid()` |
| `user_id` | uuid | `= auth.uid()`; RLS owner |
| `project_id` | uuid | fk → `projects(id)` on delete cascade |
| `previous_amount` | numeric null | null on first set |
| `new_amount` | numeric null | null if budget cleared |
| `currency` | text | budget currency at change time |
| `note` | text null | optional reason / change-order note |
| `created_at` | timestamptz | default `now()` |

**RLS:** owner-only (select/insert) scoped to `user_id = auth.uid()`, mirroring existing table policies. A row is inserted whenever `budget_amount` or `budget_currency` changes — including first set and clear.

## Rollup definitions

Computed client-side by `useProjectFinancials(projectId)`, in the project's `budget_currency` (fallback: account default if no budget set). Any linked invoice / expense / time entry whose currency ≠ project currency is **excluded** from sums and counted into `excludedCount` for the flag.

- **invoiced** = Σ `invoiceTotals(line_items).total` for the project's invoices with status ∈ {`sent`, `viewed`, `paid`, `overdue`}. (`draft`, `void` excluded. Note: the enum has no `partially_paid`.)
- **draftInvoiced** = same for status `draft` (shown faded, **not** in `invoiced`).
- **paid** = Σ `invoice_payments.amount` for payments on the project's invoices.
- **expenses** = Σ `expenses.amount` for the project.
- **unbilledExpenses** = Σ `expenses.amount` where `billable = true` and `invoiced_on_invoice_id is null`.
- **unbilledTime** = Σ (`duration_minutes`/60 × `hourly_rate`) for `time_entries` where `billable = true` and `invoiced_on_invoice_id is null`.
- **unbilledToInvoice** = `unbilledExpenses` + `unbilledTime`.
- **remaining** = `budget_amount` − `invoiced` (null if no budget).
- **profit** = `paid` − `expenses`.
- **excludedCount** = # linked items in a different currency.

Reuse `invoiceTotals` (`lib/money`) and the minutes→hours/rate logic (`lib/time`, reports). Extract a pure helper `projectFinancials(...)` in `lib/` so the math is unit-testable in isolation.

## UI (all via Impeccable, per the design-system rule)

### Project create/edit form
- Optional **Budget**: amount input + currency select (defaults to account default). Empty = no budget.

### Project detail page → "Financials" panel
- **Budget burn bar:** invoiced of budget, with remaining; over-budget overflow shown in danger. When no budget is set, show a "Set a budget" affordance instead of the bar.
- **Metric grid:** Invoiced · Paid · Expenses · Unbilled to invoice · Profit (formatted in project currency, tabular-nums). `draftInvoiced` shown as a faded sub-note under Invoiced.
- **Currency flag:** when `excludedCount > 0`, a small note — "N items in another currency are excluded."
- **Budget history:** a link/button → modal listing change-log rows (date, prev → new, note). Setting/adjusting the budget writes a change row.

## Testing

- Unit tests for `projectFinancials(...)`: invoiced excludes drafts/void; paid from payments; unbilled excludes already-invoiced; currency exclusion + `excludedCount`; remaining/profit math; empty / no-budget cases.
- Lint / build green; manual check on a project with mixed data.

## Build phases (→ writing-plans)

1. Migration: `projects` columns + `project_budget_changes` table + RLS.
2. `projectFinancials` pure helper + unit tests.
3. `useProjectFinancials` hook (fetch + compute) + budget mutation that writes a change-log row.
4. Project form: budget amount + currency field.
5. Project detail: Financials panel (burn bar, metric grid, currency flag, history modal).
6. Verify (lint / tests / build).

## Open questions

None — all resolved in brainstorm.
