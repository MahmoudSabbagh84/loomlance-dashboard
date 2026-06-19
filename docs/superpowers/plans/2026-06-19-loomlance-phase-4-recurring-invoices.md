# Recurring Invoices (Phase 4 sub-project 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tier 1+ freelancers define recurring invoice templates that a daily pg_cron job turns into draft invoices automatically, plus a manual "Generate now".

**Architecture:** One Supabase migration adds the `recurring_invoice_templates` table (RLS + trigger + due index), three `SECURITY DEFINER` functions (an internal `run_recurring_template` worker, the global `generate_due_recurring_invoices` cron entry point, and the user-facing `generate_recurring_invoice_now`), and schedules the cron job. A pure helper module (`src/lib/recurring.js`, unit-tested) holds cadence + line-item validation; the estimated-amount math reuses the existing `invoiceTotals` from `@/lib/money`. A thin API module + TanStack-Query hooks back an `/invoices/recurring` page composed of a table and a create/edit modal that **reuses the existing `LineItemsTable` and `TotalsPanel`** components. Tier gating reuses `hasFeature` / `UpgradeCard`.

**Tech Stack:** React + Vite, react-hook-form (incl. `useFieldArray`), TanStack Query, Sonner toasts, Tailwind design-system components (`@/components/ui/*`), Supabase JS, pg_cron, Vitest.

## Global Constraints

- **Tier gate:** all recurring features require `FEATURES.RECURRING_INVOICES` (tier_1+). The flag and `UPGRADE_COPY[FEATURES.RECURRING_INVOICES]` already exist in `src/lib/tier.js`. There is NO sidebar nav item for recurring (it is reached from the Invoices page) — do not add one.
- **Always draft, no auto-send:** generated invoices are always `status='draft'`. There is NO `auto_send` column.
- **One generation code path:** both the cron job and "Generate now" call the same internal `run_recurring_template(p_template_id)` worker. Do not duplicate the generation logic.
- **`next_run_at` advances from the scheduled date** (`next_run_at := (next_run_at + cadence_interval)::date`), not from `now()`. One invoice per template per run (no catch-up).
- **FK on-delete:** `recurring_invoice_templates.client_id` = `ON DELETE CASCADE`; `project_id` = `ON DELETE SET NULL`; `user_id` = `ON DELETE CASCADE`.
- **Function security:** all three functions are `SECURITY DEFINER`, `set search_path = public`. `run_recurring_template` and `generate_due_recurring_invoices` are revoked from `public, anon, authenticated` (internal/cron only). `generate_recurring_invoice_now` is revoked from `public, anon` and granted to `authenticated`, and must verify the template belongs to `auth.uid()` before generating (raise `UNAUTHORIZED` with `errcode='P0001'` otherwise — already mapped in `lib/errors.js`).
- **Reuse, do not re-implement:** estimated/preview totals use `invoiceTotals(lines)` from `@/lib/money`; the line-item editor is the existing `@/features/invoices/LineItemsTable`; the live total is the existing `@/features/invoices/TotalsPanel`; currency options come from `SUPPORTED_CURRENCIES` in `@/lib/currency`.
- **Errors:** all API calls go through `mapPostgresError`; user-facing strings via `AppError.userMessage`.
- **Commit style:** Conventional Commits, scope `recurring` (e.g. `feat(recurring): ...`). One commit per task.

---

## File Structure

- `supabase/migrations/<ts>_recurring_invoices.sql` — table, indexes, RLS, trigger, 3 functions, cron schedule. **(Task 1)**
- `src/lib/recurring.js` — `CADENCES`, `cadenceLabel`, `validateTemplateLineItems`. **(Task 2)**
- `src/lib/__tests__/recurring.test.js` — unit tests for Task 2. **(Task 2)**
- `src/api/recurring-templates.js` — list/create/update/delete/setActive/generateNow. **(Task 3)**
- `src/hooks/useRecurringTemplates.js` — query + mutation hooks. **(Task 4)**
- `src/features/recurring/RecurringTemplatesTable.jsx` — list table. **(Task 5)**
- `src/features/recurring/RecurringTemplateFormModal.jsx` — create/edit modal (reuses LineItemsTable + TotalsPanel). **(Task 6)**
- `src/pages/RecurringInvoicesPage.jsx` — page (tier-gated). **(Task 7)**
- `src/app/routes.jsx` — register `/invoices/recurring` route (before `invoices/:id`). **(Task 7)**
- `src/pages/InvoicesPage.jsx` — add a "Recurring" button to the header. **(Task 7)**
- Live verification + cleanup. **(Task 8)**

---

## Task 1: Database migration (table, RLS, functions, cron)

**Files:**
- Create: `supabase/migrations/20260619030000_recurring_invoices.sql`

