# Reports (Phase 4 sub-project 5, FINAL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tier-2 `/reports` page with four date-filterable, CSV-exportable tabs (Revenue, P&L, Aging, Time) that aggregate existing data client-side.

**Architecture:** Pure aggregation helpers in `src/lib/reports.js` (rows in → totals out, unit-tested), fed by a thin fetch layer (`src/api/reports.js` + `src/hooks/useReports.js`). A `ReportsPage` hosts a shared date-range control + a currency picker and four tab components, each rendering a lazy Recharts chart + a table + a CSV button. No new DB objects. Mirrors the existing dashboard insights (`dashboardStats.js`, `RevenueChart.jsx`, `DashboardInsights.jsx`).

**Tech Stack:** React + Vite, TanStack Query, Recharts (lazy), Tailwind design-system components (`@/components/ui/*`), Supabase JS, Vitest.

## Global Constraints

- **Tier gate:** `/reports` requires `FEATURES.REPORTS` (tier_2). The flag, `UPGRADE_COPY[FEATURES.REPORTS]`, and the Sidebar `/reports` item (target tier_2) already exist — do not re-add.
- **No new DB tables/RPCs.** All aggregation is client-side in pure helpers.
- **Cash-basis revenue:** revenue = `invoice_payments` by `paid_at`. P&L = payments − `expenses` (by `spent_on`).
- **Per-currency, no FX:** every report groups by currency; a picker switches the displayed currency (default = `profile.default_currency` if present in the data, else first). Time is not currency-split (uses default currency for its amount).
- **Date handling:** `from`/`to` are `YYYY-MM-DD`. Timestamptz columns (`paid_at`, `started_at`) use a half-open range `[from 00:00, (to+1 day) 00:00)`. Date columns (`spent_on`) use inclusive `>= from and <= to`.
- **Aging is as-of-today** and ignores the date-range control. Buckets by `today − due_date`: `<= 0` → current; `1–30`; `31–60`; `61–90`; `> 90` → 90+.
- **Reuse, do not re-implement:** `invoiceTotals` (`@/lib/money`) for invoice amounts; `hoursFromMinutes` (`@/lib/time`) for hours; `formatCurrency`/`formatDate`; chart theming exactly like `RevenueChart.jsx` (CSS vars). Currencies derive from data (no `SUPPORTED_CURRENCIES`).
- **Determinism:** any function depending on the current date takes an injected `today: Date` argument (never calls `Date.now()` internally) so tests are deterministic.
- **Errors:** fetches throw via `mapPostgresError`; tabs show `Skeleton` while loading and `EmptyState` when empty.
- **Commit style:** Conventional Commits, scope `reports`. One commit per task.

---

## File Structure

- `src/lib/reports.js` — presets, `monthBuckets`, `toCSV` (Task 1) + `revenueReport`/`plReport`/`agingReport`/`timeReport` (Task 2). **(Tasks 1–2)**
- `src/lib/download.js` — `downloadTextFile`. **(Task 1)**
- `src/lib/__tests__/reports.test.js` — unit tests. **(Tasks 1–2)**
- `src/api/reports.js` — four range-scoped fetches. **(Task 3)**
- `src/hooks/useReports.js` — TanStack Query hooks. **(Task 4)**
- `src/features/reports/DateRangeControl.jsx` — preset + custom range control. **(Task 5)**
- `src/features/reports/CurrencyTabs.jsx` + `ReportChart.jsx` — shared display bits. **(Task 6)**
- `src/features/reports/RevenueReport.jsx` + `PnLReport.jsx` — tabs. **(Task 7)**
- `src/features/reports/AgingReport.jsx` + `TimeReport.jsx` — tabs. **(Task 8)**
- `src/pages/ReportsPage.jsx` + `src/app/routes.jsx` — page + route. **(Task 9)**
- Live verification + cleanup. **(Task 10)**

---

## Task 1: Date/CSV utilities (`src/lib/reports.js` part 1, `src/lib/download.js`)

**Files:**
- Create: `src/lib/reports.js`
- Create: `src/lib/download.js`
- Test: `src/lib/__tests__/reports.test.js`

**Interfaces:**
- Produces (used by later tasks):
  - `DATE_PRESETS: Array<{value,label}>`; `rangeForPreset(preset, today): {from, to}` (ISO date strings; `today` is a `Date`).
  - `monthBuckets(from, to): Array<{key:'YYYY-MM', label:'Mon YY'}>`.
  - `toCSV(rows, columns): string` — `columns = [{key,label}]`.
  - internal (same file, used by Task 2): `iso(date)`, `round2(n)`.
  - `downloadTextFile(filename, text, mime)` in `download.js`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/reports.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { DATE_PRESETS, rangeForPreset, monthBuckets, toCSV } from '@/lib/reports'

const TODAY = new Date(2026, 5, 19) // 2026-06-19 (local)

describe('DATE_PRESETS', () => {
  it('includes the six presets', () => {
    expect(DATE_PRESETS.map((p) => p.value)).toEqual(['this_month', 'last_month', 'this_quarter', 'ytd', 'last_12_months', 'custom'])
  })
})

describe('rangeForPreset', () => {
  it('this_month', () => expect(rangeForPreset('this_month', TODAY)).toEqual({ from: '2026-06-01', to: '2026-06-30' }))
  it('last_month', () => expect(rangeForPreset('last_month', TODAY)).toEqual({ from: '2026-05-01', to: '2026-05-31' }))
  it('this_quarter (Q2)', () => expect(rangeForPreset('this_quarter', TODAY)).toEqual({ from: '2026-04-01', to: '2026-06-30' }))
  it('ytd', () => expect(rangeForPreset('ytd', TODAY)).toEqual({ from: '2026-01-01', to: '2026-06-19' }))
  it('last_12_months', () => expect(rangeForPreset('last_12_months', TODAY)).toEqual({ from: '2025-07-01', to: '2026-06-30' }))
})

describe('monthBuckets', () => {
  it('spans inclusive months with labels', () => {
    expect(monthBuckets('2026-05-10', '2026-07-02')).toEqual([
      { key: '2026-05', label: 'May 26' },
      { key: '2026-06', label: 'Jun 26' },
      { key: '2026-07', label: 'Jul 26' },
    ])
  })
})

