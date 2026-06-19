# Expenses (Phase 4 sub-project 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tier 2 freelancers record categorized business expenses with optional receipts and push billable expenses onto a client's draft invoice.

**Architecture:** Mirror the just-shipped time-tracking sub-project. One Supabase migration adds the `expenses` table (RLS + trigger), a private `receipts` storage bucket (own-folder RLS), and an atomic `generate_invoice_from_expenses(p_client_id)` SECURITY DEFINER RPC. A pure helper module (`src/lib/expenses.js`) holds validation + invoice-line/totals math (unit-tested). A thin API module + TanStack-Query hooks back an `/expenses` page composed of a table, a form modal, and a generate-invoice modal. Tier gating reuses `hasFeature` / `UpgradeCard`.

**Tech Stack:** React + Vite, react-hook-form, TanStack Query, Sonner toasts, Tailwind design-system components (`@/components/ui/*`), Supabase JS (`@/lib/supabase`), Vitest.

## Global Constraints

- **Tier gate:** all expense features require `FEATURES.EXPENSES` (tier_2). The flag, `UPGRADE_COPY[FEATURES.EXPENSES]`, and the sidebar nav item (`/expenses`, target `tier_2`) already exist — do NOT re-add them.
- **Storage upload gotcha (carried forward):** upload receipts with a plain `.upload(path, file, { contentType })` using a UNIQUE timestamped path. NEVER pass `{ upsert: true }` (it triggers an RLS-denied existence-check SELECT → 400). Delete via the Storage API `.remove([paths])`, never `delete from storage.objects`.
- **`receipts` bucket is PRIVATE** — surface receipts via on-demand signed URLs, never `getPublicUrl`.
- **FK on-delete:** `expenses.project_id` and `expenses.client_id` are `ON DELETE SET NULL` (preserve the ledger). `invoiced_on_invoice_id` is `ON DELETE SET NULL`.
- **Error mapping:** all API calls go through `mapPostgresError`; user-facing strings come from `AppError.userMessage`. RPC raises use `errcode = 'P0001'` with the bare code keyword as the message (see existing `detectCode`).
- **Money math:** amounts are `numeric(10,2)`; round to 2 decimals. Reuse `formatCurrency(amount, currency)` from `@/lib/currency` and `formatDate` from `@/lib/date`.
- **Currency:** invoice generation bills ONLY expenses whose `currency` equals the user's `profiles.default_currency`.
- **Commit style:** Conventional Commits, scope `expenses` (e.g. `feat(expenses): ...`). Frequent commits, one per task.

---

## File Structure

- `supabase/migrations/<ts>_expenses.sql` — table, indexes, RLS, trigger, receipts bucket + storage policies, RPC. **(Task 1)**
- `src/lib/expenses.js` — `EXPENSE_CATEGORIES`, `RECEIPT_TYPES`, `RECEIPT_MAX_BYTES`, `validateReceiptFile`, `buildExpenseInvoiceLines`, `expenseTotals`. **(Task 2)**
- `src/lib/__tests__/expenses.test.js` — unit tests for Task 2. **(Task 2)**
- `src/lib/errors.js` — add `NO_BILLABLE_EXPENSES` message. **(Task 3)**
- `src/api/expenses.js` — list/create/update/delete + receipt upload/remove/url + generate-invoice. **(Task 3)**
- `src/hooks/useExpenses.js` — query + mutation hooks. **(Task 4)**
- `src/features/expenses/ExpensesTable.jsx` — list table. **(Task 5)**
- `src/features/expenses/ExpenseFormModal.jsx` — create/edit modal incl. receipt upload. **(Task 6)**
- `src/features/expenses/GenerateExpenseInvoiceModal.jsx` — client → preview → RPC. **(Task 7)**
- `src/pages/ExpensesPage.jsx` — page (tier-gated) wiring everything. **(Task 8)**
- `src/app/routes.jsx` — register `/expenses` route. **(Task 8)**
- Live verification + cleanup. **(Task 9)**

---

## Task 1: Database migration (table, RLS, receipts bucket, RPC)

**Files:**
- Create: `supabase/migrations/<timestamp>_expenses.sql` (timestamp format `YYYYMMDDHHMMSS`, later than `20260619014123`)

**Interfaces:**
- Produces (DB): table `public.expenses`; function `public.generate_invoice_from_expenses(uuid) returns uuid`; private storage bucket `receipts`. Consumed by Tasks 3–8.
- Consumes (existing DB): `public.set_updated_at()` trigger fn, `public.next_invoice_number(uuid)`, tables `projects`, `clients`, `invoices`, `invoice_line_items`, `profiles`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/<timestamp>_expenses.sql` with exactly:

```sql
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  spent_on date not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null,
  category text not null,
  description text,
  receipt_path text,
  billable boolean not null default false,
  invoiced_on_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_user_spent_idx on public.expenses (user_id, spent_on desc);