**Interfaces:**
- Produces (DB): table `public.recurring_invoice_templates`; functions `public.run_recurring_template(uuid) returns uuid`, `public.generate_due_recurring_invoices() returns integer`, `public.generate_recurring_invoice_now(uuid) returns uuid`; cron job `generate-recurring-invoices`.
- Consumes (existing DB): `public.set_updated_at()`, `public.next_invoice_number(uuid)`, tables `invoices`, `invoice_line_items`, `clients`, `projects`, `user_notifications`; extension `pg_cron` (already installed).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260619030000_recurring_invoices.sql` with exactly:

```sql
create table public.recurring_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text,
  cadence text not null check (cadence in ('weekly','monthly','quarterly','yearly')),
  line_items jsonb not null,
  currency text not null,
  due_days int not null default 30,
  notes text,
  next_run_at date not null,
  end_date date,
  active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_user_created_idx on public.recurring_invoice_templates (user_id, created_at desc);
create index recurring_due_idx on public.recurring_invoice_templates (next_run_at) where active;

create trigger recurring_set_updated_at before update on public.recurring_invoice_templates
  for each row execute function public.set_updated_at();

alter table public.recurring_invoice_templates enable row level security;
create policy "recurring_select_own" on public.recurring_invoice_templates for select using (user_id = auth.uid());
create policy "recurring_insert_own" on public.recurring_invoice_templates for insert with check (user_id = auth.uid());
create policy "recurring_update_own" on public.recurring_invoice_templates for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recurring_delete_own" on public.recurring_invoice_templates for delete using (user_id = auth.uid());

-- Internal worker: generate ONE invoice from a template, advance the schedule, notify. No auth check.
create or replace function public.run_recurring_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.recurring_invoice_templates%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_interval interval;
  v_next date;
  v_client_name text;
begin
  select * into t from public.recurring_invoice_templates where id = p_template_id;
  if not found or not t.active then
    return null;
  end if;

  v_number := public.next_invoice_number(t.user_id);

  insert into public.invoices (user_id, client_id, project_id, invoice_number, status, currency, issue_date, due_date, notes)
  values (t.user_id, t.client_id, t.project_id, v_number, 'draft', t.currency, current_date, current_date + t.due_days, t.notes)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (user_id, invoice_id, position, description, quantity, unit_price, tax_rate, discount_rate)
  select
    t.user_id, v_invoice_id, (li.ord - 1)::int,
    coalesce(li.elem->>'description', ''),
    coalesce((li.elem->>'quantity')::numeric, 1),
    coalesce((li.elem->>'unit_price')::numeric, 0),
    coalesce((li.elem->>'tax_rate')::numeric, 0),
    coalesce((li.elem->>'discount_rate')::numeric, 0)
  from jsonb_array_elements(t.line_items) with ordinality as li(elem, ord);

  v_interval := case t.cadence
    when 'weekly' then interval '7 days'
    when 'monthly' then interval '1 month'
    when 'quarterly' then interval '3 months'
    when 'yearly' then interval '1 year'
  end;
  v_next := (t.next_run_at + v_interval)::date;

  update public.recurring_invoice_templates
  set next_run_at = v_next,
      last_generated_at = now(),
      active = case when t.end_date is not null and v_next > t.end_date then false else active end
  where id = p_template_id;

  select name into v_client_name from public.clients where id = t.client_id;
  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (
    t.user_id,
    'recurring_invoice_created',
    jsonb_build_object('title', 'Recurring invoice ' || v_number || ' created', 'body', coalesce(v_client_name, 'A client')),
    '/invoices/' || v_invoice_id
  );

  return v_invoice_id;
end;
$$;
revoke all on function public.run_recurring_template(uuid) from public, anon, authenticated;

-- Cron entry point: generate all due templates. Global (runs across users).
create or replace function public.generate_due_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.recurring_invoice_templates
    where active and next_run_at <= current_date and (end_date is null or current_date <= end_date)
  loop
    if public.run_recurring_template(r.id) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.generate_due_recurring_invoices() from public, anon, authenticated;

-- User-facing manual trigger.
create or replace function public.generate_recurring_invoice_now(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.recurring_invoice_templates where id = p_template_id and user_id = v_user) then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  return public.run_recurring_template(p_template_id);
end;
$$;
revoke all on function public.generate_recurring_invoice_now(uuid) from public, anon;
grant execute on function public.generate_recurring_invoice_now(uuid) to authenticated;

