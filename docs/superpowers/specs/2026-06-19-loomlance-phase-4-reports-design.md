# LoomLance Phase 4 — Reports Design

**Status:** Approved 2026-06-19
**Phase 4 sub-project 5 of 5 (FINAL)** (branding ✅ → time tracking ✅ → expenses ✅ → recurring invoices ✅ → **reports**). Aggregates the data the earlier sub-projects produce.

## 1. Goal

Give Tier 2 freelancers a `/reports` page with four date-filterable tabs that aggregate data already in the app, each exportable to CSV.

## 2. Scope

### In scope
- `/reports` page (Tier-gated `FEATURES.REPORTS`, tier_2; the Sidebar item already exists), with four tabs:
  - **Revenue** — payments received (cash basis) by month, by client, by project.
  - **P&L** — revenue (payments) − expenses, by month, with net per period.
  - **Aging** — open invoices (`sent`/`viewed`/`overdue`) bucketed by days past due (Current / 1–30 / 31–60 / 61–90 / 90+).
  - **Time** — tracked hours billable vs non-billable, by project, with billable amount.
- A **shared date-range control** (presets: This month, Last month, This quarter, Year to date, Last 12 months, Custom) applied to all tabs.
- **Per-currency** aggregation with a currency picker (NO FX conversion), mirroring the dashboard insights.
- **CSV export** per tab (downloads that tab's aggregated rows).
- **No new DB tables/RPCs** — client-side rollups in pure, unit-tested helpers (like `dashboardStats.js`). Charts via lazy-loaded Recharts.

### Out of scope (later/never)
- FX conversion across currencies; accrual-basis revenue; scheduled/emailed reports; PDF export; drill-down navigation; tax reports.

## 3. Decisions made during brainstorming
- **All four tabs** (Revenue, P&L, Aging, Time).
- **Client-side rollups** in pure helpers (no new DB objects), matching `dashboardStats.js`.
- **Cash-basis revenue** — revenue = `invoice_payments` by `paid_at` (matches the dashboard); P&L = payments − `expenses` (by `spent_on`).
- **Per-currency, no FX** — each report computes per currency; a picker switches the displayed currency.

## 4. Architecture

All aggregation is client-side in pure functions under `src/lib/reports.js` (unit-tested), each taking already-fetched rows + a date range and returning chart/table-ready data grouped by currency. A thin data layer fetches the raw rows per tab; the page feeds them to the helpers and renders.

### 4.1 Data fetches (`src/api/reports.js`, all RLS-scoped to the user)
- `fetchPayments({ from, to })` — `invoice_payments` select `amount, currency, paid_at, invoices(client_id, project_id, clients(name), projects(name))`, where `paid_at >= from and paid_at < toExclusive`.
- `fetchExpenses({ from, to })` — `expenses` select `amount, currency, spent_on, category`, where `spent_on >= from and spent_on <= to`.
- `fetchOpenInvoices()` — `invoices` select `id, invoice_number, currency, due_date, status, clients(name), invoice_line_items(quantity, unit_price, tax_rate, discount_rate)` where `status in ('sent','viewed','overdue')`. (Aging is "as of today"; it considers all currently-open invoices, not range-bound — see §5.3.)
- `fetchTimeEntries({ from, to })` — `time_entries` select `duration_minutes, billable, hourly_rate, project_id, projects(name)` where `ended_at is not null and started_at >= from and started_at < toExclusive`.
- All return `data || []`, throwing via `mapPostgresError`.

> Date handling: `from`/`to` are `YYYY-MM-DD`. For timestamptz columns (`paid_at`, `started_at`) use a half-open range `[from 00:00, (to+1day) 00:00)` (`toExclusive`). For date columns (`spent_on`) use inclusive `>= from and <= to`.

### 4.2 Hooks (`src/hooks/useReports.js`)
- `usePaymentsReport(range)`, `useExpensesInRange(range)`, `useOpenInvoices()`, `useTimeReport(range)` — TanStack Query, keyed by `['reports', <name>, range]`. (P&L composes payments + expenses; the page can call both hooks.)

### 4.3 Pure helpers (`src/lib/reports.js`)
Currency grouping mirrors `dashboardStats.js` (`{ [currency]: bucket }`, default `'USD'`). Month keys are `YYYY-MM` from local date parts.

- `DATE_PRESETS` + `rangeForPreset(preset, today)` → `{ from, to }` ISO dates. Presets: `this_month`, `last_month`, `this_quarter`, `ytd`, `last_12_months`, `custom`. `today` is injected (a `Date`) so the function is deterministic and testable.
- `monthBuckets(from, to)` → ordered `[{ key:'YYYY-MM', label:'Mon YY' }]` spanning the range.
- `revenueReport(payments, range)` → `{ currencies: string[], byCurrency: { [cur]: { monthTotals: {key:amount}, byClient: [{name,total}], byProject: [{name,total}], total } } }`. Amount = `Number(payment.amount)`; client/project names from the joined rows (fallback "Unassigned").
- `plReport(payments, expenses, range)` → `{ currencies, byCurrency: { [cur]: { months: [{ key, label, revenue, expense, net }], totals: { revenue, expense, net } } } }`. `net = revenue - expense` per month and overall.
- `agingReport(openInvoices, today)` → `{ currencies, byCurrency: { [cur]: { buckets: { current, d1_30, d31_60, d61_90, d90plus }, rows: [{ invoice_number, client, due_date, days_overdue, amount, bucket }], total } } }`. Invoice amount via `invoiceTotals(line_items).total`. `days_overdue = floor((today - due_date)/day)`; bucket boundaries: `<= 0` → `current`; `1–30` → `d1_30`; `31–60` → `d31_60`; `61–90` → `d61_90`; `> 90` → `d90plus`.
- `timeReport(entries)` → `{ byProject: [{ project, billableHours, nonBillableHours, totalHours, amount }], totals: { billableHours, nonBillableHours, totalHours, amount } }`. Hours via `hoursFromMinutes(duration_minutes)` from `@/lib/time`; `amount = Σ (billable minutes/60 × hourly_rate)`. (Time is hours-based; not currency-split — uses the user's default currency for the amount display.)
- `toCSV(rows, columns)` → CSV string. `columns = [{ key, label }]`; values quoted when they contain `,`, `"`, or newline; `"` doubled.

**Why pure:** rows in → totals out, no Supabase/React dependency — trivially unit-tested, like the existing `dashboardStats`/`time`/`expenses`/`money` helpers.

## 5. Reports (rendering)

Each tab renders a chart and/or table + a **Download CSV** button, respecting the shared date range and currency picker. Each shows a friendly "No data in this range" empty state when its rows are empty.

### 5.1 Revenue
Bar chart of payments per month (same look as the dashboard `RevenueChart`) + two tables — **by client** and **by project** (name, total, % of total). CSV: month + revenue rows.

### 5.2 P&L
Per-month rows of revenue, expense, and **net** (green if ≥ 0, red if < 0), a grouped bar chart (revenue vs expense per month), and a totals summary row. CSV: month, revenue, expense, net.

### 5.3 Aging
As-of-today buckets of open invoices by days past `due_date`: Current, 1–30, 31–60, 61–90, 90+. A bar chart of bucket totals + a table of the underlying invoices (number, client, due date, days overdue, amount, bucket). CSV: the invoice rows. (Aging ignores the date-range control — it always reflects currently-open invoices; the range control is hidden or disabled on this tab.)

### 5.4 Time
Per-project table: billable hours, non-billable hours, total hours, billable amount. A bar chart of billable vs non-billable hours per project. CSV: the per-project rows.

### 5.5 Multi-currency
When a report has more than one currency, a currency-picker (extracted from the `DashboardInsights` pattern) switches the displayed figures; each report computes per-currency with no mixing. The default selection is `profile.default_currency` if present in the data, else the first currency. (Time uses default currency for its amount; it is not currency-split.)

## 6. Components & routing

```
src/lib/reports.js                       pure helpers (§4.3) + toCSV + presets
src/lib/__tests__/reports.test.js        unit tests
src/api/reports.js                       per-tab fetches (§4.1)
src/hooks/useReports.js                  TanStack Query hooks (§4.2)
src/features/reports/
  DateRangeControl.jsx                   preset Select + custom from/to inputs; emits {from,to,preset}
  CurrencyTabs.jsx                       currency picker (pattern from DashboardInsights)
  ReportChart.jsx                        thin lazy Recharts wrapper (bar + grouped bar)
  RevenueReport.jsx                      §5.1
  PnLReport.jsx                          §5.2
  AgingReport.jsx                        §5.3
  TimeReport.jsx                         §5.4
src/pages/ReportsPage.jsx                tier gate + tab switcher + shared DateRangeControl
src/app/routes.jsx                       add { path: 'reports', element: <ReportsPage /> }
src/lib/download.js                      downloadTextFile(filename, text, mime) helper (Blob + <a download>)
```

- **`ReportsPage`**: tier-gate (`!hasFeature(tier, FEATURES.REPORTS)` → `<UpgradeCard feature={FEATURES.REPORTS} currentTier={tier} target="tier_2" />` inside a `PageHeader title="Reports"`). Renders `DateRangeControl` once at top (hidden/disabled on the Aging tab), a tab bar (Revenue / P&L / Aging / Time), and the active tab component. Range + active-tab state live on the page; switching tabs keeps the range.
- **CSV download**: tab components build rows via the report helper, call `toCSV(rows, columns)`, then `downloadTextFile('revenue-2026-06.csv', csv, 'text/csv')`. No new dependencies.
- **Charts**: lazy-loaded Recharts wrapped in `ReportChart.jsx` (themed with CSS vars exactly like `RevenueChart.jsx`), `Suspense` fallback `<Skeleton/>`, as in `DashboardInsights`.
- **Reuse**: `PageHeader`, `Card`, `Skeleton`, `EmptyState`, `Select`, design-system `Table`; `formatCurrency`/`formatDate`; `invoiceTotals` (`@/lib/money`); `hoursFromMinutes` (`@/lib/time`); `SUPPORTED_CURRENCIES` not needed (currencies derive from the data).

## 7. Error handling
- Fetches throw via `mapPostgresError`; tab components show the standard loading `Skeleton` and an empty state; query errors surface a toast (page-level) consistent with other pages.
- A custom range with `from > to` is guarded in `DateRangeControl` (swap or block, with a small inline note) before it reaches the query.

## 8. Testing
- **Unit (the core value):** `src/lib/reports.js` —
  - `rangeForPreset` with an injected `today` (deterministic): `this_month`, `last_month`, `this_quarter`, `ytd`, `last_12_months` boundaries.
  - `monthBuckets` span/labels.
  - `revenueReport` (month/client/project grouping; per-currency split; "Unassigned" fallback).
  - `plReport` (net = revenue − expense per month and overall).
  - `agingReport` (bucket edges: due today → current; 1, 30, 31, 60, 61, 90, 91 days → correct buckets; amount via invoiceTotals).
  - `timeReport` (billable vs non-billable split; amount math; hours rounding).
  - `toCSV` (escaping commas, quotes, newlines).
- **Live (tier-2 test user, `ZZ-` markers, via MCP/UI):** seed in-range a paid invoice (payment), an expense, a completed time entry, plus an overdue invoice; open `/reports`; verify Revenue/P&L/Aging/Time figures, the currency picker, and a CSV download; confirm out-of-range rows are excluded. Then delete all seeded rows.
- Build + lint + full unit suite green.