create index expenses_project_idx on public.expenses (project_id);
create index expenses_client_idx on public.expenses (client_id);

create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;
create policy "expenses_select_own" on public.expenses for select using (user_id = auth.uid());
create policy "expenses_insert_own" on public.expenses for insert with check (user_id = auth.uid());
create policy "expenses_update_own" on public.expenses for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses_delete_own" on public.expenses for delete using (user_id = auth.uid());

-- Private receipts bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "receipts_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "receipts_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));

create or replace function public.generate_invoice_from_expenses(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invoice_id uuid;
  v_number text;
  v_currency text;
  v_count int;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  select default_currency into v_currency from public.profiles where id = v_user;
  v_currency := coalesce(v_currency, 'USD');

  select count(*) into v_count
  from public.expenses e
  left join public.projects p on p.id = e.project_id
  where e.user_id = v_user and e.billable and e.invoiced_on_invoice_id is null
    and e.currency = v_currency
    and (e.client_id = p_client_id or (p.id is not null and p.client_id = p_client_id and p.user_id = v_user));
  if v_count = 0 then
    raise exception 'NO_BILLABLE_EXPENSES' using errcode = 'P0001';
  end if;

  v_number := public.next_invoice_number(v_user);

  insert into public.invoices (user_id, client_id, invoice_number, status, currency, issue_date, due_date)
  values (v_user, p_client_id, v_number, 'draft', v_currency, current_date, current_date + 30)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, description, quantity, unit_price, tax_rate, discount_rate, position)
  select
    v_user, v_invoice_id,
    coalesce(nullif(btrim(e.description), ''), e.category),
    1,
    e.amount,
    0, 0,
    (row_number() over (order by e.spent_on, e.id)) - 1
  from public.expenses e
  left join public.projects p on p.id = e.project_id
  where e.user_id = v_user and e.billable and e.invoiced_on_invoice_id is null
    and e.currency = v_currency
    and (e.client_id = p_client_id or (p.id is not null and p.client_id = p_client_id and p.user_id = v_user));

  update public.expenses e
  set invoiced_on_invoice_id = v_invoice_id
  from (
    select e2.id
    from public.expenses e2
    left join public.projects p on p.id = e2.project_id
    where e2.user_id = v_user and e2.billable and e2.invoiced_on_invoice_id is null
      and e2.currency = v_currency
      and (e2.client_id = p_client_id or (p.id is not null and p.client_id = p_client_id and p.user_id = v_user))
  ) sel
  where e.id = sel.id;

  return v_invoice_id;
end;
$$;
revoke all on function public.generate_invoice_from_expenses(uuid) from public, anon;
grant execute on function public.generate_invoice_from_expenses(uuid) to authenticated;
```

- [ ] **Step 2: Apply the migration to the hosted dev project**

Apply via the Supabase MCP `apply_migration` tool (name `expenses`, body = the SQL above) against project `zbipqfsqxnvrzhpdjvvy`. (No local Docker — this project develops against the hosted DB.)

- [ ] **Step 3: Verify the objects exist**

Run via Supabase MCP `execute_sql`:
```sql
select to_regclass('public.expenses') as tbl,
       (select count(*) from pg_policies where tablename = 'expenses') as table_policies,
       (select count(*) from storage.buckets where id = 'receipts') as bucket,
       to_regprocedure('public.generate_invoice_from_expenses(uuid)') as fn;
```
Expected: `tbl = public.expenses`, `table_policies = 4`, `bucket = 1`, `fn = public.generate_invoice_from_expenses(uuid)`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(expenses): expenses table, receipts bucket, generate-invoice-from-expenses RPC"
```

---

## Task 2: Pure helpers + unit tests (`src/lib/expenses.js`)

**Files:**
- Create: `src/lib/expenses.js`
- Test: `src/lib/__tests__/expenses.test.js`

**Interfaces:**
- Produces:
  - `EXPENSE_CATEGORIES: string[]` — preset category names.
  - `RECEIPT_TYPES: string[]`, `RECEIPT_MAX_BYTES: number`.
  - `validateReceiptFile(file): void` — throws `AppError('UNKNOWN', msg)` on bad type/size; returns nothing on success.
  - `buildExpenseInvoiceLines(expenses): Array<{ id, description, amount }>` — one line per expense; `description = (trimmed description) || category`; `amount = Number(amount)`.
  - `expenseTotals(expenses): { total: number, byCategory: Array<{ category, total }> }` — `total` and per-category sums, each rounded to 2 decimals, `byCategory` sorted by total desc.