-- Schedule daily at 06:30 UTC (after the existing 06:00 overdue + 06:15 due-soon jobs).
select cron.schedule('generate-recurring-invoices', '30 6 * * *', $$select public.generate_due_recurring_invoices();$$);
```

- [ ] **Step 2: Apply the migration to the hosted dev project**

Apply via the Supabase MCP `apply_migration` tool (ToolSearch: `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql`), `project_id: "zbipqfsqxnvrzhpdjvvy"`, `name: "recurring_invoices"`, `query` = the SQL above. (No local Docker — develop against the hosted DB.)

- [ ] **Step 3: Verify the objects exist**

Run via Supabase MCP `execute_sql`:
```sql
select to_regclass('public.recurring_invoice_templates') as tbl,
       (select count(*) from pg_policies where tablename = 'recurring_invoice_templates') as policies,
       to_regprocedure('public.run_recurring_template(uuid)') as worker,
       to_regprocedure('public.generate_due_recurring_invoices()') as cron_fn,
       to_regprocedure('public.generate_recurring_invoice_now(uuid)') as manual_fn,
       (select count(*) from cron.job where jobname = 'generate-recurring-invoices') as cron_job;
```
Expected: `tbl = recurring_invoice_templates`, `policies = 4`, all three procedures non-null, `cron_job = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(recurring): templates table + generation functions + daily cron"
```

---

## Task 2: Pure helpers + unit tests (`src/lib/recurring.js`)

**Files:**
- Create: `src/lib/recurring.js`
- Test: `src/lib/__tests__/recurring.test.js`

**Interfaces:**
- Produces:
  - `CADENCES: Array<{value, label}>` — the four cadences.
  - `cadenceLabel(value): string` — label for a cadence value, falls back to the raw value.
  - `validateTemplateLineItems(items): void` — throws `AppError('UNKNOWN', msg)` if not a non-empty array, or any item lacks a non-empty string `description`.
- Consumes: `AppError` from `@/lib/errors`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/recurring.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { CADENCES, cadenceLabel, validateTemplateLineItems } from '@/lib/recurring'

describe('CADENCES', () => {
  it('has the four cadences', () => {
    expect(CADENCES.map((c) => c.value)).toEqual(['weekly', 'monthly', 'quarterly', 'yearly'])
  })
})

describe('cadenceLabel', () => {
  it('maps a known value', () => expect(cadenceLabel('monthly')).toBe('Monthly'))
  it('falls back to the raw value', () => expect(cadenceLabel('nope')).toBe('nope'))
})

describe('validateTemplateLineItems', () => {
  it('accepts a valid list', () => {
    expect(() => validateTemplateLineItems([{ description: 'Retainer' }])).not.toThrow()
  })
  it('rejects an empty list', () => {
    expect(() => validateTemplateLineItems([])).toThrow(/at least one/i)
  })
  it('rejects a missing description', () => {
    expect(() => validateTemplateLineItems([{ description: '  ' }])).toThrow(/description/i)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/__tests__/recurring.test.js`
Expected: FAIL — `Failed to resolve import "@/lib/recurring"`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/recurring.js`:

```js
import { AppError } from '@/lib/errors'

export const CADENCES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

export function cadenceLabel(value) {
  return CADENCES.find((c) => c.value === value)?.label ?? value
}

