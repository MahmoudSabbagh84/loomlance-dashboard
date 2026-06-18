# Dashboard Insights Implementation Plan (Phase 2 · Milestone 2)

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a revenue-over-time chart and a top-clients widget to the dashboard, grouped by currency (no implicit FX conversion).

**Architecture:** One `fetchInsights()` query pulls the user's invoice payments with their client, then aggregates client-side into per-currency monthly totals and per-currency client totals. A `<DashboardInsights/>` section owns a currency selector (shown only when >1 currency exists) and renders a `<RevenueChart/>` (Recharts bar chart, last 6 months) and `<TopClients/>` (top 5 by paid revenue) for the selected currency. Recharts is lazy-loaded (`React.lazy`) so it code-splits out of the initial dashboard bundle. Respects the spec rule: dashboard aggregates always group by currency.

**Tech Stack:** `recharts` · existing `lib/currency` (`formatCurrency`, `SUPPORTED_CURRENCIES`) · `lib/date` · TanStack Query · `Card` primitive.

---

### Task 1: Insights data layer

**Files:**
- Modify: `package.json` (add `recharts`)
- Create: `src/features/dashboard/insights.js`
- Create: `src/hooks/useInsights.js`

- [ ] **Step 1:** `npm install recharts`
- [ ] **Step 2:** `insights.js` — `lastNMonths(n)` helper → `[{ key:'yyyy-MM', label:'MMM' }]` (oldest→newest, ending current month). `fetchInsights()` selects `amount, currency, paid_at, invoices(client_id, clients(name))` from `invoice_payments`, ordered by `paid_at`. Aggregate into `byCurrency[cur] = { monthTotals:{ 'yyyy-MM': n }, clientTotals:{ name: n }, total:n }`; `currencies` = keys sorted by `total` desc. Return `{ months: lastNMonths(6), byCurrency, currencies }`.
- [ ] **Step 3:** `useInsights.js` — `useQuery({ queryKey:['dashboard','insights'], queryFn: fetchInsights, staleTime: 60_000 })`.

---

### Task 2: Chart + top-clients UI

**Files:**
- Create: `src/features/dashboard/RevenueChart.jsx` (default export; lazy-loaded — imports recharts)
- Create: `src/features/dashboard/TopClients.jsx`
- Create: `src/features/dashboard/DashboardInsights.jsx`
- Modify: `src/pages/DashboardPage.jsx`

- [ ] **Step 1:** `RevenueChart.jsx` — `ResponsiveContainer` (h-64) → `BarChart` of `data=[{ label, revenue }]` for the selected currency; `Bar fill="var(--color-primary)"`, `XAxis dataKey="label"`, `YAxis` (compact tick), `Tooltip` formatted via `formatCurrency(v, currency)`, subtle `CartesianGrid`. **Default export** so it can be `React.lazy`-loaded.
- [ ] **Step 2:** `TopClients.jsx` — top 5 `[name, amount]` from `clientTotals`, each row name + `formatCurrency(amount, currency)`; empty → "No paid revenue yet."
- [ ] **Step 3:** `DashboardInsights.jsx` — `useInsights()`; pick default currency (profile.default_currency if present in `currencies`, else `currencies[0]`); currency pill selector when `currencies.length > 1`; `Suspense` + lazy `<RevenueChart/>` in a `Card` (title "Revenue · last 6 months") spanning 2 cols + `<TopClients/>` `Card`. If `currencies.length === 0`, render a single Card "No revenue recorded yet — paid invoices will show up here." Loading → `Skeleton`.
- [ ] **Step 4:** Mount `<DashboardInsights/>` in `DashboardPage.jsx` (after the DueSoon/RecentActivity grid).

---

### Task 3: Verify and commit

- [ ] **Step 1:** Gate — `npm run build`, `eslint --max-warnings 0`, `vitest run` (28 pass). Confirm recharts code-splits into its own chunk.
- [ ] **Step 2:** Seed (MCP) a few paid invoices + payments across 2–3 months and 2 clients (incl. a second currency) for the test user; Playwright-verify against `npm run preview` (4173) that the chart renders bars, the currency selector switches series, and top clients list populates; **then delete the seeded data + reset the invoice sequence**.
- [ ] **Step 3:** Commit (lint-gated): `feat(dashboard): revenue chart and top-clients insights`.

---
```