- Consumes: `AppError` from `@/lib/errors`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/expenses.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES,
  RECEIPT_MAX_BYTES,
  validateReceiptFile,
  buildExpenseInvoiceLines,
  expenseTotals,
} from '@/lib/expenses'

describe('EXPENSE_CATEGORIES', () => {
  it('includes the core presets', () => {
    expect(EXPENSE_CATEGORIES).toContain('Software')
    expect(EXPENSE_CATEGORIES).toContain('Other')
  })
})

describe('validateReceiptFile', () => {
  it('accepts a small PDF', () => {
    expect(() => validateReceiptFile({ type: 'application/pdf', size: 1000 })).not.toThrow()
  })
  it('rejects a disallowed type', () => {
    expect(() => validateReceiptFile({ type: 'text/csv', size: 1000 })).toThrow(/PDF|PNG|JPG|WebP/i)
  })
  it('rejects an oversize file', () => {
    expect(() => validateReceiptFile({ type: 'image/png', size: RECEIPT_MAX_BYTES + 1 })).toThrow(/under/i)
  })
})

describe('buildExpenseInvoiceLines', () => {
  it('one line per expense, description falls back to category', () => {
    const lines = buildExpenseInvoiceLines([
      { id: '1', description: '  ', category: 'Travel', amount: 50 },
      { id: '2', description: 'AWS', category: 'Software', amount: 12.5 },
    ])
    expect(lines).toEqual([
      { id: '1', description: 'Travel', amount: 50 },
      { id: '2', description: 'AWS', amount: 12.5 },
    ])
  })
})