export function validateTemplateLineItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('UNKNOWN', 'Add at least one line item.')
  }
  for (const it of items) {
    if (!it || typeof it.description !== 'string' || !it.description.trim()) {
      throw new AppError('UNKNOWN', 'Every line item needs a description.')
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/recurring.test.js`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurring.js src/lib/__tests__/recurring.test.js
git commit -m "feat(recurring): cadence + line-item validation helpers + tests"
```

---

## Task 3: API module (`src/api/recurring-templates.js`)

**Files:**
- Create: `src/api/recurring-templates.js`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`), `AppError`/`mapPostgresError` (`@/lib/errors`).
- Produces (used by Task 4 hooks):
  - `listTemplates(): Promise<row[]>` — rows include `clients(name)`, `projects(name)`.
  - `createTemplate(payload): Promise<row>` — payload keys: `client_id, project_id|null, title, cadence, line_items (array), currency, due_days, notes, next_run_at, end_date|null, active`.
  - `updateTemplate(id, patch): Promise<row>`
  - `deleteTemplate(id): Promise<void>`
  - `setActive(id, active): Promise<row>`
  - `generateNow(templateId): Promise<string>` — new invoice id.

- [ ] **Step 1: Implement the API module**

Create `src/api/recurring-templates.js`:

```js
import { supabase } from '@/lib/supabase'
import { AppError, mapPostgresError } from '@/lib/errors'

const SELECT =
  'id, client_id, project_id, title, cadence, line_items, currency, due_days, notes, next_run_at, end_date, active, last_generated_at, clients(name), projects(name)'

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data?.session?.user?.id
  if (!id) throw new AppError('UNAUTHORIZED', 'You must be signed in.')
  return id
}

export async function listTemplates() {
  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createTemplate(payload) {
  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .insert({ ...payload, user_id: await uid() })
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateTemplate(id, patch) {
  const { data, error } = await supabase
    .from('recurring_invoice_templates')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('recurring_invoice_templates').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function setActive(id, active) {
  return updateTemplate(id, { active })
}

export async function generateNow(templateId) {
  const { data, error } = await supabase.rpc('generate_recurring_invoice_now', { p_template_id: templateId })
  if (error) throw mapPostgresError(error)
  return data // new invoice id
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/api/recurring-templates.js`
Expected: no errors. (API modules in this codebase have no unit tests — verified live in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/api/recurring-templates.js
git commit -m "feat(recurring): templates api (crud, setActive, generate-now)"
```

---

## Task 4: Query/mutation hooks (`src/hooks/useRecurringTemplates.js`)

**Files:**
- Create: `src/hooks/useRecurringTemplates.js`

**Interfaces:**
- Consumes: `* as api` from `@/api/recurring-templates`; `@tanstack/react-query`.
- Produces: `useRecurringTemplates()`, `useCreateTemplate()`, `useUpdateTemplate()` (mutate arg `{ id, patch }`), `useDeleteTemplate()` (mutate arg `id`), `useSetTemplateActive()` (mutate arg `{ id, active }`), `useGenerateNow()` (mutate arg `templateId`). All invalidate `['recurring-templates']`; `useGenerateNow` also invalidates `['invoices']`.

- [ ] **Step 1: Implement the hooks**

Create `src/hooks/useRecurringTemplates.js`:

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/recurring-templates'

export function useRecurringTemplates() {
  return useQuery({ queryKey: ['recurring-templates'], queryFn: api.listTemplates })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['recurring-templates'] })
}

export function useCreateTemplate() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createTemplate, onSuccess: inv })
}
export function useUpdateTemplate() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateTemplate(id, patch), onSuccess: inv })
}
export function useDeleteTemplate() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deleteTemplate, onSuccess: inv })
}
export function useSetTemplateActive() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, active }) => api.setActive(id, active), onSuccess: inv })
}
export function useGenerateNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/hooks/useRecurringTemplates.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRecurringTemplates.js
git commit -m "feat(recurring): templates query/mutation hooks"
```

---

## Task 5: Templates table component (`src/features/recurring/RecurringTemplatesTable.jsx`)

**Files:**
- Create: `src/features/recurring/RecurringTemplatesTable.jsx`

**Interfaces:**
- Consumes: `Table, THead, TR, TH, TD` (`@/components/ui/Table`), `Badge` (`@/components/ui/Badge`), `Button` (`@/components/ui/Button`), `invoiceTotals` (`@/lib/money`), `cadenceLabel` (`@/lib/recurring`), `formatDate` (`@/lib/date`), `formatCurrency` (`@/lib/currency`), icons from `lucide-react`.
- Produces: `export function RecurringTemplatesTable({ templates, onGenerate, onToggleActive, onEdit, onDelete })`.

- [ ] **Step 1: Implement the component**

Create `src/features/recurring/RecurringTemplatesTable.jsx`:

```jsx
import { Play, Pause, FilePlus, Pencil, Trash2 } from 'lucide-react'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { invoiceTotals } from '@/lib/money'
import { cadenceLabel } from '@/lib/recurring'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

function statusBadge(t) {
  const ended = t.end_date && new Date(t.end_date) < new Date(new Date().toISOString().slice(0, 10))
  if (!t.active) return ended ? <Badge>ended</Badge> : <Badge variant="warning">paused</Badge>
  return <Badge variant="success">active</Badge>
}

