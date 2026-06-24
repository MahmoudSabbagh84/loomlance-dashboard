# Project Financials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each project an optional budget (with a change log) and a Financials panel showing budget burn-down plus actuals (invoiced, paid, expenses, unbilled-to-invoice, profit).

**Architecture:** Two new DB objects (budget columns on `projects`; a `project_budget_changes` log) plus one atomic RPC `set_project_budget`. Rollups are computed **client-side** by a pure helper `projectFinancials()` that reuses the existing `invoiceTotals` money logic, fed by one `fetchProjectFinancialsData()` query set. UI is a `ProjectFinancialsPanel` on the project detail page, built via Impeccable.

**Tech Stack:** React + Vite, @tanstack/react-query, Supabase (Postgres + RLS + RPC), Tailwind (Slate Pro tokens), vitest, lucide-react.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-23-project-financials-design.md` (LOO-86).
- **Spec corrections discovered during planning (use these exact values):** the payments table is **`invoice_payments`** (not `payments`); the invoice status enum is `draft | sent | viewed | paid | overdue | void` (**no `partially_paid`**). "Invoiced" = statuses **`sent`, `viewed`, `paid`, `overdue`**; `draft` is faded/excluded; `void` excluded. `time_entries` has **no currency column** → time value is always counted in the project currency (only invoices/expenses are currency-filtered).
- **One currency per project** (`projects.budget_currency`, from `SUPPORTED_CURRENCIES` in `src/lib/currency.js`, default = `profiles.default_currency`).
- **Money rounding:** 2 dp via the local `round2` pattern (`Math.round(n*100)/100`).
- **All UI work goes through Impeccable** (`/impeccable craft`/`layout`) per the project rule; match Slate Pro tokens (`bg-bg-elevated`, `border-border`, `text-fg`/`fg-muted`, `text-primary`, `text-success`, `text-danger`, `tabular-nums`).
- **Every task:** `npm run lint` and `npm run build` stay green; the user pushes/deploys (do not push).
- **Budget changes route only through `set_project_budget`** so the note + history are always captured (no raw budget writes from forms).

---

### Task 1: Migration — budget columns, change-log table, RPC

**Files:**
- Create: `supabase/migrations/20260624000000_project_financials.sql`
- Apply via Supabase MCP `apply_migration` (name `project_financials`).

**Interfaces:**
- Produces: `projects.budget_amount numeric(12,2)`, `projects.budget_currency text`; table `project_budget_changes(id, user_id, project_id, previous_amount, new_amount, currency, note, created_at)`; RPC `set_project_budget(p_project_id uuid, p_amount numeric, p_currency text, p_note text) returns void`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Project financials: optional budget + append-only change log + atomic setter.

alter table public.projects
  add column budget_amount numeric(12,2) check (budget_amount is null or budget_amount >= 0),
  add column budget_currency text;

create table public.project_budget_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  previous_amount numeric(12,2),
  new_amount numeric(12,2),
  currency text not null,
  note text,
  created_at timestamptz not null default now()
);
create index project_budget_changes_project_idx
  on public.project_budget_changes (project_id, created_at desc);

alter table public.project_budget_changes enable row level security;
create policy "pbc_select_own" on public.project_budget_changes
  for select using (user_id = auth.uid());
create policy "pbc_insert_own" on public.project_budget_changes
  for insert with check (user_id = auth.uid());

-- Single owner-checked path for every budget change → guarantees the log row.
create or replace function public.set_project_budget(
  p_project_id uuid, p_amount numeric, p_currency text, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_prev numeric(12,2);
begin
  if v_user is null then raise exception 'UNAUTHORIZED' using errcode = 'P0001'; end if;
  select user_id, budget_amount into v_owner, v_prev
    from public.projects where id = p_project_id;
  if v_owner is null or v_owner <> v_user then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.projects
    set budget_amount = p_amount, budget_currency = p_currency
    where id = p_project_id;
  insert into public.project_budget_changes
    (user_id, project_id, previous_amount, new_amount, currency, note)
  values
    (v_user, p_project_id, v_prev, p_amount, p_currency,
     nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;
revoke all on function public.set_project_budget(uuid, numeric, text, text) from public, anon;
grant execute on function public.set_project_budget(uuid, numeric, text, text) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` with name `project_financials` and the SQL above.