describe('expenseTotals', () => {
  it('sums overall and by category, sorted desc', () => {
    const t = expenseTotals([
      { category: 'Software', amount: 10 },
      { category: 'Travel', amount: 25 },
      { category: 'Software', amount: 5 },
    ])
    expect(t.total).toBe(40)
    expect(t.byCategory).toEqual([
      { category: 'Travel', total: 25 },
      { category: 'Software', total: 15 },
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/__tests__/expenses.test.js`
Expected: FAIL — `Failed to resolve import "@/lib/expenses"`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/expenses.js`:

```js
import { AppError } from '@/lib/errors'

export const EXPENSE_CATEGORIES = [
  'Software',
  'Hardware',
  'Travel',
  'Meals',
  'Subscriptions',
  'Office',
  'Contractors',
  'Fees',
  'Other',
]

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
export const RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

export function validateReceiptFile(file) {
  if (!file || !RECEIPT_TYPES.includes(file.type)) {
    throw new AppError('UNKNOWN', 'Receipt must be a PDF, PNG, JPG, or WebP file.')
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    throw new AppError('UNKNOWN', 'Receipt must be under 5 MB.')
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function buildExpenseInvoiceLines(expenses) {
  return (expenses || []).map((e) => ({
    id: e.id,
    description: (typeof e.description === 'string' && e.description.trim()) || e.category,
    amount: round2(e.amount),
  }))
}

export function expenseTotals(expenses) {
  const map = new Map()
  let total = 0
  for (const e of expenses || []) {
    const amt = Number(e.amount) || 0
    total += amt
    map.set(e.category, (map.get(e.category) || 0) + amt)
  }
  const byCategory = [...map.entries()]
    .map(([category, t]) => ({ category, total: round2(t) }))
    .sort((a, b) => b.total - a.total)
  return { total: round2(total), byCategory }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/expenses.test.js`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/expenses.js src/lib/__tests__/expenses.test.js
git commit -m "feat(expenses): receipt validation + invoice-line/totals helpers + tests"
```

---

## Task 3: API module + error code (`src/api/expenses.js`, `src/lib/errors.js`)

**Files:**
- Create: `src/api/expenses.js`
- Modify: `src/lib/errors.js` (add one entry to `CODE_MESSAGES`)

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`), `AppError`/`mapPostgresError` (`@/lib/errors`), `validateReceiptFile` (`@/lib/expenses`).
- Produces (used by Task 4 hooks):
  - `listExpenses({ projectId, clientId, category, from, to, status }): Promise<row[]>` — `status ∈ all|unbilled|billed`; rows include `projects(name, client_id)` and `clients(name)`.
  - `createExpense(payload): Promise<row>` — payload keys: `project_id|null, client_id|null, spent_on, amount, currency, category, description, billable, receipt_path|null`.
  - `updateExpense(id, patch): Promise<row>`
  - `deleteExpense(id): Promise<void>`
  - `uploadReceipt(file): Promise<string>` — returns the storage `path`.
  - `removeReceipt(path): Promise<void>`
  - `getReceiptUrl(path): Promise<string>` — signed URL.
  - `generateInvoiceFromExpenses(clientId): Promise<string>` — new invoice id.

- [ ] **Step 1: Add the error code**

In `src/lib/errors.js`, inside `CODE_MESSAGES`, add this line directly after the `NO_UNBILLED_TIME` entry:

```js
  NO_BILLABLE_EXPENSES: 'No billable expenses for this client.',
```

- [ ] **Step 2: Implement the API module**

Create `src/api/expenses.js`:

```js
import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'
import { validateReceiptFile } from '@/lib/expenses'

const BUCKET = 'receipts'
const SELECT =
  'id, project_id, client_id, spent_on, amount, currency, category, description, receipt_path, billable, invoiced_on_invoice_id, projects(name, client_id), clients(name)'

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data?.session?.user?.id
  if (!id) throw new AppError('UNAUTHORIZED', 'You must be signed in.')
  return id
}

export async function listExpenses({ projectId, clientId, category, from, to, status = 'all' } = {}) {
  let q = supabase.from('expenses').select(SELECT).order('spent_on', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  if (clientId) q = q.eq('client_id', clientId)
  if (category) q = q.eq('category', category)
  if (from) q = q.gte('spent_on', from)
  if (to) q = q.lte('spent_on', to)
  if (status === 'unbilled') q = q.is('invoiced_on_invoice_id', null)
  if (status === 'billed') q = q.not('invoiced_on_invoice_id', 'is', null)
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createExpense(payload) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...payload, user_id: await uid() })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateExpense(id, patch) {
  const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select(SELECT).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function uploadReceipt(file) {
  validateReceiptFile(file)
  const userId = await uid()
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw mapPostgresError(error)
  return path
}

export async function removeReceipt(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error && error.message && !/not found/i.test(error.message)) throw mapPostgresError(error)
}

export async function getReceiptUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw mapPostgresError(error)
  return data.signedUrl
}

export async function generateInvoiceFromExpenses(clientId) {
  const { data, error } = await supabase.rpc('generate_invoice_from_expenses', { p_client_id: clientId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
```

- [ ] **Step 3: Verify it builds and lints**

Run: `npm run lint -- src/api/expenses.js src/lib/errors.js`
Expected: no errors. (API modules in this codebase have no unit tests — the time-tracking `time-entries.js` set the precedent; correctness is verified live in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add src/api/expenses.js src/lib/errors.js
git commit -m "feat(expenses): expenses api (crud, receipts, generate-invoice) + error code"
```

---

## Task 4: Query/mutation hooks (`src/hooks/useExpenses.js`)

**Files:**
- Create: `src/hooks/useExpenses.js`

**Interfaces:**
- Consumes: `* as api` from `@/api/expenses`; `@tanstack/react-query`.
- Produces: `useExpenses(filters)`, `useCreateExpense()`, `useUpdateExpense()` (mutate arg `{ id, patch }`), `useDeleteExpense()` (mutate arg `id`), `useGenerateInvoiceFromExpenses()` (mutate arg `clientId`). All invalidate `['expenses']`; generate also invalidates `['invoices']`.

- [ ] **Step 1: Implement the hooks**

Create `src/hooks/useExpenses.js`:

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/expenses'

export function useExpenses(filters) {
  return useQuery({ queryKey: ['expenses', filters], queryFn: () => api.listExpenses(filters) })
}

function useInvalidateExpenses() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['expenses'] })
}

export function useCreateExpense() {
  const inv = useInvalidateExpenses()
  return useMutation({ mutationFn: api.createExpense, onSuccess: inv })
}
export function useUpdateExpense() {
  const inv = useInvalidateExpenses()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateExpense(id, patch), onSuccess: inv })
}
export function useDeleteExpense() {
  const inv = useInvalidateExpenses()
  return useMutation({ mutationFn: api.deleteExpense, onSuccess: inv })
}
export function useGenerateInvoiceFromExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateInvoiceFromExpenses,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/hooks/useExpenses.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useExpenses.js
git commit -m "feat(expenses): expenses query/mutation hooks"
```

---

## Task 5: Expenses table component (`src/features/expenses/ExpensesTable.jsx`)

**Files:**
- Create: `src/features/expenses/ExpensesTable.jsx`

**Interfaces:**
- Consumes: design-system `Table, THead, TR, TH, TD` (`@/components/ui/Table`), `Badge` (`@/components/ui/Badge`), `formatDate` (`@/lib/date`), `formatCurrency` (`@/lib/currency`), icons from `lucide-react`.
- Produces: `export function ExpensesTable({ expenses, onEdit, onDelete, onOpenReceipt })` — `onOpenReceipt(path)` is called when a row's receipt button is clicked.

- [ ] **Step 1: Implement the component**

Create `src/features/expenses/ExpensesTable.jsx`:

```jsx
import { Pencil, Trash2, Paperclip } from 'lucide-react'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

export function ExpensesTable({ expenses, onEdit, onDelete, onOpenReceipt }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH>Category</TH>
          <TH>Description</TH>
          <TH>Project / Client</TH>
          <TH>Amount</TH>
          <TH>Status</TH>
          <TH></TH>
        </TR>
      </THead>
      <tbody>
        {expenses.map((e) => (
          <TR key={e.id}>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(e.spent_on)}</TD>
            <TD>{e.category}</TD>
            <TD className="text-fg-muted">{e.description || '—'}</TD>
            <TD className="text-fg-muted">{e.projects?.name || e.clients?.name || '—'}</TD>
            <TD className="tabular-nums">{formatCurrency(Number(e.amount), e.currency)}</TD>
            <TD>
              {!e.billable ? (
                <Badge>non-billable</Badge>
              ) : e.invoiced_on_invoice_id ? (
                <Badge variant="success">billed</Badge>
              ) : (
                <Badge variant="info">unbilled</Badge>
              )}
            </TD>
            <TD>
              <div className="flex justify-end gap-1">
                {e.receipt_path ? (
                  <button onClick={() => onOpenReceipt(e.receipt_path)} className="text-fg-subtle hover:text-fg" aria-label="View receipt">
                    <Paperclip className="size-4" />
                  </button>
                ) : null}
                <button onClick={() => onEdit(e)} className="text-fg-subtle hover:text-fg" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(e)} className="text-fg-subtle hover:text-danger" aria-label="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/features/expenses/ExpensesTable.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/expenses/ExpensesTable.jsx
git commit -m "feat(expenses): expenses table component"
```

---

## Task 6: Expense form modal (`src/features/expenses/ExpenseFormModal.jsx`)

**Files:**
- Create: `src/features/expenses/ExpenseFormModal.jsx`

**Interfaces:**
- Consumes: `react-hook-form` `useForm`; `toast` (`sonner`); UI `Modal, Button, Input, Select, Textarea, Label`; `useProjects` (`@/hooks/useProjects`), `useClients` (`@/hooks/useClients`), `useProfile` (`@/hooks/useProfile`); `useCreateExpense, useUpdateExpense` (`@/hooks/useExpenses`); `uploadReceipt, removeReceipt` (`@/api/expenses`); `EXPENSE_CATEGORIES` (`@/lib/expenses`).
- Produces: `export function ExpenseFormModal({ open, onClose, expense })` — `expense` null ⇒ create, else edit.
- Note: `useProjects({ status: 'all' })` returns an array; `useClients({ pageSize: 200 })` returns `{ rows }`.

- [ ] **Step 1: Implement the modal**

Create `src/features/expenses/ExpenseFormModal.jsx`:

```jsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useProjects } from '@/hooks/useProjects'
import { useClients } from '@/hooks/useClients'
import { useProfile } from '@/hooks/useProfile'
import { useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses'
import { uploadReceipt, removeReceipt } from '@/api/expenses'
import { EXPENSE_CATEGORIES } from '@/lib/expenses'

export function ExpenseFormModal({ open, onClose, expense }) {
  const { data: projects = [] } = useProjects({ status: 'all' })
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const { data: profile } = useProfile()
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const isEdit = !!expense
  const [file, setFile] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      spent_on: (expense?.spent_on ?? new Date().toISOString()).slice(0, 10),
      amount: expense?.amount ?? '',
      currency: expense?.currency ?? profile?.default_currency ?? 'USD',
      category: expense?.category ?? 'Software',
      description: expense?.description ?? '',
      project_id: expense?.project_id ?? '',
      client_id: expense?.client_id ?? '',
      billable: expense?.billable ?? false,
    },
  })

  const onSubmit = async (v) => {
    const amount = Number(v.amount)
    if (!(amount >= 0) || v.amount === '') {
      toast.error('Enter an amount')
      return
    }
    if (!v.category.trim()) {
      toast.error('Pick a category')
      return
    }
    try {
      let receiptPath = expense?.receipt_path ?? null
      if (file) {
        if (isEdit && expense?.receipt_path) await removeReceipt(expense.receipt_path)
        receiptPath = await uploadReceipt(file)
      }
      const payload = {
        spent_on: v.spent_on,
        amount,
        currency: v.currency.trim() || 'USD',
        category: v.category.trim(),
        description: v.description,
        project_id: v.project_id || null,
        client_id: v.client_id || null,
        billable: v.billable,
        receipt_path: receiptPath,
      }
      if (isEdit) {
        await update.mutateAsync({ id: expense.id, patch: payload })
      } else {
        await create.mutateAsync(payload)
      }
      toast.success(isEdit ? 'Expense updated' : 'Expense added')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not save')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit expense' : 'Add expense'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="spent_on">Date</Label>
            <Input id="spent_on" type="date" {...register('spent_on')} />
          </div>
          <div>
            <Label htmlFor="amount" required>Amount</Label>
            <Input id="amount" type="number" step="0.01" min="0" {...register('amount')} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" {...register('currency')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category" required>Category</Label>
            <Input id="category" list="expense-categories" {...register('category', { required: true })} />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" {...register('billable')} /> Billable to client
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="project_id">Project</Label>
            <Select id="project_id" {...register('project_id')}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="client_id">Client</Label>
            <Select id="client_id" {...register('client_id')}>
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={2} {...register('description')} />
        </div>
        <div>
          <Label htmlFor="receipt">Receipt {isEdit && expense?.receipt_path ? '(replaces existing)' : '(optional)'}</Label>
          <Input
            id="receipt"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Add expense'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/features/expenses/ExpenseFormModal.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/expenses/ExpenseFormModal.jsx
git commit -m "feat(expenses): add/edit expense modal with receipt upload"
```

---

## Task 7: Generate-invoice modal (`src/features/expenses/GenerateExpenseInvoiceModal.jsx`)

**Files:**
- Create: `src/features/expenses/GenerateExpenseInvoiceModal.jsx`

**Interfaces:**
- Consumes: `useState, useMemo`; `useNavigate` (`react-router-dom`); `toast`; UI `Modal, Button, Select, Label`; `useClients` (`@/hooks/useClients`), `useProfile` (`@/hooks/useProfile`), `useExpenses, useGenerateInvoiceFromExpenses` (`@/hooks/useExpenses`); `buildExpenseInvoiceLines` (`@/lib/expenses`); `formatCurrency` (`@/lib/currency`).
- Produces: `export function GenerateExpenseInvoiceModal({ open, onClose })`.
- Eligibility filter (mirror of the RPC's client resolution + matching currency): an unbilled, billable expense counts for the selected client when `currency === profile.default_currency` AND (`client_id === clientId` OR `projects.client_id === clientId`).

- [ ] **Step 1: Implement the modal**

Create `src/features/expenses/GenerateExpenseInvoiceModal.jsx`:

```jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { useClients } from '@/hooks/useClients'
import { useProfile } from '@/hooks/useProfile'
import { useExpenses, useGenerateInvoiceFromExpenses } from '@/hooks/useExpenses'
import { buildExpenseInvoiceLines } from '@/lib/expenses'
import { formatCurrency } from '@/lib/currency'

export function GenerateExpenseInvoiceModal({ open, onClose }) {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const [clientId, setClientId] = useState('')
  const gen = useGenerateInvoiceFromExpenses()
  const currency = profile?.default_currency || 'USD'
  const { data: expenses = [] } = useExpenses({ status: 'unbilled' })

  const lines = useMemo(() => {
    const eligible = expenses.filter(
      (e) =>
        e.billable &&
        e.currency === currency &&
        (e.client_id === clientId || e.projects?.client_id === clientId),
    )
    return buildExpenseInvoiceLines(eligible)
  }, [expenses, clientId, currency])

  const onGenerate = async () => {
    try {
      const id = await gen.mutateAsync(clientId)
      toast.success('Draft invoice created')
      onClose()
      navigate(`/invoices/${id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not generate invoice')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate invoice from expenses" size="md">
      <div className="space-y-4">
        <div>
          <Label htmlFor="client">Client</Label>
          <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {clientId ? (
          lines.length ? (
            <div className="rounded-md border border-border">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0">
                  <span>{l.description}</span>
                  <span className="tabular-nums">{formatCurrency(l.amount, currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No billable expenses for this client.</p>
          )
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onGenerate} disabled={!clientId || lines.length === 0} loading={gen.isPending}>
            Create draft invoice
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/features/expenses/GenerateExpenseInvoiceModal.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/expenses/GenerateExpenseInvoiceModal.jsx
git commit -m "feat(expenses): generate-invoice-from-expenses modal"
```

---

## Task 8: Expenses page + route (`src/pages/ExpensesPage.jsx`, `src/app/routes.jsx`)

**Files:**
- Create: `src/pages/ExpensesPage.jsx`
- Modify: `src/app/routes.jsx` (import + one child route)

**Interfaces:**
- Consumes: UI `PageHeader, Button, Input, Select, Toolbar, Skeleton, EmptyState, ConfirmDialog`; `UpgradeCard` (`@/components/gates/UpgradeCard`); `useProfile` (`@/hooks/useProfile`), `useProjects`, `useClients`; `useExpenses, useDeleteExpense` (`@/hooks/useExpenses`); `getReceiptUrl` (`@/api/expenses`); `hasFeature, FEATURES` (`@/lib/tier`); `expenseTotals` (`@/lib/expenses`); `formatCurrency` (`@/lib/currency`); the three `@/features/expenses/*` components.
- Default export `ExpensesPage`.

- [ ] **Step 1: Implement the page**

Create `src/pages/ExpensesPage.jsx`:

```jsx
import { useState } from 'react'
import { Plus, FileText, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toolbar } from '@/components/ui/Toolbar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile } from '@/hooks/useProfile'
import { useProjects } from '@/hooks/useProjects'
import { useExpenses, useDeleteExpense } from '@/hooks/useExpenses'
import { getReceiptUrl } from '@/api/expenses'
import { hasFeature, FEATURES } from '@/lib/tier'
import { expenseTotals, EXPENSE_CATEGORIES } from '@/lib/expenses'
import { formatCurrency } from '@/lib/currency'
import { ExpensesTable } from '@/features/expenses/ExpensesTable'
import { ExpenseFormModal } from '@/features/expenses/ExpenseFormModal'
import { GenerateExpenseInvoiceModal } from '@/features/expenses/GenerateExpenseInvoiceModal'

export default function ExpensesPage() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const { data: projects = [] } = useProjects({ status: 'all' })
  const [projectId, setProjectId] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [genOpen, setGenOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const del = useDeleteExpense()
  const { data: expenses = [], isLoading } = useExpenses({
    projectId: projectId || undefined,
    category: category || undefined,
    status,
  })

  if (!hasFeature(tier, FEATURES.EXPENSES)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Expenses" />
        <UpgradeCard feature={FEATURES.EXPENSES} currentTier={tier} target="tier_2" />
      </div>
    )
  }

  const currency = profile?.default_currency || 'USD'
  const totals = expenseTotals(expenses)

  const openReceipt = async (path) => {
    try {
      const url = await getReceiptUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(e.userMessage || 'Could not open receipt')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Expenses" subtitle="Track costs and bill them back">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setGenOpen(true)}>
            <FileText className="size-4" /> Generate invoice
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="size-4" /> Add expense
          </Button>
        </div>
      </PageHeader>

      <Toolbar>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-44">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="all">All</option>
          <option value="unbilled">Unbilled</option>
          <option value="billed">Billed</option>
        </Select>
      </Toolbar>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Add your business costs and attach receipts."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> Add expense</Button>}
        />
      ) : (
        <>
          <ExpensesTable
            expenses={expenses}
            onEdit={(e) => { setEditing(e); setFormOpen(true) }}
            onDelete={setToDelete}
            onOpenReceipt={openReceipt}
          />
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm text-fg-muted">
            {totals.byCategory.map((c) => (
              <span key={c.category}>{c.category}: <span className="tabular-nums text-fg">{formatCurrency(c.total, currency)}</span></span>
            ))}
            <span className="font-medium">Total: <span className="tabular-nums text-fg">{formatCurrency(totals.total, currency)}</span></span>
          </div>
        </>
      )}

      {formOpen ? <ExpenseFormModal open onClose={() => setFormOpen(false)} expense={editing} /> : null}
      {genOpen ? <GenerateExpenseInvoiceModal open onClose={() => setGenOpen(false)} /> : null}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete expense?"
        body="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          try {
            await del.mutateAsync(toDelete.id)
            toast.success('Deleted')
            setToDelete(null)
          } catch (e) {
            toast.error(e.userMessage)
          }
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Register the route**

In `src/app/routes.jsx`, add the import after the `TimePage` import (line 16):

```jsx
import ExpensesPage from '@/pages/ExpensesPage'
```

And add this child route immediately after the `time` route (the `{ path: 'time', element: <TimePage /> },` line):

```jsx
      { path: 'expenses', element: <ExpensesPage /> },
```

- [ ] **Step 3: Verify build + tests + lint**

Run: `npm run lint` then `npm run test` then `npm run build`
Expected: lint clean; all unit tests pass (including the new `expenses.test.js`); production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ExpensesPage.jsx src/app/routes.jsx
git commit -m "feat(expenses): /expenses page (list, filters, totals) + route"
```

---

## Task 9: Live verification + cleanup

**Files:** none (manual verification against the hosted dev project + UI).

**Pre-req:** the dev server / preview is running and you are signed in as the **tier-2 test user**. Use self-cleaning markers (description prefix `ZZ-`) so seeded rows are easy to find and delete.

- [ ] **Step 1: Add a plain expense with a receipt**

In the UI: Add expense → category `Software`, amount `12.50`, description `ZZ-aws`, attach a small PNG/PDF receipt, leave non-billable → Save.
Expected: row appears; the paperclip opens the receipt in a new tab (signed URL resolves, no 400).

- [ ] **Step 2: Add a billable expense tied to a client**

Add expense → category `Travel`, amount `80`, description `ZZ-train`, **Billable** checked, choose a Client (or a Project under that client), currency = the test user's default currency → Save.
Expected: row shows the `unbilled` badge.

- [ ] **Step 3: Add a foreign-currency billable expense (exclusion check)**

Add expense → category `Meals`, amount `40`, description `ZZ-eur`, Billable checked, same client, currency `EUR` (assuming default ≠ EUR) → Save.

- [ ] **Step 4: Generate an invoice from expenses**

Click **Generate invoice** → pick the client. Expected preview: one line for `ZZ-train` (80), and the `ZZ-eur` line is NOT shown. Click **Create draft invoice**.
Expected: navigates to `/invoices/:id`; the draft has one line item (`ZZ-train`, qty 1, unit price 80); back on `/expenses` the `ZZ-train` row now shows `billed`, the `ZZ-eur` row is still `unbilled`.

- [ ] **Step 5: Filter checks**

Toggle the status filter (All / Unbilled / Billed) and the category filter; confirm rows filter correctly. Confirm the footer totals + per-category totals reflect the filtered set.

- [ ] **Step 6: Clean up all seeded data**

- Delete the generated draft invoice (from the invoice page / invoices list).
- Delete the three `ZZ-` expenses via the row delete action.
- Confirm the uploaded receipt object is gone — deleting an expense does NOT auto-remove its storage object, so remove it explicitly via the Storage API. Run with Supabase MCP `execute_sql` to find any leftover, then remove via the app's `removeReceipt`/Storage API (NOT a raw `delete from storage.objects`):

```sql
select name from storage.objects where bucket_id = 'receipts' order by created_at desc limit 10;
```
Expected after cleanup: no `ZZ-`-related receipts remain; no `ZZ-` expenses; no generated draft invoice.

- [ ] **Step 7: Final regression**

Run: `npm run test`
Expected: full unit suite green (≥ 46 tests — the prior 42 plus the 4+ new expenses cases).

---

## Self-Review

**Spec coverage** (spec §-by-§):
- §2 `expenses` table (Tier 2), each tied to project/client → Task 1 (table) + Task 8 (tier gate). ✓
- §2 `/expenses` page with filters, add/edit/delete, totals → Tasks 5–8. ✓
- §2/§3.1 private `receipts` bucket + signed-URL thumbnails, optional upload → Task 1 (bucket+RLS), Task 3 (`uploadReceipt`/`removeReceipt`/`getReceiptUrl`), Task 6 (upload), Task 8 (open). ✓
- §2 categories preset + custom → `EXPENSE_CATEGORIES` + `<datalist>` (Task 2 + Task 6). ✓
- §2/§6 generate invoice from billable expenses (one line per expense, atomic RPC, stamps billed) → Task 1 (RPC), Task 3 (api), Task 7 (modal). ✓
- §2 tier gating `FEATURES.EXPENSES` → Task 8 page guard; sidebar already wired (Global Constraints). ✓
- §3 data model incl. FK on-delete SET NULL, indexes, RLS, trigger → Task 1. ✓
- §4 per-expense currency stored; RPC bills only matching currency → Task 1 (RPC WHERE), Task 7 (preview filter). ✓
- §7 error handling (`NO_BILLABLE_EXPENSES`, validation toasts) → Task 3 (code), Task 6/7 (toasts). ✓
- §8 testing: unit (`validateReceiptFile`, mapping/totals) + live → Task 2 + Task 9. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output. ✓

**Type consistency:** helper names (`buildExpenseInvoiceLines`, `expenseTotals`, `validateReceiptFile`, `EXPENSE_CATEGORIES`, `RECEIPT_MAX_BYTES`) are used identically across Tasks 2/3/6/7/8. API names (`listExpenses`, `createExpense`, `updateExpense`, `deleteExpense`, `uploadReceipt`, `removeReceipt`, `getReceiptUrl`, `generateInvoiceFromExpenses`) match between Task 3 (def) and Task 4 hooks. Hook names (`useExpenses`, `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense`, `useGenerateInvoiceFromExpenses`) match between Task 4 (def) and Tasks 6/7/8 (use). `ExpensesTable` prop `onOpenReceipt` matches Task 8's `openReceipt`. RPC name `generate_invoice_from_expenses` matches between Task 1 and Task 3. ✓