export function RecurringTemplatesTable({ templates, onGenerate, onToggleActive, onEdit, onDelete }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Template</TH>
          <TH>Cadence</TH>
          <TH>Next run</TH>
          <TH>Status</TH>
          <TH>Est. amount</TH>
          <TH></TH>
        </TR>
      </THead>
      <tbody>
        {templates.map((t) => (
          <TR key={t.id}>
            <TD>
              <div className="font-medium">{t.title || 'Untitled'}</div>
              <div className="text-xs text-fg-muted">{t.clients?.name || '—'}</div>
            </TD>
            <TD>{cadenceLabel(t.cadence)}</TD>
            <TD className="text-xs tabular-nums text-fg-muted">{formatDate(t.next_run_at)}</TD>
            <TD>{statusBadge(t)}</TD>
            <TD className="tabular-nums">{formatCurrency(invoiceTotals(t.line_items || []).total, t.currency)}</TD>
            <TD>
              <div className="flex justify-end gap-1">
                <button onClick={() => onGenerate(t)} className="text-fg-subtle hover:text-fg" aria-label="Generate now">
                  <FilePlus className="size-4" />
                </button>
                <button onClick={() => onToggleActive(t)} className="text-fg-subtle hover:text-fg" aria-label={t.active ? 'Pause' : 'Resume'}>
                  {t.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button onClick={() => onEdit(t)} className="text-fg-subtle hover:text-fg" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(t)} className="text-fg-subtle hover:text-danger" aria-label="Delete">
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

Run: `npm run lint -- src/features/recurring/RecurringTemplatesTable.jsx`
Expected: no errors. (If `Badge` has no `warning` variant, the lint still passes; visual variant is verified in Task 8 — but the codebase `Badge` supports `success`/`info`/`warning`/`danger` per existing usage.)

- [ ] **Step 3: Commit**

```bash
git add src/features/recurring/RecurringTemplatesTable.jsx
git commit -m "feat(recurring): templates list table"
```

---

## Task 6: Template form modal (`src/features/recurring/RecurringTemplateFormModal.jsx`)

**Files:**
- Create: `src/features/recurring/RecurringTemplateFormModal.jsx`

**Interfaces:**
- Consumes: `react-hook-form` `useForm`; `toast` (`sonner`); UI `Modal, Button, Input, Select, Textarea, Label`; the existing `LineItemsTable` (`@/features/invoices/LineItemsTable`) and `TotalsPanel` (`@/features/invoices/TotalsPanel`); `useClients`, `useProjects`, `useProfile`; `useCreateTemplate, useUpdateTemplate` (`@/hooks/useRecurringTemplates`); `CADENCES, validateTemplateLineItems` (`@/lib/recurring`); `SUPPORTED_CURRENCIES` (`@/lib/currency`).
- Produces: `export function RecurringTemplateFormModal({ open, onClose, template })` — `template` null ⇒ create, else edit.
- Note: `LineItemsTable` expects the field-array name `line_items` and `{ control, register }` props; `TotalsPanel` expects `{ control }` and reads `line_items` + `currency`. `useClients({pageSize:200})` returns `{ rows }`; `useProjects({status:'all'})` returns an array.

- [ ] **Step 1: Implement the modal**

Create `src/features/recurring/RecurringTemplateFormModal.jsx`:

```jsx
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { LineItemsTable } from '@/features/invoices/LineItemsTable'
import { TotalsPanel } from '@/features/invoices/TotalsPanel'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/useRecurringTemplates'
import { CADENCES, validateTemplateLineItems } from '@/lib/recurring'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

const EMPTY_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0 }

export function RecurringTemplateFormModal({ open, onClose, template }) {
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const { data: projects = [] } = useProjects({ status: 'all' })
  const { data: profile } = useProfile()
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const isEdit = !!template

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      title: template?.title ?? '',
      client_id: template?.client_id ?? '',
      project_id: template?.project_id ?? '',
      currency: template?.currency ?? profile?.default_currency ?? 'USD',
      cadence: template?.cadence ?? 'monthly',
      next_run_at: (template?.next_run_at ?? new Date().toISOString()).slice(0, 10),
      end_date: template?.end_date ?? '',
      due_days: template?.due_days ?? 30,
      notes: template?.notes ?? '',
      line_items: template?.line_items?.length
        ? template.line_items.map((li) => ({
            description: li.description ?? '',
            quantity: Number(li.quantity ?? 1),
            unit_price: Number(li.unit_price ?? 0),
            tax_rate: Number(li.tax_rate ?? 0),
            discount_rate: Number(li.discount_rate ?? 0),
          }))
        : [{ ...EMPTY_LINE }],
    },
  })

  const onSubmit = async (v) => {
    const line_items = (v.line_items || []).map((li) => ({
      description: li.description,
      quantity: Number(li.quantity) || 0,
      unit_price: Number(li.unit_price) || 0,
      tax_rate: Number(li.tax_rate) || 0,
      discount_rate: Number(li.discount_rate) || 0,
    }))
    try {
      validateTemplateLineItems(line_items)
    } catch (e) {
      toast.error(e.userMessage || 'Check the line items')
      return
    }
    if (!v.client_id) {
      toast.error('Pick a client')
      return
    }
    const payload = {
      title: v.title,
      client_id: v.client_id,
      project_id: v.project_id || null,
      currency: v.currency,
      cadence: v.cadence,
      next_run_at: v.next_run_at,
      end_date: v.end_date || null,
      due_days: Number(v.due_days) || 30,
      notes: v.notes,
      line_items,
      active: template?.active ?? true,
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: template.id, patch: payload })
      } else {
        await create.mutateAsync(payload)
      }
      toast.success(isEdit ? 'Template updated' : 'Template created')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not save')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit recurring template' : 'New recurring template'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="e.g. Acme monthly retainer" {...register('title')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="client_id" required>Client</Label>
            <Select id="client_id" {...register('client_id', { required: true })}>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="project_id">Project (optional)</Label>
            <Select id="project_id" {...register('project_id')}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="cadence">Cadence</Label>
            <Select id="cadence" {...register('cadence')}>
              {CADENCES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="next_run_at">Starts on</Label>
            <Input id="next_run_at" type="date" {...register('next_run_at')} />
          </div>
          <div>
            <Label htmlFor="end_date">End date</Label>
            <Input id="end_date" type="date" {...register('end_date')} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="due_days">Due in (days)</Label>
            <Input id="due_days" type="number" min="0" {...register('due_days')} />
          </div>
        </div>
        <div>
          <Label>Line items</Label>
          <LineItemsTable control={control} register={register} />
        </div>
        <TotalsPanel control={control} />
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} {...register('notes')} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create template'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/features/recurring/RecurringTemplateFormModal.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/recurring/RecurringTemplateFormModal.jsx
git commit -m "feat(recurring): create/edit template modal (reuses line-items + totals)"
```

---

## Task 7: Page + route + Invoices link

**Files:**
- Create: `src/pages/RecurringInvoicesPage.jsx`
- Modify: `src/app/routes.jsx` (import + child route before `invoices/:id`)
- Modify: `src/pages/InvoicesPage.jsx` (add a "Recurring" header button)

**Interfaces:**
- Consumes: UI `PageHeader, Button, Skeleton, EmptyState, ConfirmDialog`; `UpgradeCard` (`@/components/gates/UpgradeCard`); `useProfile`; `useRecurringTemplates, useDeleteTemplate, useSetTemplateActive, useGenerateNow` (`@/hooks/useRecurringTemplates`); `hasFeature, FEATURES` (`@/lib/tier`); the two `@/features/recurring/*` components; `useNavigate`, `Link` from `react-router-dom`.
- Default export `RecurringInvoicesPage`.

- [ ] **Step 1: Implement the page**

Create `src/pages/RecurringInvoicesPage.jsx`:

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Repeat, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradeCard } from '@/components/gates/UpgradeCard'
import { useProfile } from '@/hooks/useProfile'
import {
  useRecurringTemplates,
  useDeleteTemplate,
  useSetTemplateActive,
  useGenerateNow,
} from '@/hooks/useRecurringTemplates'
import { hasFeature, FEATURES } from '@/lib/tier'
import { RecurringTemplatesTable } from '@/features/recurring/RecurringTemplatesTable'
import { RecurringTemplateFormModal } from '@/features/recurring/RecurringTemplateFormModal'

export default function RecurringInvoicesPage() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const { data: templates = [], isLoading } = useRecurringTemplates()
  const del = useDeleteTemplate()
  const setActive = useSetTemplateActive()
  const gen = useGenerateNow()

  if (!hasFeature(tier, FEATURES.RECURRING_INVOICES)) {
    return (
      <div className="space-y-5">
        <PageHeader title="Recurring invoices" />
        <UpgradeCard feature={FEATURES.RECURRING_INVOICES} currentTier={tier} target="tier_1" />
      </div>
    )
  }

  const onGenerate = async (t) => {
    try {
      const id = await gen.mutateAsync(t.id)
      toast.success('Draft invoice created')
      navigate(`/invoices/${id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not generate invoice')
    }
  }

  const onToggleActive = async (t) => {
    try {
      await setActive.mutateAsync({ id: t.id, active: !t.active })
      toast.success(t.active ? 'Paused' : 'Resumed')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Recurring invoices" subtitle="Templates that bill on a schedule">
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to="/invoices"><ArrowLeft className="size-4" /> Invoices</Link>
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="size-4" /> New template
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring templates"
          description="Create a template to auto-generate draft invoices on a schedule."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New template</Button>}
        />
      ) : (
        <RecurringTemplatesTable
          templates={templates}
          onGenerate={onGenerate}
          onToggleActive={onToggleActive}
          onEdit={(t) => { setEditing(t); setFormOpen(true) }}
          onDelete={setToDelete}
        />
      )}

      {formOpen ? <RecurringTemplateFormModal open onClose={() => setFormOpen(false)} template={editing} /> : null}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete template?"
        body="This stops future invoices from this template. Already-generated invoices are kept."
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
            toast.error(e.userMessage || 'Could not delete')
          }
        }}
      />
    </div>
  )
}
```

Note: `Button asChild` wrapping a `Link` is the established pattern for link-buttons in this codebase. If `Button` does not support `asChild`, replace that block with `<Button variant="secondary" onClick={() => navigate('/invoices')}><ArrowLeft className="size-4" /> Invoices</Button>` and drop the `Link` import. Verify which form the `Button` component supports by reading `src/components/ui/Button.jsx` before implementing, and use the supported one.

- [ ] **Step 2: Register the route (before `invoices/:id`)**

In `src/app/routes.jsx`, add the import after the `InvoicesPage`/`InvoiceDetailPage` imports (near line 15):

```jsx
import RecurringInvoicesPage from '@/pages/RecurringInvoicesPage'
```

And add this child route **immediately before** the `{ path: 'invoices/:id', element: <InvoiceDetailPage /> },` line (so the literal segment wins over the `:id` param):

```jsx
      { path: 'invoices/recurring', element: <RecurringInvoicesPage /> },
```

- [ ] **Step 3: Add the "Recurring" button to the Invoices page header**

In `src/pages/InvoicesPage.jsx`, the header currently is:

```jsx
      <PageHeader title="Invoices" subtitle="Drafts, sent, paid, and overdue">
        <Button onClick={handleNew} loading={create.isPending}><Plus className="size-4" /> New invoice</Button>
      </PageHeader>
```

Replace it with (adds a secondary Recurring button that navigates to the new page; `navigate` and `Button` are already imported in this file, and `Repeat` is added to the existing `lucide-react` import):

```jsx
      <PageHeader title="Invoices" subtitle="Drafts, sent, paid, and overdue">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/invoices/recurring')}><Repeat className="size-4" /> Recurring</Button>
          <Button onClick={handleNew} loading={create.isPending}><Plus className="size-4" /> New invoice</Button>
        </div>
      </PageHeader>
```

And update the `lucide-react` import line (currently `import { Plus, FileText, List, LayoutGrid } from 'lucide-react'`) to include `Repeat`:

```jsx
import { Plus, FileText, List, LayoutGrid, Repeat } from 'lucide-react'
```

- [ ] **Step 4: Verify build + tests + lint**

Run: `npm run lint` then `npm run test` then `npm run build`
Expected: lint clean; all unit tests pass (incl. the new `recurring.test.js`); production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RecurringInvoicesPage.jsx src/app/routes.jsx src/pages/InvoicesPage.jsx
git commit -m "feat(recurring): /invoices/recurring page, route, and Invoices link"
```

---

## Task 8: Live verification + cleanup

**Files:** none (manual verification against the hosted dev project via Supabase MCP + UI).

**Pre-req:** the test user is **tier-2** (uid resolvable via MCP). Use `ZZ-` markers on seeded rows. To call the user-scoped RPC via MCP, prefix `select set_config('request.jwt.claims','{"sub":"<uid>","role":"authenticated"}', true);` in the SAME `execute_sql` call.

- [ ] **Step 1: Find the test user + a client**

```sql
select id as user_id, default_currency,
  (select id from clients where user_id = p.id order by created_at limit 1) as client_id
from profiles p where subscription_tier = 'tier_2' order by created_at limit 1;
```

- [ ] **Step 2: Seed a due template (cron path)**

Insert a template with `next_run_at = current_date`, monthly, two line items, `ZZ-` title (service role bypasses RLS; set `user_id` explicitly):
```sql
insert into public.recurring_invoice_templates
  (user_id, client_id, title, cadence, line_items, currency, due_days, next_run_at, active)
values
  ('<user_id>', '<client_id>', 'ZZ-retainer', 'monthly',
   '[{"description":"ZZ-Retainer","quantity":1,"unit_price":500,"tax_rate":0,"discount_rate":0},
     {"description":"ZZ-Hosting","quantity":2,"unit_price":25,"tax_rate":10,"discount_rate":0}]'::jsonb,
   'USD', 30, current_date, true)
returning id, next_run_at;
```

- [ ] **Step 3: Run the cron function and verify generation**

```sql
select public.generate_due_recurring_invoices() as generated_count;
```
Then verify (expect: 1 generated; a draft invoice with 2 line items; template `next_run_at` advanced by 1 month; `last_generated_at` set; a `recurring_invoice_created` notification):
```sql
select i.invoice_number, i.status, i.currency, i.due_date::text,
       li.position, li.description, li.quantity, li.unit_price, li.tax_rate
from invoices i join invoice_line_items li on li.invoice_id = i.id
where i.client_id = '<client_id>' and li.description like 'ZZ-%'
order by i.created_at desc, li.position;

select title, next_run_at::text, last_generated_at is not null as ran, active
from recurring_invoice_templates where title = 'ZZ-retainer';

select kind, payload->>'title' as title, link_to
from user_notifications where kind = 'recurring_invoice_created' order by created_at desc limit 1;
```

- [ ] **Step 4: Verify the manual RPC + ownership guard**

Manual generate for the same template as the test user (advances `next_run_at` again):
```sql
select set_config('request.jwt.claims', '{"sub":"<user_id>","role":"authenticated"}', true);
select public.generate_recurring_invoice_now('<template_id>') as new_invoice_id;
```
Then confirm the ownership guard rejects a different user (expect ERROR `UNAUTHORIZED`):
```sql
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
select public.generate_recurring_invoice_now('<template_id>');
```

- [ ] **Step 5: Verify the end_date flip**

```sql
update recurring_invoice_templates set next_run_at = current_date, end_date = current_date - 1 where title = 'ZZ-retainer';
select public.generate_due_recurring_invoices();
-- end_date is in the past, so the WHERE excludes it → 0 generated, template untouched by the run.
-- Now test the in-run flip: set a future-but-soon end so it generates then deactivates:
update recurring_invoice_templates set next_run_at = current_date, end_date = current_date where title = 'ZZ-retainer';
select public.generate_due_recurring_invoices();
select active, next_run_at::text from recurring_invoice_templates where title = 'ZZ-retainer';
-- Expect: active = false (next_run_at advanced past end_date), one more invoice generated.
```

- [ ] **Step 6: UI smoke check (optional but recommended)**

As the tier-2 user in the running app: open Invoices → **Recurring** → **New template** (client, monthly, two lines, see the live total) → save; the row shows cadence/next-run/est amount; click **Generate now** → navigates to a new draft invoice; pause/resume toggles the status badge.

- [ ] **Step 7: Clean up all seeded data**

```sql
-- delete generated ZZ- invoices (line items cascade) for this user
delete from invoice_line_items li using invoices i
  where li.invoice_id = i.id and i.user_id = '<user_id>'
    and exists (select 1 from invoice_line_items x where x.invoice_id = i.id and x.description like 'ZZ-%');
delete from invoices i where i.user_id = '<user_id>'
    and i.id in (select invoice_id from invoice_line_items where description like 'ZZ-%');
delete from recurring_invoice_templates where title = 'ZZ-retainer';
delete from user_notifications where kind = 'recurring_invoice_created' and user_id = '<user_id>';
select
  (select count(*) from recurring_invoice_templates where title = 'ZZ-retainer') as templates_left,
  (select count(*) from invoice_line_items where description like 'ZZ-%') as zz_lines_left;
```
Expected after cleanup: `templates_left = 0`, `zz_lines_left = 0`. (Note: invoice numbers consumed during testing are not reclaimed — same as prior sub-projects' live tests.)

- [ ] **Step 8: Final regression**

Run: `npm run test`
Expected: full unit suite green (prior 49 + the new `recurring.test.js` cases).

---

## Self-Review

**Spec coverage** (spec §-by-§):
- §2 `recurring_invoice_templates` table (Tier 1+) → Task 1 (table) + Task 7 (tier gate). ✓
- §2 daily pure-SQL pg_cron job generating drafts, advancing next_run_at, notifying, flipping active on end_date → Task 1 (`generate_due_recurring_invoices` + `run_recurring_template` + cron schedule). ✓
- §2 "Generate now" RPC → Task 1 (`generate_recurring_invoice_now`), Task 3 (`generateNow`), Task 7 (button). ✓
- §2 `/invoices/recurring` UI: list, create/edit modal, pause/resume, delete, Generate now, reached from Invoices → Tasks 5, 6, 7. ✓
- §3 data model incl. FK CASCADE/SET NULL, due index, RLS, trigger, check constraint → Task 1. ✓
- §4 scheduling (user picks first run; advance from scheduled date; due predicate; end_date flip) → Task 1 (`run_recurring_template`, `generate_due_recurring_invoices`), Task 6 (Starts on field). ✓
- §5 three functions with exact security/grant pattern → Task 1. ✓
- §6.1 API → Task 3; §6.2 helpers (reuse `invoiceTotals`) → Task 2 + Tasks 5/6; §6.3 page + form reusing LineItemsTable/TotalsPanel → Tasks 6, 7; §6.4 Invoices button + route ordering → Task 7. ✓
- §7 error handling (UNAUTHORIZED, validation toasts) → Task 1 + Task 6. ✓
- §8 testing (unit + live) → Task 2 + Task 8. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output. The two "verify which form the component supports" notes (Button `asChild`, Badge `warning`) are explicit fallbacks with concrete instructions, not placeholders. ✓

**Type consistency:** helper names (`CADENCES`, `cadenceLabel`, `validateTemplateLineItems`) consistent across Tasks 2/5/6. API names (`listTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `setActive`, `generateNow`) match between Task 3 and Task 4. Hook names (`useRecurringTemplates`, `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`, `useSetTemplateActive`, `useGenerateNow`) match between Task 4 and Tasks 6/7. Table props (`onGenerate`, `onToggleActive`, `onEdit`, `onDelete`) match between Task 5 and Task 7. RPC names (`run_recurring_template`, `generate_due_recurring_invoices`, `generate_recurring_invoice_now`) match between Task 1 and Task 3. ✓