describe('toCSV', () => {
  it('builds header + rows and escapes specials', () => {
    const cols = [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total' }]
    const rows = [{ name: 'Acme, Inc', total: 100 }, { name: 'He said "hi"', total: 5 }]
    expect(toCSV(rows, cols)).toBe('Name,Total\n"Acme, Inc",100\n"He said ""hi""",5')
  })
  it('returns just the header when no rows', () => {
    expect(toCSV([], [{ key: 'a', label: 'A' }])).toBe('A')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/__tests__/reports.test.js`
Expected: FAIL — `Failed to resolve import "@/lib/reports"`.

- [ ] **Step 3: Implement the utilities**

Create `src/lib/reports.js`:

```js
import { invoiceTotals } from '@/lib/money'
import { hoursFromMinutes } from '@/lib/time'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function iso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export const DATE_PRESETS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
]

export function rangeForPreset(preset, today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) }
    }
    case 'ytd':
      return { from: iso(new Date(y, 0, 1)), to: iso(today) }
    case 'last_12_months':
      return { from: iso(new Date(y, m - 11, 1)), to: iso(new Date(y, m + 1, 0)) }
    case 'this_month':
    default:
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
  }
}

export function monthBuckets(from, to) {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const out = []
  let y = fy
  let mo = fm
  while (y < ty || (y === ty && mo <= tm)) {
    out.push({ key: `${y}-${String(mo).padStart(2, '0')}`, label: `${MONTH_ABBR[mo - 1]} ${String(y).slice(2)}` })
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
  }
  return out
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = (rows || []).map((r) => columns.map((c) => csvCell(r[c.key])).join(',')).join('\n')
  return body ? `${header}\n${body}` : header
}
```

Create `src/lib/download.js`:

```js
export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/reports.test.js`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports.js src/lib/download.js src/lib/__tests__/reports.test.js
git commit -m "feat(reports): date-range presets, month buckets, CSV + download helpers + tests"
```

---

## Task 2: Report aggregators (`src/lib/reports.js` part 2)

**Files:**
- Modify: `src/lib/reports.js` (append the four aggregators; `iso`/`round2` already exist from Task 1)
- Test: `src/lib/__tests__/reports.test.js` (append)

**Interfaces:**
- Consumes: `invoiceTotals` (`@/lib/money`, already imported in the file), `hoursFromMinutes` (`@/lib/time`, already imported), internal `round2`/`iso`.
- Produces:
  - `revenueReport(payments, range): { currencies: string[], months: [{key,label}], byCurrency: { [cur]: { monthTotals: {key:amount}, byClient: [{name,total}], byProject: [{name,total}], total } } }`.
  - `plReport(payments, expenses, range): { currencies, byCurrency: { [cur]: { months: [{key,label,revenue,expense,net}], totals: {revenue,expense,net} } } }`.
  - `agingReport(openInvoices, today): { currencies, byCurrency: { [cur]: { buckets: {current,d1_30,d31_60,d61_90,d90plus}, rows: [{invoice_number,client,due_date,days_overdue,amount,bucket}], total } } }`.
  - `timeReport(entries): { byProject: [{project,billableHours,nonBillableHours,totalHours,amount}], totals: {billableHours,nonBillableHours,totalHours,amount} }`.
- Input row shapes (from Task 3 fetches): payment `{amount,currency,paid_at, invoices:{client_id,project_id,clients:{name},projects:{name}}}`; expense `{amount,currency,spent_on}`; invoice `{invoice_number,currency,due_date,clients:{name},invoice_line_items:[...]}`; time entry `{duration_minutes,billable,hourly_rate,projects:{name}}`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/reports.test.js`:

```js
import { revenueReport, plReport, agingReport, timeReport } from '@/lib/reports'

const RANGE = { from: '2026-05-01', to: '2026-06-30' }

describe('revenueReport', () => {
  it('groups payments by month/client/project per currency', () => {
    const payments = [
      { amount: 100, currency: 'USD', paid_at: '2026-05-10T12:00:00Z', invoices: { clients: { name: 'Acme' }, projects: { name: 'Site' } } },
      { amount: 50, currency: 'USD', paid_at: '2026-06-02T09:00:00Z', invoices: { clients: { name: 'Acme' }, projects: null } },
      { amount: 40, currency: 'EUR', paid_at: '2026-06-03T09:00:00Z', invoices: { clients: { name: 'Globex' }, projects: { name: 'App' } } },
    ]
    const r = revenueReport(payments, RANGE)
    expect(r.currencies.sort()).toEqual(['EUR', 'USD'])
    expect(r.byCurrency.USD.total).toBe(150)
    expect(r.byCurrency.USD.monthTotals['2026-05']).toBe(100)
    expect(r.byCurrency.USD.monthTotals['2026-06']).toBe(50)
    expect(r.byCurrency.USD.byClient).toEqual([{ name: 'Acme', total: 150 }])
    expect(r.byCurrency.USD.byProject.find((p) => p.name === 'Unassigned').total).toBe(50)
  })
})

describe('plReport', () => {
  it('computes net = revenue - expense per month', () => {
    const payments = [{ amount: 200, currency: 'USD', paid_at: '2026-06-01T00:00:00Z' }]
    const expenses = [{ amount: 75, currency: 'USD', spent_on: '2026-06-15' }]
    const r = plReport(payments, expenses, RANGE)
    const jun = r.byCurrency.USD.months.find((m) => m.key === '2026-06')
    expect(jun).toMatchObject({ revenue: 200, expense: 75, net: 125 })
    expect(r.byCurrency.USD.totals).toEqual({ revenue: 200, expense: 75, net: 125 })
  })
})

describe('agingReport', () => {
  const today = new Date(2026, 5, 30) // 2026-06-30
  const li = (amt) => [{ quantity: 1, unit_price: amt, tax_rate: 0, discount_rate: 0 }]
  it('buckets invoices by days past due', () => {
    const invoices = [
      { invoice_number: 'A', currency: 'USD', due_date: '2026-07-05', clients: { name: 'X' }, invoice_line_items: li(10) }, // future → current
      { invoice_number: 'B', currency: 'USD', due_date: '2026-06-30', clients: { name: 'X' }, invoice_line_items: li(20) }, // due today → current
      { invoice_number: 'C', currency: 'USD', due_date: '2026-06-15', clients: { name: 'X' }, invoice_line_items: li(30) }, // 15 → d1_30
      { invoice_number: 'D', currency: 'USD', due_date: '2026-03-01', clients: { name: 'X' }, invoice_line_items: li(40) }, // >90 → d90plus
    ]
    const r = agingReport(invoices, today)
    expect(r.byCurrency.USD.buckets.current).toBe(30)
    expect(r.byCurrency.USD.buckets.d1_30).toBe(30)
    expect(r.byCurrency.USD.buckets.d90plus).toBe(40)
    expect(r.byCurrency.USD.total).toBe(100)
  })
})