- [ ] **Step 3: Verify objects exist**

Run (Supabase MCP `execute_sql`):
```sql
select column_name from information_schema.columns
where table_name='projects' and column_name in ('budget_amount','budget_currency');
select to_regclass('public.project_budget_changes') as tbl;
select proname from pg_proc where proname='set_project_budget';
```
Expected: 2 columns, `project_budget_changes`, `set_project_budget`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624000000_project_financials.sql
git commit -m "feat(db): project budget columns + change log + set_project_budget rpc (LOO-86)"
```

---

### Task 2: Pure helper `projectFinancials()` + unit tests (TDD)

**Files:**
- Create: `src/lib/projectFinancials.js`
- Test: `src/lib/__tests__/projectFinancials.test.js`

**Interfaces:**
- Consumes: `invoiceTotals(lines)` from `src/lib/money.js` → `{ total }`.
- Produces: `projectFinancials({ invoices, expenses, timeEntries }, projectCurrency, budgetAmount) → { invoiced, draftInvoiced, paid, expenses, unbilledExpenses, unbilledTime, unbilledToInvoice, remaining, profit, excludedCount }`. Input row shapes: invoice `{ status, currency, invoice_line_items[], invoice_payments[{amount,currency}] }`; expense `{ amount, currency, billable, invoiced_on_invoice_id }`; timeEntry `{ duration_minutes, billable, hourly_rate, invoiced_on_invoice_id }`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { projectFinancials } from '@/lib/projectFinancials'

const li = (total) => [{ quantity: 1, unit_price: total, tax_rate: 0, discount_rate: 0 }]

describe('projectFinancials', () => {
  it('counts issued invoices, separates drafts, excludes void', () => {
    const r = projectFinancials({
      invoices: [
        { status: 'sent', currency: 'USD', invoice_line_items: li(100) },
        { status: 'viewed', currency: 'USD', invoice_line_items: li(50) },
        { status: 'paid', currency: 'USD', invoice_line_items: li(200) },
        { status: 'draft', currency: 'USD', invoice_line_items: li(40) },
        { status: 'void', currency: 'USD', invoice_line_items: li(999) },
      ],
    }, 'USD', null)
    expect(r.invoiced).toBe(350)
    expect(r.draftInvoiced).toBe(40)
  })

  it('sums paid from invoice_payments in the project currency', () => {
    const r = projectFinancials({
      invoices: [{ status: 'paid', currency: 'USD', invoice_line_items: li(200),
        invoice_payments: [{ amount: 120, currency: 'USD' }, { amount: 80, currency: 'USD' }] }],
    }, 'USD', null)
    expect(r.paid).toBe(200)
  })

  it('excludes different-currency invoices/expenses and counts them', () => {
    const r = projectFinancials({
      invoices: [{ status: 'sent', currency: 'EUR', invoice_line_items: li(100) }],
      expenses: [{ amount: 50, currency: 'EUR', billable: true }],
    }, 'USD', null)
    expect(r.invoiced).toBe(0)
    expect(r.excludedCount).toBe(2)
  })

  it('unbilled-to-invoice = billable, uninvoiced expenses + time (hours x rate)', () => {
    const r = projectFinancials({
      expenses: [
        { amount: 40, currency: 'USD', billable: true, invoiced_on_invoice_id: null },
        { amount: 10, currency: 'USD', billable: true, invoiced_on_invoice_id: 'inv1' },
        { amount: 5, currency: 'USD', billable: false, invoiced_on_invoice_id: null },
      ],
      timeEntries: [
        { billable: true, invoiced_on_invoice_id: null, duration_minutes: 120, hourly_rate: 50 },
        { billable: true, invoiced_on_invoice_id: 'inv1', duration_minutes: 60, hourly_rate: 50 },
        { billable: false, invoiced_on_invoice_id: null, duration_minutes: 60, hourly_rate: 50 },
      ],
    }, 'USD', null)
    expect(r.unbilledExpenses).toBe(40)
    expect(r.unbilledTime).toBe(100)
    expect(r.unbilledToInvoice).toBe(140)
  })

  it('remaining = budget - invoiced; profit = paid - expenses', () => {
    const r = projectFinancials({
      invoices: [{ status: 'sent', currency: 'USD', invoice_line_items: li(300),
        invoice_payments: [{ amount: 100, currency: 'USD' }] }],
      expenses: [{ amount: 70, currency: 'USD', billable: false }],
    }, 'USD', 1000)
    expect(r.remaining).toBe(700)
    expect(r.profit).toBe(30)
  })

  it('remaining is null when no budget set', () => {
    expect(projectFinancials({}, 'USD', null).remaining).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/projectFinancials.test.js`
Expected: FAIL — `projectFinancials is not a function` / module not found.

- [ ] **Step 3: Implement the helper**

```js
import { invoiceTotals } from './money'

const INVOICED_STATUSES = new Set(['sent', 'viewed', 'paid', 'overdue'])
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Pure rollup of one project's financials, in the project's currency.
// Invoices/expenses in a different currency are excluded from sums and counted
// into excludedCount. Time entries have no currency, so their value is always
// counted in the project currency.
export function projectFinancials(
  { invoices = [], expenses = [], timeEntries = [] } = {},
  projectCurrency,
  budgetAmount = null
) {
  let invoiced = 0
  let draftInvoiced = 0
  let paid = 0
  let expensesTotal = 0
  let unbilledExpenses = 0
  let unbilledTime = 0
  let excludedCount = 0

  for (const inv of invoices) {
    if (inv.currency !== projectCurrency) {
      excludedCount += 1
      continue
    }
    const total = invoiceTotals(inv.invoice_line_items || []).total
    if (inv.status === 'draft') draftInvoiced += total
    else if (INVOICED_STATUSES.has(inv.status)) invoiced += total
    for (const p of inv.invoice_payments || []) {
      if (p.currency === projectCurrency) paid += Number(p.amount) || 0
    }
  }

  for (const e of expenses) {
    if (e.currency !== projectCurrency) {
      excludedCount += 1
      continue
    }
    const amt = Number(e.amount) || 0
    expensesTotal += amt
    if (e.billable && !e.invoiced_on_invoice_id) unbilledExpenses += amt
  }

  for (const t of timeEntries) {
    if (t.billable && !t.invoiced_on_invoice_id) {
      unbilledTime += ((Number(t.duration_minutes) || 0) / 60) * (Number(t.hourly_rate) || 0)
    }
  }

  invoiced = round2(invoiced)
  return {
    invoiced,
    draftInvoiced: round2(draftInvoiced),
    paid: round2(paid),
    expenses: round2(expensesTotal),
    unbilledExpenses: round2(unbilledExpenses),
    unbilledTime: round2(unbilledTime),
    unbilledToInvoice: round2(unbilledExpenses + unbilledTime),
    remaining: budgetAmount == null ? null : round2(budgetAmount - invoiced),
    profit: round2(paid - expensesTotal),
    excludedCount,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/projectFinancials.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/projectFinancials.js src/lib/__tests__/projectFinancials.test.js
git commit -m "feat(projects): projectFinancials() rollup helper + tests (LOO-86)"
```

---

### Task 3: API functions + hooks

**Files:**
- Modify: `src/api/projects.js` (append three functions)
- Create: `src/hooks/useProjectFinancials.js`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase`), `mapPostgresError` (`src/lib/errors`), `projectFinancials` (Task 2).
- Produces: `fetchProjectFinancialsData(projectId)`, `setProjectBudget({projectId, amount, currency, note})`, `fetchBudgetHistory(projectId)`; hooks `useProjectFinancials(projectId, projectCurrency, budgetAmount)`, `useBudgetHistory(projectId)`, `useSetProjectBudget(projectId)`.

- [ ] **Step 1: Append API functions to `src/api/projects.js`**

```js
export async function fetchProjectFinancialsData(projectId) {
  const [inv, exp, time] = await Promise.all([
    supabase
      .from('invoices')
      .select('status, currency, invoice_line_items(quantity, unit_price, tax_rate, discount_rate), invoice_payments(amount, currency)')
      .eq('project_id', projectId),
    supabase
      .from('expenses')
      .select('amount, currency, billable, invoiced_on_invoice_id')
      .eq('project_id', projectId),
    supabase
      .from('time_entries')
      .select('duration_minutes, billable, hourly_rate, invoiced_on_invoice_id')
      .eq('project_id', projectId)
      .not('ended_at', 'is', null),
  ])
  if (inv.error) throw mapPostgresError(inv.error)
  if (exp.error) throw mapPostgresError(exp.error)
  if (time.error) throw mapPostgresError(time.error)
  return { invoices: inv.data || [], expenses: exp.data || [], timeEntries: time.data || [] }
}