describe('timeReport', () => {
  it('splits billable vs non-billable and computes amount', () => {
    const entries = [
      { duration_minutes: 90, billable: true, hourly_rate: 100, projects: { name: 'Site' } },
      { duration_minutes: 30, billable: false, hourly_rate: 0, projects: { name: 'Site' } },
      { duration_minutes: 60, billable: true, hourly_rate: 50, projects: { name: 'App' } },
    ]
    const r = timeReport(entries)
    const site = r.byProject.find((p) => p.project === 'Site')
    expect(site).toMatchObject({ billableHours: 1.5, nonBillableHours: 0.5, totalHours: 2, amount: 150 })
    expect(r.totals.amount).toBe(200)
    expect(r.totals.billableHours).toBe(2.5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/__tests__/reports.test.js`
Expected: FAIL — `revenueReport is not a function` (and the other three).

- [ ] **Step 3: Implement the aggregators**

Append to `src/lib/reports.js`:

```js
function daysBetween(fromStr, toStr) {
  const a = new Date(`${fromStr}T00:00:00Z`).getTime()
  const b = new Date(`${toStr}T00:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000)
}

function toSortedArray(map) {
  return Object.entries(map)
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((x, y) => y.total - x.total)
}

export function revenueReport(payments, range) {
  const months = monthBuckets(range.from, range.to)
  const acc = {}
  const ensure = (cur) => (acc[cur] ||= { monthTotals: {}, byClient: {}, byProject: {}, total: 0 })
  for (const p of payments || []) {
    const cur = p.currency || 'USD'
    const amt = Number(p.amount) || 0
    const b = ensure(cur)
    const key = (p.paid_at || '').slice(0, 7)
    b.monthTotals[key] = (b.monthTotals[key] || 0) + amt
    const client = p.invoices?.clients?.name || 'Unassigned'
    const project = p.invoices?.projects?.name || 'Unassigned'
    b.byClient[client] = (b.byClient[client] || 0) + amt
    b.byProject[project] = (b.byProject[project] || 0) + amt
    b.total += amt
  }
  const byCurrency = {}
  for (const [cur, b] of Object.entries(acc)) {
    byCurrency[cur] = {
      monthTotals: Object.fromEntries(Object.entries(b.monthTotals).map(([k, v]) => [k, round2(v)])),
      byClient: toSortedArray(b.byClient),
      byProject: toSortedArray(b.byProject),
      total: round2(b.total),
    }
  }
  return { currencies: Object.keys(byCurrency), months, byCurrency }
}

export function plReport(payments, expenses, range) {
  const months = monthBuckets(range.from, range.to)
  const acc = {}
  const ensure = (cur) => (acc[cur] ||= { rev: {}, exp: {} })
  for (const p of payments || []) {
    const b = ensure(p.currency || 'USD')
    const key = (p.paid_at || '').slice(0, 7)
    b.rev[key] = (b.rev[key] || 0) + (Number(p.amount) || 0)
  }
  for (const e of expenses || []) {
    const b = ensure(e.currency || 'USD')
    const key = (e.spent_on || '').slice(0, 7)
    b.exp[key] = (b.exp[key] || 0) + (Number(e.amount) || 0)
  }
  const byCurrency = {}
  for (const [cur, b] of Object.entries(acc)) {
    let tr = 0
    let te = 0
    const rows = months.map((m) => {
      const revenue = round2(b.rev[m.key] || 0)
      const expense = round2(b.exp[m.key] || 0)
      tr += revenue
      te += expense
      return { key: m.key, label: m.label, revenue, expense, net: round2(revenue - expense) }
    })
    byCurrency[cur] = { months: rows, totals: { revenue: round2(tr), expense: round2(te), net: round2(tr - te) } }
  }
  return { currencies: Object.keys(byCurrency), byCurrency }
}

export function agingReport(openInvoices, today) {
  const todayStr = iso(today)
  const acc = {}
  const ensure = (cur) => (acc[cur] ||= { buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }, rows: [], total: 0 })
  for (const inv of openInvoices || []) {
    const b = ensure(inv.currency || 'USD')
    const amount = round2(invoiceTotals(inv.invoice_line_items || []).total)
    const days = daysBetween(inv.due_date, todayStr)
    let bucket
    if (days <= 0) bucket = 'current'
    else if (days <= 30) bucket = 'd1_30'
    else if (days <= 60) bucket = 'd31_60'
    else if (days <= 90) bucket = 'd61_90'
    else bucket = 'd90plus'
    b.buckets[bucket] += amount
    b.total += amount
    b.rows.push({ invoice_number: inv.invoice_number, client: inv.clients?.name || 'Unassigned', due_date: inv.due_date, days_overdue: Math.max(0, days), amount, bucket })
  }
  const byCurrency = {}
  for (const [cur, b] of Object.entries(acc)) {
    byCurrency[cur] = {
      buckets: Object.fromEntries(Object.entries(b.buckets).map(([k, v]) => [k, round2(v)])),
      rows: b.rows.sort((x, y) => y.days_overdue - x.days_overdue),
      total: round2(b.total),
    }
  }
  return { currencies: Object.keys(byCurrency), byCurrency }
}

export function timeReport(entries) {
  const acc = {}
  const ensure = (name) => (acc[name] ||= { project: name, billableMin: 0, nonBillableMin: 0, amount: 0 })
  for (const e of entries || []) {
    const g = ensure(e.projects?.name || 'Unassigned')
    const mins = Number(e.duration_minutes) || 0
    if (e.billable) {
      g.billableMin += mins
      g.amount += (mins / 60) * (Number(e.hourly_rate) || 0)
    } else {
      g.nonBillableMin += mins
    }
  }
  let tb = 0
  let tn = 0
  let ta = 0
  const byProject = Object.values(acc)
    .map((g) => {
      const billableHours = hoursFromMinutes(g.billableMin)
      const nonBillableHours = hoursFromMinutes(g.nonBillableMin)
      tb += billableHours
      tn += nonBillableHours
      ta += g.amount
      return { project: g.project, billableHours, nonBillableHours, totalHours: round2(billableHours + nonBillableHours), amount: round2(g.amount) }
    })
    .sort((x, y) => y.totalHours - x.totalHours)
  return { byProject, totals: { billableHours: round2(tb), nonBillableHours: round2(tn), totalHours: round2(tb + tn), amount: round2(ta) } }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/reports.test.js`
Expected: PASS (all aggregator cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports.js src/lib/__tests__/reports.test.js
git commit -m "feat(reports): revenue/p&l/aging/time aggregators + tests"
```

---

## Task 3: Fetch layer (`src/api/reports.js`)

**Files:**
- Create: `src/api/reports.js`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`), `mapPostgresError` (`@/lib/errors`).
- Produces:
  - `fetchPayments({ from, to }): Promise<row[]>`
  - `fetchExpensesInRange({ from, to }): Promise<row[]>`
  - `fetchOpenInvoices(): Promise<row[]>`
  - `fetchTimeEntriesInRange({ from, to }): Promise<row[]>`
- Date rule (Global Constraints): timestamptz cols use half-open `[from, toExclusive)` where `toExclusive = to + 1 day`; date cols inclusive.

- [ ] **Step 1: Implement the fetch module**

Create `src/api/reports.js`:

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function fetchPayments({ from, to }) {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('amount, currency, paid_at, invoices(client_id, project_id, clients(name), projects(name))')
    .gte('paid_at', `${from}T00:00:00Z`)
    .lt('paid_at', `${nextDay(to)}T00:00:00Z`)
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function fetchExpensesInRange({ from, to }) {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, currency, spent_on')
    .gte('spent_on', from)
    .lte('spent_on', to)
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function fetchOpenInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, currency, due_date, status, clients(name), invoice_line_items(quantity, unit_price, tax_rate, discount_rate)')
    .in('status', ['sent', 'viewed', 'overdue'])
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function fetchTimeEntriesInRange({ from, to }) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('duration_minutes, billable, hourly_rate, project_id, projects(name)')
    .not('ended_at', 'is', null)
    .gte('started_at', `${from}T00:00:00Z`)
    .lt('started_at', `${nextDay(to)}T00:00:00Z`)
  if (error) throw mapPostgresError(error)
  return data || []
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/api/reports.js`
Expected: no errors. (API modules have no unit tests by codebase precedent — verified live in Task 10.)

- [ ] **Step 3: Commit**

```bash
git add src/api/reports.js
git commit -m "feat(reports): range-scoped fetches for payments/expenses/invoices/time"
```

---

## Task 4: Query hooks (`src/hooks/useReports.js`)

**Files:**
- Create: `src/hooks/useReports.js`

**Interfaces:**
- Consumes: `* as api` from `@/api/reports`; `@tanstack/react-query`.
- Produces: `usePaymentsReport(range)`, `useExpensesInRange(range)`, `useOpenInvoices()`, `useTimeEntriesInRange(range)`. Each keyed by `['reports', <name>, range]` (or no range for open invoices).

- [ ] **Step 1: Implement the hooks**

Create `src/hooks/useReports.js`:

```js
import { useQuery } from '@tanstack/react-query'
import * as api from '@/api/reports'

export function usePaymentsReport(range) {
  return useQuery({ queryKey: ['reports', 'payments', range], queryFn: () => api.fetchPayments(range), enabled: !!range?.from && !!range?.to })
}
export function useExpensesInRange(range) {
  return useQuery({ queryKey: ['reports', 'expenses', range], queryFn: () => api.fetchExpensesInRange(range), enabled: !!range?.from && !!range?.to })
}
export function useOpenInvoices() {
  return useQuery({ queryKey: ['reports', 'open-invoices'], queryFn: api.fetchOpenInvoices })
}
export function useTimeEntriesInRange(range) {
  return useQuery({ queryKey: ['reports', 'time', range], queryFn: () => api.fetchTimeEntriesInRange(range), enabled: !!range?.from && !!range?.to })
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/hooks/useReports.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useReports.js
git commit -m "feat(reports): query hooks for report data"
```

---

## Task 5: Date-range control (`src/features/reports/DateRangeControl.jsx`)

**Files:**
- Create: `src/features/reports/DateRangeControl.jsx`

**Interfaces:**
- Consumes: `Select`, `Input`, `Label` (`@/components/ui/*`); `DATE_PRESETS`, `rangeForPreset` (`@/lib/reports`).
- Produces: `export function DateRangeControl({ value, onChange })` where `value = { preset, from, to }` and `onChange(next)` is called with the same shape. On preset change (≠ custom) it derives `from`/`to` via `rangeForPreset(preset, new Date())`. On custom, two date inputs drive `from`/`to`; if `from > to` it shows an inline note and does not emit the invalid range.

- [ ] **Step 1: Implement the control**

Create `src/features/reports/DateRangeControl.jsx`:

```jsx
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { DATE_PRESETS, rangeForPreset } from '@/lib/reports'

export function DateRangeControl({ value, onChange }) {
  const isCustom = value.preset === 'custom'
  const invalid = isCustom && value.from && value.to && value.from > value.to

  const onPreset = (preset) => {
    if (preset === 'custom') {
      onChange({ ...value, preset })
      return
    }
    onChange({ preset, ...rangeForPreset(preset, new Date()) })
  }

  const onCustom = (field, v) => {
    const next = { ...value, preset: 'custom', [field]: v }
    if (next.from && next.to && next.from > next.to) {
      onChange(next) // keep inputs in sync; `invalid` blocks consumers via the parent's guard
      return
    }
    onChange(next)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="report-preset">Period</Label>
        <Select id="report-preset" value={value.preset} onChange={(e) => onPreset(e.target.value)} className="w-44">
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>
      {isCustom ? (
        <>
          <div>
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={value.from || ''} onChange={(e) => onCustom('from', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" value={value.to || ''} onChange={(e) => onCustom('to', e.target.value)} />
          </div>
        </>
      ) : null}
      {invalid ? <p className="pb-2 text-xs text-danger">From date must be on or before To date.</p> : null}
    </div>
  )
}
```

Note: the parent `ReportsPage` only passes the range to the tabs when it is valid (`from <= to`); this control surfaces the inline note, and the page guards the queries (Task 9).

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/features/reports/DateRangeControl.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/DateRangeControl.jsx
git commit -m "feat(reports): shared date-range control (presets + custom)"
```

---

## Task 6: Currency picker + chart wrapper (`CurrencyTabs.jsx`, `ReportChart.jsx`)

**Files:**
- Create: `src/features/reports/CurrencyTabs.jsx`
- Create: `src/features/reports/ReportChart.jsx`

**Interfaces:**
- `CurrencyTabs`: `export function CurrencyTabs({ currencies, value, onChange })` — renders nothing when `currencies.length <= 1`; otherwise a row of pill buttons (pattern from `DashboardInsights`).
- `ReportChart` (default export): `export default function ReportChart({ data, bars, height, formatValue })` — `data` is an array of `{label, ...}`; `bars = [{ dataKey, name, color }]`; `formatValue(value, name) => string` for the tooltip; shows a `Legend` when `bars.length > 1`. Themed with CSS vars exactly like `RevenueChart.jsx`.

- [ ] **Step 1: Implement CurrencyTabs**

Create `src/features/reports/CurrencyTabs.jsx`:

```jsx
import { cn } from '@/components/ui/cn'

export function CurrencyTabs({ currencies, value, onChange }) {
  if (!currencies || currencies.length <= 1) return null
  return (
    <div className="flex gap-1">
      {currencies.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium tabular-nums transition-colors',
            c === value ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-bg-muted'
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement ReportChart**

Create `src/features/reports/ReportChart.jsx`:

```jsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'

function compactTick(value) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(value)
}

export default function ReportChart({ data, bars, height = 256, formatValue }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
        <YAxis tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={compactTick} />
        <Tooltip
          cursor={{ fill: 'var(--color-bg-muted)' }}
          contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--color-fg-muted)' }}
          itemStyle={{ color: 'var(--color-fg)' }}
          formatter={formatValue ? (value, name) => [formatValue(Number(value), name), name] : undefined}
        />
        {bars.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {bars.map((b) => (
          <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Verify it lints**

Run: `npm run lint -- src/features/reports/CurrencyTabs.jsx src/features/reports/ReportChart.jsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/CurrencyTabs.jsx src/features/reports/ReportChart.jsx
git commit -m "feat(reports): currency picker + themed chart wrapper"
```

---

## Task 7: Revenue + P&L tabs (`RevenueReport.jsx`, `PnLReport.jsx`)

**Files:**
- Create: `src/features/reports/RevenueReport.jsx`
- Create: `src/features/reports/PnLReport.jsx`

**Interfaces:**
- Consumes: `usePaymentsReport`, `useExpensesInRange` (`@/hooks/useReports`); `revenueReport`, `plReport`, `toCSV` (`@/lib/reports`); `downloadTextFile` (`@/lib/download`); `formatCurrency` (`@/lib/currency`); `useProfile`; `Card`, `Skeleton`, `EmptyState`, `Button`, `Table/THead/TR/TH/TD`; `CurrencyTabs`; lazy `ReportChart`; icons.
- Produces: `export function RevenueReport({ range })`, `export function PnLReport({ range })`.
- Currency selection (matches dashboard): `fallback = currencies.includes(profile?.default_currency) ? profile.default_currency : currencies[0]`; `currency = picked && currencies.includes(picked) ? picked : fallback`.

- [ ] **Step 1: Implement RevenueReport**

Create `src/features/reports/RevenueReport.jsx`:

```jsx
import { lazy, Suspense, useState } from 'react'
import { Download, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { CurrencyTabs } from './CurrencyTabs'
import { usePaymentsReport } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { revenueReport, toCSV } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'

const ReportChart = lazy(() => import('./ReportChart'))

export function RevenueReport({ range }) {
  const { data: payments = [], isLoading } = usePaymentsReport(range)
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (isLoading) return <Skeleton className="h-72" />

  const report = revenueReport(payments, range)
  if (report.currencies.length === 0) {
    return <EmptyState icon={TrendingUp} title="No revenue in this range" description="Payments you receive will show up here." />
  }

  const fallback = report.currencies.includes(profile?.default_currency) ? profile.default_currency : report.currencies[0]
  const currency = picked && report.currencies.includes(picked) ? picked : fallback
  const bucket = report.byCurrency[currency]
  const chartData = report.months.map((m) => ({ label: m.label, revenue: bucket.monthTotals[m.key] || 0 }))

  const exportCsv = () => {
    const rows = report.months.map((m) => ({ month: m.label, revenue: bucket.monthTotals[m.key] || 0 }))
    downloadTextFile(`revenue-${currency}.csv`, toCSV(rows, [{ key: 'month', label: 'Month' }, { key: 'revenue', label: `Revenue (${currency})` }]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <CurrencyTabs currencies={report.currencies} value={currency} onChange={setPicked} />
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Revenue by month · {currency}</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart data={chartData} bars={[{ dataKey: 'revenue', name: 'Revenue', color: 'var(--color-primary)' }]} formatValue={(v) => formatCurrency(v, currency)} />
        </Suspense>
      </Card>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">By client</h3>
          <BreakdownTable rows={bucket.byClient} total={bucket.total} currency={currency} />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">By project</h3>
          <BreakdownTable rows={bucket.byProject} total={bucket.total} currency={currency} />
        </Card>
      </div>
    </div>
  )
}

function BreakdownTable({ rows, total, currency }) {
  return (
    <Table>
      <THead>
        <TR><TH>Name</TH><TH>Total</TH><TH>%</TH></TR>
      </THead>
      <tbody>
        {rows.map((r) => (
          <TR key={r.name}>
            <TD>{r.name}</TD>
            <TD className="tabular-nums">{formatCurrency(r.total, currency)}</TD>
            <TD className="tabular-nums text-fg-muted">{total ? Math.round((r.total / total) * 100) : 0}%</TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
```

- [ ] **Step 2: Implement PnLReport**

Create `src/features/reports/PnLReport.jsx`:

```jsx
import { lazy, Suspense, useState } from 'react'
import { Download, Scale } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { cn } from '@/components/ui/cn'
import { CurrencyTabs } from './CurrencyTabs'
import { usePaymentsReport, useExpensesInRange } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { plReport, toCSV } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'

const ReportChart = lazy(() => import('./ReportChart'))

export function PnLReport({ range }) {
  const { data: payments = [], isLoading: lp } = usePaymentsReport(range)
  const { data: expenses = [], isLoading: le } = useExpensesInRange(range)
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (lp || le) return <Skeleton className="h-72" />

  const report = plReport(payments, expenses, range)
  if (report.currencies.length === 0) {
    return <EmptyState icon={Scale} title="No data in this range" description="Payments and expenses will show up here." />
  }

  const fallback = report.currencies.includes(profile?.default_currency) ? profile.default_currency : report.currencies[0]
  const currency = picked && report.currencies.includes(picked) ? picked : fallback
  const bucket = report.byCurrency[currency]
  const chartData = bucket.months.map((m) => ({ label: m.label, revenue: m.revenue, expense: m.expense }))

  const exportCsv = () => {
    const rows = bucket.months.map((m) => ({ month: m.label, revenue: m.revenue, expense: m.expense, net: m.net }))
    downloadTextFile(`pnl-${currency}.csv`, toCSV(rows, [
      { key: 'month', label: 'Month' },
      { key: 'revenue', label: `Revenue (${currency})` },
      { key: 'expense', label: `Expense (${currency})` },
      { key: 'net', label: `Net (${currency})` },
    ]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <CurrencyTabs currencies={report.currencies} value={currency} onChange={setPicked} />
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Revenue vs expense · {currency}</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart
            data={chartData}
            bars={[
              { dataKey: 'revenue', name: 'Revenue', color: 'var(--color-primary)' },
              { dataKey: 'expense', name: 'Expense', color: 'var(--color-danger)' },
            ]}
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </Suspense>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR><TH>Month</TH><TH>Revenue</TH><TH>Expense</TH><TH>Net</TH></TR>
          </THead>
          <tbody>
            {bucket.months.map((m) => (
              <TR key={m.key}>
                <TD>{m.label}</TD>
                <TD className="tabular-nums">{formatCurrency(m.revenue, currency)}</TD>
                <TD className="tabular-nums">{formatCurrency(m.expense, currency)}</TD>
                <TD className={cn('tabular-nums font-medium', m.net >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(m.net, currency)}</TD>
              </TR>
            ))}
            <TR>
              <TD className="font-semibold">Total</TD>
              <TD className="tabular-nums font-semibold">{formatCurrency(bucket.totals.revenue, currency)}</TD>
              <TD className="tabular-nums font-semibold">{formatCurrency(bucket.totals.expense, currency)}</TD>
              <TD className={cn('tabular-nums font-semibold', bucket.totals.net >= 0 ? 'text-success' : 'text-danger')}>{formatCurrency(bucket.totals.net, currency)}</TD>
            </TR>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify it lints**

Run: `npm run lint -- src/features/reports/RevenueReport.jsx src/features/reports/PnLReport.jsx`
Expected: no errors. (If `text-success` is not a defined utility in this theme, use the same class the codebase uses for positive amounts — check an existing component like `StatsRow.jsx`; `text-danger` is confirmed in use. Adjust both files consistently.)

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/RevenueReport.jsx src/features/reports/PnLReport.jsx
git commit -m "feat(reports): Revenue and P&L tabs"
```

---

## Task 8: Aging + Time tabs (`AgingReport.jsx`, `TimeReport.jsx`)

**Files:**
- Create: `src/features/reports/AgingReport.jsx`
- Create: `src/features/reports/TimeReport.jsx`

**Interfaces:**
- Consumes: `useOpenInvoices`, `useTimeEntriesInRange` (`@/hooks/useReports`); `agingReport`, `timeReport`, `toCSV` (`@/lib/reports`); `downloadTextFile`; `formatCurrency`, `formatDate`; `useProfile`; `Card`, `Skeleton`, `EmptyState`, `Button`, `Table/...`; `CurrencyTabs`; lazy `ReportChart`; icons.
- Produces: `export function AgingReport()` (no range — as-of-today), `export function TimeReport({ range })`.
- Aging bucket labels: `current`→"Current", `d1_30`→"1–30", `d31_60`→"31–60", `d61_90`→"61–90", `d90plus`→"90+".

- [ ] **Step 1: Implement AgingReport**

Create `src/features/reports/AgingReport.jsx`:

```jsx
import { lazy, Suspense, useState } from 'react'
import { Download, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { CurrencyTabs } from './CurrencyTabs'
import { useOpenInvoices } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { agingReport, toCSV } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

const ReportChart = lazy(() => import('./ReportChart'))

const BUCKETS = [
  { key: 'current', label: 'Current' },
  { key: 'd1_30', label: '1–30' },
  { key: 'd31_60', label: '31–60' },
  { key: 'd61_90', label: '61–90' },
  { key: 'd90plus', label: '90+' },
]

export function AgingReport() {
  const { data: invoices = [], isLoading } = useOpenInvoices()
  const { data: profile } = useProfile()
  const [picked, setPicked] = useState(null)

  if (isLoading) return <Skeleton className="h-72" />

  const report = agingReport(invoices, new Date())
  if (report.currencies.length === 0) {
    return <EmptyState icon={Clock} title="No open invoices" description="Unpaid sent invoices will be aged here." />
  }

  const fallback = report.currencies.includes(profile?.default_currency) ? profile.default_currency : report.currencies[0]
  const currency = picked && report.currencies.includes(picked) ? picked : fallback
  const bucket = report.byCurrency[currency]
  const chartData = BUCKETS.map((b) => ({ label: b.label, amount: bucket.buckets[b.key] || 0 }))

  const exportCsv = () => {
    downloadTextFile(`aging-${currency}.csv`, toCSV(bucket.rows, [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'client', label: 'Client' },
      { key: 'due_date', label: 'Due date' },
      { key: 'days_overdue', label: 'Days overdue' },
      { key: 'amount', label: `Amount (${currency})` },
      { key: 'bucket', label: 'Bucket' },
    ]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <CurrencyTabs currencies={report.currencies} value={currency} onChange={setPicked} />
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Outstanding by age · {currency}</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart data={chartData} bars={[{ dataKey: 'amount', name: 'Outstanding', color: 'var(--color-primary)' }]} formatValue={(v) => formatCurrency(v, currency)} />
        </Suspense>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR><TH>Invoice</TH><TH>Client</TH><TH>Due</TH><TH>Days</TH><TH>Amount</TH></TR>
          </THead>
          <tbody>
            {bucket.rows.map((r) => (
              <TR key={r.invoice_number}>
                <TD>{r.invoice_number}</TD>
                <TD className="text-fg-muted">{r.client}</TD>
                <TD className="text-xs tabular-nums text-fg-muted">{formatDate(r.due_date)}</TD>
                <TD className="tabular-nums">{r.days_overdue}</TD>
                <TD className="tabular-nums">{formatCurrency(r.amount, currency)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Implement TimeReport**

Create `src/features/reports/TimeReport.jsx`:

```jsx
import { lazy, Suspense } from 'react'
import { Download, Timer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { useTimeEntriesInRange } from '@/hooks/useReports'
import { useProfile } from '@/hooks/useProfile'
import { timeReport, toCSV } from '@/lib/reports'
import { downloadTextFile } from '@/lib/download'
import { formatCurrency } from '@/lib/currency'

const ReportChart = lazy(() => import('./ReportChart'))

export function TimeReport({ range }) {
  const { data: entries = [], isLoading } = useTimeEntriesInRange(range)
  const { data: profile } = useProfile()
  const currency = profile?.default_currency || 'USD'

  if (isLoading) return <Skeleton className="h-72" />

  const report = timeReport(entries)
  if (report.byProject.length === 0) {
    return <EmptyState icon={Timer} title="No time in this range" description="Completed time entries will show up here." />
  }

  const chartData = report.byProject.map((p) => ({ label: p.project, billableHours: p.billableHours, nonBillableHours: p.nonBillableHours }))

  const exportCsv = () => {
    downloadTextFile('time.csv', toCSV(report.byProject, [
      { key: 'project', label: 'Project' },
      { key: 'billableHours', label: 'Billable hours' },
      { key: 'nonBillableHours', label: 'Non-billable hours' },
      { key: 'totalHours', label: 'Total hours' },
      { key: 'amount', label: `Billable amount (${currency})` },
    ]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download className="size-4" /> CSV</Button>
      </div>
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Hours by project</h3>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ReportChart
            data={chartData}
            bars={[
              { dataKey: 'billableHours', name: 'Billable', color: 'var(--color-primary)' },
              { dataKey: 'nonBillableHours', name: 'Non-billable', color: 'var(--color-fg-subtle)' },
            ]}
            formatValue={(v, name) => `${v}h ${name}`}
          />
        </Suspense>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR><TH>Project</TH><TH>Billable</TH><TH>Non-billable</TH><TH>Total</TH><TH>Amount</TH></TR>
          </THead>
          <tbody>
            {report.byProject.map((p) => (
              <TR key={p.project}>
                <TD>{p.project}</TD>
                <TD className="tabular-nums">{p.billableHours}h</TD>
                <TD className="tabular-nums text-fg-muted">{p.nonBillableHours}h</TD>
                <TD className="tabular-nums">{p.totalHours}h</TD>
                <TD className="tabular-nums">{formatCurrency(p.amount, currency)}</TD>
              </TR>
            ))}
            <TR>
              <TD className="font-semibold">Total</TD>
              <TD className="tabular-nums font-semibold">{report.totals.billableHours}h</TD>
              <TD className="tabular-nums font-semibold text-fg-muted">{report.totals.nonBillableHours}h</TD>
              <TD className="tabular-nums font-semibold">{report.totals.totalHours}h</TD>
              <TD className="tabular-nums font-semibold">{formatCurrency(report.totals.amount, currency)}</TD>
            </TR>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify it lints**

Run: `npm run lint -- src/features/reports/AgingReport.jsx src/features/reports/TimeReport.jsx`
Expected: no errors. (If `text-fg-subtle` / `var(--color-fg-subtle)` aren't defined, substitute the muted token already used elsewhere — confirm against an existing component.)

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/AgingReport.jsx src/features/reports/TimeReport.jsx
git commit -m "feat(reports): Aging and Time tabs"
```

---

## Task 9: Page + route (`ReportsPage.jsx`, `routes.jsx`)

**Files:**
- Create: `src/pages/ReportsPage.jsx`
- Modify: `src/app/routes.jsx` (import + child route)

**Interfaces:**
- Consumes: `PageHeader`, `cn`; `UpgradeCard`; `useProfile`; `hasFeature, FEATURES` (`@/lib/tier`); `rangeForPreset` (`@/lib/reports`); `DateRangeControl`, and the four tab components.
- Default export `ReportsPage`.
- Tabs: Revenue / P&L / Aging / Time. The shared `DateRangeControl` is shown for all tabs except Aging (Aging is as-of-today). Range state initialized to `this_month`.

- [ ] **Step 1: Implement the page**

Create `src/pages/ReportsPage.jsx`:

```jsx
import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/components/ui/cn'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { rangeForPreset } from '@/lib/reports'
import { DateRangeControl } from '@/features/reports/DateRangeControl'
import { RevenueReport } from '@/features/reports/RevenueReport'
import { PnLReport } from '@/features/reports/PnLReport'
import { AgingReport } from '@/features/reports/AgingReport'
import { TimeReport } from '@/features/reports/TimeReport'

const TABS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'pnl', label: 'P&L' },
  { key: 'aging', label: 'Aging' },
  { key: 'time', label: 'Time' },
]

export default function ReportsPage() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [tab, setTab] = useState('revenue')
  const [range, setRange] = useState(() => ({ preset: 'this_month', ...rangeForPreset('this_month', new Date()) }))

  if (!hasFeature(tier, FEATURES.REPORTS)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Reports" />
        <UpgradeCard feature={FEATURES.REPORTS} currentTier={tier} target="tier_2" />
      </div>
    )
  }

  const rangeValid = !!range.from && !!range.to && range.from <= range.to
  const showRange = tab !== 'aging'

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Revenue, P&L, aging, and time" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                tab === t.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg-muted hover:bg-bg-muted hover:text-fg'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {showRange ? <DateRangeControl value={range} onChange={setRange} /> : null}
      </div>

      {tab === 'revenue' && (rangeValid ? <RevenueReport range={range} /> : null)}
      {tab === 'pnl' && (rangeValid ? <PnLReport range={range} /> : null)}
      {tab === 'aging' && <AgingReport />}
      {tab === 'time' && (rangeValid ? <TimeReport range={range} /> : null)}
    </div>
  )
}
```

- [ ] **Step 2: Register the route**

In `src/app/routes.jsx`, add the import after the `ExpensesPage` import (near line 17):

```jsx
import ReportsPage from '@/pages/ReportsPage'
```

And add this child route after the `{ path: 'expenses', element: <ExpensesPage /> },` line:

```jsx
      { path: 'reports', element: <ReportsPage /> },
```

- [ ] **Step 3: Verify build + tests + lint**

Run: `npm run lint` then `npm run test` then `npm run build`
Expected: lint clean; all unit tests pass (incl. the new `reports.test.js`); production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ReportsPage.jsx src/app/routes.jsx
git commit -m "feat(reports): /reports page with tabs + route"
```

---

## Task 10: Live verification + cleanup

**Files:** none (manual verification against the hosted dev project via Supabase MCP + UI).

**Pre-req:** tier-2 test user (uid resolvable via MCP). Use `ZZ-` markers. MCP runs as service role (bypasses RLS) — seed with explicit `user_id`.

- [ ] **Step 1: Find the test user + a client + a project**

```sql
select p.id as user_id, p.default_currency,
  (select id from clients where user_id = p.id order by created_at limit 1) as client_id,
  (select id from projects where user_id = p.id order by created_at limit 1) as project_id
from profiles p where p.subscription_tier = 'tier_2' order by p.created_at limit 1;
```

- [ ] **Step 2: Seed in-range data (use the current month)**

Seed a paid invoice + payment, an expense, a completed time entry, and an overdue invoice. Replace `<user_id>/<client_id>/<project_id>`:
```sql
-- a sent+paid invoice with a payment this month
with inv as (
  insert into invoices (user_id, client_id, invoice_number, status, currency, issue_date, due_date)
  values ('<user_id>', '<client_id>', 'ZZ-REP-1', 'paid', 'USD', current_date, current_date + 30)
  returning id
)
insert into invoice_payments (user_id, invoice_id, amount, currency, paid_at, method)
select '<user_id>', id, 300, 'USD', now(), 'manual' from inv;

-- an expense this month
insert into expenses (user_id, client_id, spent_on, amount, currency, category, description, billable)
values ('<user_id>', '<client_id>', current_date, 120, 'USD', 'Software', 'ZZ-rep-exp', false);

-- a completed billable time entry this month
insert into time_entries (user_id, project_id, started_at, ended_at, duration_minutes, description, billable, hourly_rate)
values ('<user_id>', '<project_id>', now() - interval '2 hours', now(), 120, 'ZZ-rep-time', true, 100);

-- an overdue open invoice (45 days past due) with a line item
with inv as (
  insert into invoices (user_id, client_id, invoice_number, status, currency, issue_date, due_date)
  values ('<user_id>', '<client_id>', 'ZZ-REP-AGE', 'overdue', 'USD', current_date - 75, current_date - 45)
  returning id
)
insert into invoice_line_items (user_id, invoice_id, position, description, quantity, unit_price, tax_rate, discount_rate)
select '<user_id>', id, 0, 'ZZ-aging-line', 1, 500, 0, 0 from inv;
```

- [ ] **Step 3: Verify aggregates via SQL (sanity, mirrors the helpers)**

```sql
select
  (select coalesce(sum(amount),0) from invoice_payments where user_id='<user_id>' and paid_at >= date_trunc('month', current_date)) as month_revenue,    -- expect >= 300
  (select coalesce(sum(amount),0) from expenses where user_id='<user_id>' and spent_on >= date_trunc('month', current_date)) as month_expense,           -- expect >= 120
  (select coalesce(sum(duration_minutes),0) from time_entries where user_id='<user_id>' and billable and ended_at is not null and started_at >= date_trunc('month', current_date)) as month_billable_min, -- expect >= 120
  (select count(*) from invoices where user_id='<user_id>' and status in ('sent','viewed','overdue') and invoice_number='ZZ-REP-AGE') as aging_open;       -- expect 1
```

- [ ] **Step 4: UI verification (as the tier-2 user in the running app)**

Open `/reports`:
- **Revenue** (period = This month): the bar chart shows this month's revenue (≥ 300), by-client/by-project tables populated; click **CSV** → a `revenue-USD.csv` downloads.
- **P&L**: this month shows revenue 300, expense 120, net 180 (green); CSV downloads.
- **Aging**: `ZZ-REP-AGE` (500) appears in the **31–60** bucket with ~45 days overdue; CSV downloads. (No date-range control shown on this tab.)
- **Time**: the project with `ZZ-rep-time` shows 2.0 billable hours and a $200 amount; CSV downloads.
- Switch the period to **Last month** → the seeded current-month rows drop out (Revenue/P&L/Time show empty or reduced), confirming range filtering. Aging is unaffected (as-of-today).

- [ ] **Step 5: Clean up all seeded data**

```sql
delete from invoice_payments where user_id='<user_id>' and invoice_id in (select id from invoices where invoice_number like 'ZZ-REP%');
delete from invoice_line_items where user_id='<user_id>' and invoice_id in (select id from invoices where invoice_number like 'ZZ-REP%');
delete from invoices where user_id='<user_id>' and invoice_number like 'ZZ-REP%';
delete from expenses where user_id='<user_id>' and description = 'ZZ-rep-exp';
delete from time_entries where user_id='<user_id>' and description = 'ZZ-rep-time';
select
  (select count(*) from invoices where user_id='<user_id>' and invoice_number like 'ZZ-REP%') as inv_left,
  (select count(*) from expenses where user_id='<user_id>' and description='ZZ-rep-exp') as exp_left,
  (select count(*) from time_entries where user_id='<user_id>' and description='ZZ-rep-time') as time_left;
```
Expected: all zero. (Invoice numbers consumed during testing are not reclaimed — same as prior sub-projects.)

- [ ] **Step 6: Final regression**

Run: `npm run test`
Expected: full unit suite green (prior 55 + the new `reports.test.js` cases).

---

## Self-Review

**Spec coverage** (spec §-by-§):
- §2 four tabs + tier gate + sidebar (exists) → Tasks 7, 8, 9. ✓
- §2 shared date-range presets; Aging ignores range → Task 5 (control) + Task 9 (page hides it on Aging; AgingReport takes no range). ✓
- §2 per-currency + picker (no FX) → Task 6 `CurrencyTabs` + per-tab selection in Tasks 7/8. ✓
- §2 CSV per tab → `toCSV` (Task 1) + `downloadTextFile` (Task 1) + buttons in Tasks 7/8. ✓
- §2 no new DB; client-side rollups → Tasks 1–4. ✓
- §3 cash-basis revenue; P&L = payments − expenses → `revenueReport`/`plReport` (Task 2), fetches (Task 3). ✓
- §4 architecture (helpers + fetch layer + hooks; date half-open vs inclusive) → Tasks 1–4. ✓
- §4.3 helper shapes → Tasks 1–2 (exact return shapes in Interfaces). ✓
- §5 rendering per tab incl. net coloring, aging buckets, time amount → Tasks 7, 8. ✓
- §5.5 multi-currency default selection → Tasks 7/8 (dashboard pattern). ✓
- §6 components/routing incl. download helper, lazy charts, route → Tasks 1, 6, 9. ✓
- §7 error handling (Skeleton/EmptyState; from>to guard) → Tasks 5, 7, 8, 9. ✓
- §8 testing (unit + live) → Tasks 1, 2, 10. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output. The theme-token notes (`text-success`/`text-fg-subtle`) are explicit "verify-and-substitute" fallbacks with concrete instructions, not placeholders. ✓

**Type consistency:** helper names (`rangeForPreset`, `monthBuckets`, `toCSV`, `revenueReport`, `plReport`, `agingReport`, `timeReport`) consistent across Tasks 1/2 and consumers 7/8/9. `downloadTextFile` (Task 1) used in 7/8. API names (`fetchPayments`, `fetchExpensesInRange`, `fetchOpenInvoices`, `fetchTimeEntriesInRange`) match Task 3 → Task 4. Hook names (`usePaymentsReport`, `useExpensesInRange`, `useOpenInvoices`, `useTimeEntriesInRange`) match Task 4 → Tasks 7/8. Report return shapes used in 7/8 match the shapes defined in Task 2's Interfaces (e.g. `byCurrency[cur].monthTotals`, `.months`, `.buckets`, `byProject[].billableHours`). `ReportChart` props (`data, bars, height, formatValue`) and `CurrencyTabs` props (`currencies, value, onChange`) match Task 6 → 7/8. ✓