export async function setProjectBudget({ projectId, amount, currency, note }) {
  const { error } = await supabase.rpc('set_project_budget', {
    p_project_id: projectId,
    p_amount: amount,
    p_currency: currency,
    p_note: note || null,
  })
  if (error) throw mapPostgresError(error)
}

export async function fetchBudgetHistory(projectId) {
  const { data, error } = await supabase
    .from('project_budget_changes')
    .select('id, previous_amount, new_amount, currency, note, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}
```

- [ ] **Step 2: Create the hooks file**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/projects'
import { projectFinancials } from '@/lib/projectFinancials'

export function useProjectFinancials(projectId, projectCurrency, budgetAmount) {
  return useQuery({
    queryKey: ['projects', 'financials', projectId],
    queryFn: () => api.fetchProjectFinancialsData(projectId),
    enabled: !!projectId,
    select: (data) => projectFinancials(data, projectCurrency, budgetAmount ?? null),
  })
}

export function useBudgetHistory(projectId) {
  return useQuery({
    queryKey: ['projects', 'budget-history', projectId],
    queryFn: () => api.fetchBudgetHistory(projectId),
    enabled: !!projectId,
  })
}

export function useSetProjectBudget(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.setProjectBudget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
      qc.invalidateQueries({ queryKey: ['projects', 'financials', projectId] })
      qc.invalidateQueries({ queryKey: ['projects', 'budget-history', projectId] })
    },
  })
}
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: lint clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/api/projects.js src/hooks/useProjectFinancials.js
git commit -m "feat(projects): financials data fetch + budget hooks (LOO-86)"
```

---

### Task 4: Financials panel + budget modals (via Impeccable)

**Files:**
- Create: `src/features/projects/ProjectFinancialsPanel.jsx`
- Create: `src/features/projects/BudgetModal.jsx`
- Create: `src/features/projects/BudgetHistoryModal.jsx`
- Modify: `src/pages/ProjectDetailPage.jsx` (insert the panel)

**Interfaces:**
- Consumes: `useProjectFinancials`, `useBudgetHistory`, `useSetProjectBudget` (Task 3); `formatCurrency` + `SUPPORTED_CURRENCIES` (`src/lib/currency.js`); `useProfile` (`default_currency`); UI primitives `Modal`, `Button`, `Input`, `Select`, `Label`, `Card`, `Skeleton`.
- Produces: `<ProjectFinancialsPanel project={project} />` where `project` includes `id, budget_amount, budget_currency`.

> **This task is built through Impeccable** (`/impeccable craft "project financials panel"`), per the project rule. The contract below is the spec Impeccable must satisfy; match Slate Pro tokens and the existing card/metric patterns (see `src/features/reports/*` and `src/components/ui/Card`).

- [ ] **Step 1: Build `BudgetModal.jsx`**
  - Props: `{ open, onClose, project }`. Fields: amount (`Input` type number, min 0), currency (`Select` from `SUPPORTED_CURRENCIES`, default `project.budget_currency` ?? profile `default_currency`), optional note (`Input`/`Textarea`).
  - On save: `useSetProjectBudget(project.id).mutateAsync({ projectId: project.id, amount: Number(amount), currency, note })`; toast success "Budget updated"; close. Title: "Set budget" when no `project.budget_amount`, else "Adjust budget".
  - Validation: amount required, ≥ 0; currency required.

- [ ] **Step 2: Build `BudgetHistoryModal.jsx`**
  - Props: `{ open, onClose, projectId }`. Uses `useBudgetHistory(projectId)`.
  - Renders rows newest-first: date (`created_at`), `previous_amount → new_amount` (via `formatCurrency(amount, row.currency)`; show "—" for null previous), optional `note`. `Skeleton` while loading; empty state "No budget changes yet."

- [ ] **Step 3: Build `ProjectFinancialsPanel.jsx`**
  - Props: `{ project }`. Currency = `project.budget_currency` ?? profile `default_currency`. `const { data: fin, isLoading } = useProjectFinancials(project.id, currency, project.budget_amount)`.
  - **No budget set** (`project.budget_amount == null`): compact card with a "Set a budget" `Button` (opens `BudgetModal`) + still show the actuals grid below.
  - **Budget set:** a **burn bar** — invoiced of budget (`fin.invoiced` / `project.budget_amount`), filled width clamped 0–100%, `fin.remaining` shown; if `fin.invoiced > budget`, show over-budget overflow in `text-danger`. An "Adjust" button (opens `BudgetModal`) and a "History" button (opens `BudgetHistoryModal`).
  - **Metric grid** (always): Invoiced (with faded `draftInvoiced` sub-note "+ X in draft" when > 0), Paid, Expenses, Unbilled to invoice, Profit — each `formatCurrency(value, currency)`, `tabular-nums`. Profit `text-success` when ≥ 0 else `text-danger`.
  - **Currency flag:** when `fin.excludedCount > 0`, a small `text-fg-muted` note: `{excludedCount} item(s) in another currency are excluded.`
  - `Skeleton` while `isLoading`.

- [ ] **Step 4: Wire into `ProjectDetailPage.jsx`**

Insert the panel between `PageHeader` and `KanbanBoard`:
```jsx
import { ProjectFinancialsPanel } from '@/features/projects/ProjectFinancialsPanel'
// ...
<PageHeader title={project.name} subtitle={project.clients?.name} />
<ProjectFinancialsPanel project={project} />
<KanbanBoard projectId={project.id} onTaskClick={setDrawerTask} />
```
Also confirm `getProject` returns the new budget columns — it selects `*, clients(name)` (`src/api/projects.js:18`), so `budget_amount`/`budget_currency` are included automatically.

- [ ] **Step 5: Verify lint + build + visual pass**

Run: `npm run lint && npm run build`
Expected: clean. Then an Impeccable visual pass (states: no-budget, under-budget, over-budget, different-currency flag, empty history) — light + dark.

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/ProjectFinancialsPanel.jsx src/features/projects/BudgetModal.jsx src/features/projects/BudgetHistoryModal.jsx src/pages/ProjectDetailPage.jsx
git commit -m "feat(projects): Financials panel — budget burn-down + actuals + history (LOO-86)"
```

---

## Self-Review

**Spec coverage:** budget columns + currency (Task 1) ✓; change log + note (Task 1 table + RPC) ✓; client-side rollups reusing `invoiceTotals` (Task 2) ✓; invoiced/paid/expenses/unbilled/remaining/profit + drafts-excluded + currency-exclusion (Task 2) ✓; data fetch + hooks (Task 3) ✓; panel + burn bar + metric grid + currency flag + budget set/adjust + history (Task 4) ✓. **Deviation from spec (intentional, flag to user):** budget is set/adjusted from the **Financials panel modal via the `set_project_budget` RPC**, not a field on the project create/edit form — this guarantees every change is logged with its optional note through one atomic path. Same user-facing capability ("set + adjust + history with notes"), cleaner data integrity.

**Placeholder scan:** none — all steps carry real SQL/JS/commands. Task 4 components are interface-specified for Impeccable (the one place the rule requires generated UI), not hand-waved.

**Type consistency:** `projectFinancials(data, currency, budgetAmount)` signature matches across Task 2 (def), Task 3 (`select`), Task 4 (consume). Field names (`invoiced`, `draftInvoiced`, `paid`, `expenses`, `unbilledToInvoice`, `remaining`, `profit`, `excludedCount`) consistent. RPC param names (`p_project_id`, `p_amount`, `p_currency`, `p_note`) match between Task 1 (def) and Task 3 (`rpc` call).

## Open questions

None.
