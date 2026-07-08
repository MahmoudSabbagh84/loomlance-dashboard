# Scope-Creep Change Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Structured change requests a client approves on a hosted `/cr/:token` page, then one-click billed into a draft invoice.

**Architecture:** New `change_requests` table (RLS owner-only) + four SECURITY DEFINER RPCs mirroring the invoice public-link pattern (`send`, `get_public`, `respond`, `regenerate`). A "Change requests" panel on the project detail page (create/send/share/bill), and a public approve/decline page styled like `PublicInvoicePage`. "Bill this change" reuses `createInvoice`.

**Tech Stack:** Postgres (hosted `zbipqfsqxnvrzhpdjvvy`), React 18 + React Router v6 + TanStack Query v5 + sonner, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-08-scope-creep-change-requests-design.md` · **Linear:** "Scope-Creep Change Requests"

## Global Constraints

- Repo: `C:\Users\mahmo\Desktop\LoomLance-Dashboard`. Commit after every task. Do NOT `git push`.
- Migrations applied to the hosted project via `mcp__supabase__apply_migration`; committed filename must equal the version recorded in `supabase_migrations.schema_migrations` (check after applying — this bit us before).
- The hosted DB is LIVE PRODUCTION. Reads unrestricted; all migration/RPC verification runs inside `begin … rollback` with ZZ-marked throwaway rows — never leave test data. No client approve/decline against real data in e2e.
- RLS is the security boundary; the public page reaches data ONLY through the gated RPCs.
- Public site base URL for links: `import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin`, path `/cr/<token>` (mirrors invoices' `/i/<token>`).
- Money: derive amount with `round2(hours * rate)` (round to 2 dp); `amount` is the billed source of truth. Format with `formatCurrency(amount, currency)` from `@/lib/currency`.
- UI kit via `import { X } from '@/components/ui/X'`; toasts via `sonner`; errors via `mapPostgresError` (`@/lib/errors`); relative/absolute dates via `@/lib/date`. **Every UI task runs the Impeccable skill pass before commit.**
- Tests: `npx vitest run` (baseline 251 green), `npx playwright test` (admin creds `admin@loomlance.com` / `JSQCNfFApBLxi1Y7uZBX5QXw`; `happy-path` etc. must stay green).

---

### Task 1: Migration — `change_requests` table + 4 RPCs

**Files:**
- Create: `supabase/migrations/<applied-version>_change_requests.sql`

**Interfaces:**
- Produces: table `public.change_requests`; RPCs `send_change_request(uuid)`, `regenerate_change_request_link(uuid)` (owner-only, return token), `get_public_change_request(text)` (anon read → jsonb|null), `respond_to_change_request(text, text, text, text)` (anon write → jsonb). Consumed by Task 3.

- [ ] **Step 1: Write the migration**

```sql
create type change_request_status as enum ('draft', 'sent', 'approved', 'declined');

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text not null default '',
  currency text not null,
  amount numeric not null default 0,
  hours numeric,
  hourly_rate numeric,
  added_days integer,
  status change_request_status not null default 'draft',
  public_token text unique,
  link_expires_at timestamptz,
  sent_at timestamptz,
  decided_at timestamptz,
  approver_name text,
  decline_reason text,
  billed_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_project_idx on public.change_requests (project_id);

alter table public.change_requests enable row level security;
create policy change_requests_owner_all on public.change_requests
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger change_requests_set_updated_at
  before update on public.change_requests
  for each row execute function public.set_updated_at();

-- Owner: issue the public link + mark sent (SECURITY DEFINER with an explicit ownership guard).
create or replace function public.send_change_request(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  update public.change_requests
     set status = case when status = 'draft' then 'sent' else status end,
         sent_at = coalesce(sent_at, now()),
         public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', ''))
   where id = p_id and user_id = auth.uid()
   returning public_token into v_token;
  return v_token;   -- null if not found / not owner
end;
$$;

-- Owner: rotate the link (invalidates the old URL).
create or replace function public.regenerate_change_request_link(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  update public.change_requests set public_token = v_token
   where id = p_id and user_id = auth.uid();
  if not found then return null; end if;
  return v_token;
end;
$$;

-- Public read: curated display fields by token; null on missing/expired.
create or replace function public.get_public_change_request(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cr record;
begin
  select r.id, r.title, r.description, r.currency, r.amount, r.hours, r.hourly_rate,
         r.added_days, r.status, r.decided_at, r.approver_name, r.link_expires_at,
         p.business_name, p.logo_url, p.invoice_accent_color, p.invoice_footer,
         c.name as client_name, c.company as client_company
    into cr
    from public.change_requests r
    join public.profiles p on p.id = r.user_id
    left join public.clients c on c.id = r.client_id
   where r.public_token = p_token;

  if not found then return null; end if;
  if cr.link_expires_at is not null and cr.link_expires_at < now() then return null; end if;

  return jsonb_build_object(
    'title', cr.title, 'description', cr.description, 'currency', cr.currency,
    'amount', cr.amount, 'hours', cr.hours, 'hourly_rate', cr.hourly_rate, 'added_days', cr.added_days,
    'status', cr.status, 'already_decided', cr.status in ('approved','declined'),
    'approver_name', cr.approver_name, 'decided_at', cr.decided_at,
    'business_name', cr.business_name, 'logo_url', cr.logo_url,
    'accent_color', cr.invoice_accent_color, 'footer', cr.invoice_footer,
    'client_name', cr.client_name, 'client_company', cr.client_company
  );
end;
$$;

-- Public write: approve/decline. Idempotent — only a 'sent' request is decidable.
create or replace function public.respond_to_change_request(
  p_token text, p_decision text, p_approver_name text default null, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare cr record; v_new change_request_status;
begin
  select * into cr from public.change_requests where public_token = p_token;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if cr.link_expires_at is not null and cr.link_expires_at < now() then
    return jsonb_build_object('error', 'not_found');
  end if;
  if cr.status <> 'sent' then
    return jsonb_build_object('status', cr.status, 'already', true);
  end if;
  if p_decision not in ('approve', 'decline') then
    return jsonb_build_object('error', 'bad_decision');
  end if;

  v_new := case when p_decision = 'approve' then 'approved' else 'declined' end::change_request_status;
  update public.change_requests
     set status = v_new, decided_at = now(),
         approver_name = case when p_decision = 'approve' then p_approver_name else approver_name end,
         decline_reason = case when p_decision = 'decline' then p_reason else decline_reason end
   where id = cr.id;

  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (
    cr.user_id,
    case when p_decision = 'approve' then 'change_request_approved' else 'change_request_declined' end,
    jsonb_build_object('title', 'Change request ' || v_new::text,
                       'body', cr.title || (case when p_decision='approve' then ' was approved' else ' was declined' end)),
    '/projects/' || cr.project_id::text
  );

  return jsonb_build_object('status', v_new, 'ok', true);
end;
$$;

grant execute on function public.send_change_request(uuid) to authenticated;
grant execute on function public.regenerate_change_request_link(uuid) to authenticated;
grant execute on function public.get_public_change_request(text) to anon, authenticated;
grant execute on function public.respond_to_change_request(text, text, text, text) to anon, authenticated;
```

- [ ] **Step 2: Apply via `mcp__supabase__apply_migration`** (name `change_requests`); fetch the recorded version; save the file with the matching name.

- [ ] **Step 3: Verify with a rollback probe** (`mcp__supabase__execute_sql`, all in one transaction):

```sql
begin;
-- throwaway CR owned by the admin user, on their first project
insert into public.change_requests (user_id, project_id, client_id, title, currency, amount, hours, hourly_rate, added_days, status)
select u.id, p.id, p.client_id, 'ZZ probe change', 'USD', 800, 8, 100, 3, 'draft'
from auth.users u join public.projects p on p.user_id = u.id
where u.email = 'admin@loomlance.com' limit 1;

-- send (issues token), then read it publicly
select public.send_change_request((select id from public.change_requests where title = 'ZZ probe change'));
select public.get_public_change_request((select public_token from public.change_requests where title = 'ZZ probe change')) ->> 'status' as public_status;

-- approve, then approve again (2nd is a no-op)
select public.respond_to_change_request((select public_token from public.change_requests where title='ZZ probe change'), 'approve', 'Jane Client', null) as first_response;
select public.respond_to_change_request((select public_token from public.change_requests where title='ZZ probe change'), 'approve', 'Someone Else', null) as second_response;
select status, approver_name, decided_at is not null as decided from public.change_requests where title='ZZ probe change';
select count(*) as notif_count from public.user_notifications where kind = 'change_request_approved' and created_at > now() - interval '1 minute';
rollback;

-- anon cannot read the table directly
set role anon; select count(*) from public.change_requests; reset role;  -- expect: permission denied
select count(*) as residue from public.change_requests where title = 'ZZ probe change';  -- expect 0
```
Expected: `public_status = sent`; `first_response` has `ok:true, status:approved`; `second_response` has `already:true, status:approved`; row shows `approved`, approver `Jane Client`, decided true; `notif_count = 1`; anon select → permission denied; residue 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_change_requests.sql
git commit -m "feat(db): change_requests table + public send/get/respond/regenerate RPCs"
```

---

### Task 2: Pure helpers (TDD)

**Files:**
- Create: `src/lib/changeRequest.js`
- Test: `src/lib/__tests__/changeRequest.test.js`

**Interfaces:**
- Produces: `deriveAmount({ amount, hours, hourly_rate })` → number (hours×rate rounded to 2dp when both present, else the given amount || 0); `decisionState(status)` → `'decidable' | 'already' | 'invalid'` (sent→decidable, approved/declined→already, else invalid). Consumed by Tasks 4 & 5.

- [ ] **Step 1: Write the failing tests**

```javascript
import { describe, it, expect } from 'vitest'
import { deriveAmount, decisionState } from '@/lib/changeRequest'

describe('deriveAmount', () => {
  it('computes hours × rate rounded to 2dp when both are present', () => {
    expect(deriveAmount({ hours: 8, hourly_rate: 100 })).toBe(800)
    expect(deriveAmount({ hours: 1.5, hourly_rate: 133.33 })).toBe(200) // 199.995 → 200.00
  })
  it('falls back to the entered amount when hours/rate are incomplete', () => {
    expect(deriveAmount({ amount: 500 })).toBe(500)
    expect(deriveAmount({ amount: 500, hours: 8 })).toBe(500)   // rate missing
    expect(deriveAmount({})).toBe(0)
  })
})

describe('decisionState', () => {
  it('classifies by status', () => {
    expect(decisionState('sent')).toBe('decidable')
    expect(decisionState('approved')).toBe('already')
    expect(decisionState('declined')).toBe('already')
    expect(decisionState('draft')).toBe('invalid')
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/__tests__/changeRequest.test.js` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```javascript
// src/lib/changeRequest.js — pure helpers for scope-creep change requests.
const round2 = (n) => Math.round(n * 100) / 100

export function deriveAmount({ amount, hours, hourly_rate } = {}) {
  const h = Number(hours)
  const r = Number(hourly_rate)
  if (hours != null && hourly_rate != null && !Number.isNaN(h) && !Number.isNaN(r)) {
    return round2(h * r)
  }
  return Number(amount) || 0
}

export function decisionState(status) {
  if (status === 'sent') return 'decidable'
  if (status === 'approved' || status === 'declined') return 'already'
  return 'invalid'
}
```

- [ ] **Step 4: Run** — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/changeRequest.js src/lib/__tests__/changeRequest.test.js
git commit -m "feat(change-requests): pure amount-derivation + decision-state helpers"
```

---

### Task 3: API + hooks

**Files:**
- Create: `src/api/changeRequests.js`, `src/api/publicChangeRequest.js`, `src/hooks/useChangeRequests.js`

**Interfaces:**
- Consumes: RPCs from Task 1; `createInvoice`/`nextInvoiceNumber` from `@/api/invoices`.
- Produces: API fns + hooks used by Tasks 4 & 5. Hook names: `useChangeRequests(projectId)`, `useCreateChangeRequest()`, `useUpdateChangeRequest()`, `useDeleteChangeRequest()`, `useSendChangeRequest()`, `useRegenerateChangeRequestLink()`, `useBillChangeRequest()`, `usePublicChangeRequest(token)`, `useRespondToChangeRequest()`.

- [ ] **Step 1: `src/api/changeRequests.js`**

```javascript
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { createInvoice, nextInvoiceNumber } from '@/api/invoices'

const COLS = 'id, user_id, project_id, contract_id, client_id, title, description, currency, amount, hours, hourly_rate, added_days, status, public_token, link_expires_at, sent_at, decided_at, approver_name, decline_reason, billed_invoice_id, created_at, updated_at'

export async function listChangeRequests(projectId) {
  const { data, error } = await supabase.from('change_requests').select(COLS)
    .eq('project_id', projectId).order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data
}

export async function createChangeRequest(input) {
  const { data: session } = await supabase.auth.getSession()
  const user_id = session?.session?.user?.id
  const { data, error } = await supabase.from('change_requests').insert({ ...input, user_id }).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateChangeRequest(id, patch) {
  const { data, error } = await supabase.from('change_requests').update(patch).eq('id', id).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteChangeRequest(id) {
  const { error } = await supabase.from('change_requests').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function sendChangeRequest(id) {
  const { data, error } = await supabase.rpc('send_change_request', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}

export async function regenerateChangeRequestLink(id) {
  const { data, error } = await supabase.rpc('regenerate_change_request_link', { p_id: id })
  if (error) throw mapPostgresError(error)
  return data // token
}

// Approved change → a draft invoice with the change as a single line item.
export async function billChangeRequest(cr) {
  const invoice_number = await nextInvoiceNumber()
  const today = new Date().toISOString().slice(0, 10)
  const invoice = await createInvoice({
    client_id: cr.client_id, project_id: cr.project_id, invoice_number,
    issue_date: today, due_date: today, currency: cr.currency,
    line_items: [{
      description: cr.title,
      quantity: cr.hours ?? 1,
      unit_price: cr.hourly_rate ?? cr.amount,
      tax_rate: 0, discount_rate: 0,
    }],
  })
  await updateChangeRequest(cr.id, { billed_invoice_id: invoice.id })
  return invoice
}
```

- [ ] **Step 2: `src/api/publicChangeRequest.js`**

```javascript
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function getPublicChangeRequest(token) {
  const { data, error } = await supabase.rpc('get_public_change_request', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data // curated jsonb, or null
}

export async function respondToChangeRequest({ token, decision, approverName, reason }) {
  const { data, error } = await supabase.rpc('respond_to_change_request', {
    p_token: token, p_decision: decision, p_approver_name: approverName ?? null, p_reason: reason ?? null,
  })
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 3: `src/hooks/useChangeRequests.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/changeRequests'
import * as pub from '@/api/publicChangeRequest'

export function useChangeRequests(projectId) {
  return useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: () => api.listChangeRequests(projectId),
    enabled: !!projectId,
  })
}

function useCRMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests'] }),
  })
}

export function useCreateChangeRequest() { return useCRMutation(api.createChangeRequest) }
export function useUpdateChangeRequest() { return useCRMutation(({ id, patch }) => api.updateChangeRequest(id, patch)) }
export function useDeleteChangeRequest() { return useCRMutation(api.deleteChangeRequest) }
export function useSendChangeRequest() { return useCRMutation(api.sendChangeRequest) }
export function useRegenerateChangeRequestLink() { return useCRMutation(api.regenerateChangeRequestLink) }
export function useBillChangeRequest() { return useCRMutation(api.billChangeRequest) }

export function usePublicChangeRequest(token) {
  return useQuery({
    queryKey: ['public-change-request', token],
    queryFn: () => pub.getPublicChangeRequest(token),
    enabled: !!token,
    retry: false,
  })
}
export function useRespondToChangeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: pub.respondToChangeRequest,
    onSuccess: (_, { token }) => qc.invalidateQueries({ queryKey: ['public-change-request', token] }),
  })
}
```

- [ ] **Step 4: Verify build** — `npx vitest run` — all existing tests pass (hooks exercised by Tasks 4/5). Confirm no import errors: `npx vite build`.

- [ ] **Step 5: Commit**

```bash
git add src/api/changeRequests.js src/api/publicChangeRequest.js src/hooks/useChangeRequests.js
git commit -m "feat(change-requests): API + react-query hooks (incl. bill-this-change)"
```

---

### Task 4: `ChangeRequestsPanel` on the project page (TDD + Impeccable)

**Files:**
- Create: `src/features/projects/ChangeRequestsPanel.jsx`, `src/features/projects/ChangeRequestModal.jsx`
- Modify: `src/pages/ProjectDetailPage.jsx` (render the panel after `ProjectFinancialsPanel`)
- Test: `src/features/projects/__tests__/ChangeRequestsPanel.test.jsx`

**Interfaces:**
- Consumes: hooks from Task 3; `deriveAmount` from `@/lib/changeRequest`; kit components; `formatCurrency`, `relativeTime`.
- Produces: `<ChangeRequestsPanel project={project} />`.

- [ ] **Step 1: Write the failing tests** — mock `@/hooks/useChangeRequests` (all exports the panel imports) and `sonner`. Cases:

```jsx
// 1. list renders a request row with its status Badge text and formatted amount
// 2. an approved (not-yet-billed) request shows an enabled "Bill this change" button
// 3. a billed request (billed_invoice_id set) shows "Billed" and NO enabled bill button
// 4. empty state renders when there are no change requests
// 5. clicking "New change request" opens the modal (heading visible)
// (Mount with a fake project { id, client_id, budget_currency }. Mirror AdminUsersPage.test conventions.)
```

- [ ] **Step 2: Run** — `npx vitest run src/features/projects/__tests__/ChangeRequestsPanel.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement**

`ChangeRequestModal.jsx` — kit `Modal` with fields: title (`Input`), description (`Textarea`), currency (default `project.budget_currency || 'USD'`), amount (`Input` number), optional hours + hourly_rate (`Input` number), optional added_days (`Input` number). On change of hours/rate, show the computed `deriveAmount(...)` as the effective amount; on submit call `useCreateChangeRequest().mutateAsync({ project_id: project.id, client_id: project.client_id, title, description, currency, amount: deriveAmount(form), hours, hourly_rate, added_days })`, toast, close. Validate: title required, amount > 0.

`ChangeRequestsPanel.jsx`:
```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Copy, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChangeRequestModal } from './ChangeRequestModal'
import {
  useChangeRequests, useSendChangeRequest, useRegenerateChangeRequestLink,
  useBillChangeRequest, useDeleteChangeRequest,
} from '@/hooks/useChangeRequests'
import { formatCurrency } from '@/lib/currency'
import { relativeTime } from '@/lib/date'

const STATUS_VARIANT = { draft: 'default', sent: 'info', approved: 'success', declined: 'danger' }

export function ChangeRequestsPanel({ project }) {
  const { data: rows, isLoading } = useChangeRequests(project.id)
  const send = useSendChangeRequest()
  const regen = useRegenerateChangeRequestLink()
  const bill = useBillChangeRequest()
  const del = useDeleteChangeRequest()
  const [creating, setCreating] = useState(false)
  const base = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin

  const copyLink = async (token) => {
    try { await navigator.clipboard.writeText(`${base}/cr/${token}`); toast.success('Link copied') }
    catch { toast.error('Could not copy') }
  }
  const onBill = (cr) =>
    bill.mutate(cr, {
      onSuccess: () => toast.success('Draft invoice created from this change'),
      onError: (e) => toast.error(e.userMessage || e.message),
    })

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Change requests</h3>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> New change request</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !rows?.length ? (
        <EmptyState title="No change requests" description="Raise one when work goes beyond the original scope." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((cr) => {
            const billed = !!cr.billed_invoice_id
            return (
              <li key={cr.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="font-medium text-fg">{cr.title}</span>
                <span className="tabular-nums text-fg-muted">{formatCurrency(Number(cr.amount), cr.currency)}</span>
                {cr.added_days ? <span className="text-xs text-fg-subtle">+{cr.added_days}d</span> : null}
                <span className="ml-auto flex items-center gap-2">
                  <Badge variant={billed ? 'default' : (STATUS_VARIANT[cr.status] ?? 'default')}>
                    {billed ? 'Billed' : cr.status}
                  </Badge>
                  {cr.status === 'draft' && (
                    <Button size="sm" variant="secondary"
                      onClick={() => send.mutate(cr.id, { onSuccess: () => toast.success('Ready to share — copy the link'), onError: (e) => toast.error(e.userMessage || e.message) })}>
                      Send
                    </Button>
                  )}
                  {cr.public_token && cr.status !== 'draft' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => copyLink(cr.public_token)} aria-label="Copy link"><Copy className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => regen.mutate(cr.id, { onSuccess: () => toast.success('Link regenerated'), onError: (e) => toast.error(e.userMessage || e.message) })} aria-label="Regenerate link"><RefreshCw className="size-4" /></Button>
                    </>
                  )}
                  {cr.status === 'approved' && !billed && (
                    <Button size="sm" loading={bill.isPending} onClick={() => onBill(cr)}>Bill this change</Button>
                  )}
                  {billed && (
                    <Link to={`/invoices/${cr.billed_invoice_id}`} className="text-sm text-primary hover:underline">View invoice</Link>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <ChangeRequestModal open={creating} project={project} onClose={() => setCreating(false)} />
    </Card>
  )
}
```
Reconcile `Badge`/`Button`/`Modal`/`Textarea` prop names against the real kit (mirror `AdminUsersPage`/`NewInvoiceModal`); keep tested texts/roles intact.

In `ProjectDetailPage.jsx`, import and render `<ChangeRequestsPanel project={project} />` immediately after `<ProjectFinancialsPanel project={project} />`.

- [ ] **Step 4: Run** — `npx vitest run` — all pass. `npx vite build` succeeds. Run the **Impeccable pass** on the panel + modal.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/ChangeRequestsPanel.jsx src/features/projects/ChangeRequestModal.jsx src/pages/ProjectDetailPage.jsx src/features/projects/__tests__/ChangeRequestsPanel.test.jsx
git commit -m "feat(change-requests): project panel — create, send/share, bill-this-change"
```

---

### Task 5: Public `/cr/:token` approval page (TDD + Impeccable)

**Files:**
- Create: `src/pages/PublicChangeRequestPage.jsx`
- Modify: `src/app/routes.jsx` (add public route `{ path: '/cr/:token', element: <PublicChangeRequestPage /> }` alongside `/i/:token`)
- Test: `src/pages/__tests__/PublicChangeRequestPage.test.jsx`

**Interfaces:**
- Consumes: `usePublicChangeRequest(token)`, `useRespondToChangeRequest()` (Task 3); `formatCurrency`.

- [ ] **Step 1: Write the failing tests** — mock the two hooks + `sonner`; render under `MemoryRouter` route `/cr/:token`. Cases:

```jsx
// 1. a 'sent' request renders the title, formatted amount, and Approve + Decline buttons
// 2. Approve requires a typed name: clicking Approve calls respond.mutate with { token, decision:'approve', approverName }
// 3. an 'already_decided' payload (status approved) shows the decided state, no action buttons
// 4. null payload (invalid token) shows "this link is no longer valid"
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — mirror `PublicInvoicePage` shell (hosted, business-branded, no nav). Structure:
  - Loading → skeleton; `data === null` → "This link is no longer valid" card.
  - Header: business name (+ logo if present).
  - Body: title, description, the added cost (`formatCurrency(amount, currency)`, and "≈ {hours}h × {rate}" when both present), `+{added_days} days` if set.
  - If `already_decided` (or status not `sent`): show a decided banner ("Approved by {approver_name}" / "Declined"), no buttons.
  - Else: an Approve block (typed-name `Input`, required) + a Decline block (optional reason `Textarea`), each calling `useRespondToChangeRequest().mutate({ token, decision, approverName, reason }, { onSuccess: toast + refetch })`. After success the query refetch flips it to the decided state.
  - Use kit `Card`/`Button`/`Input`/`Textarea`; accent from payload `accent_color` where the invoice page uses it.

- [ ] **Step 4: Run** — `npx vitest run src/pages/__tests__/PublicChangeRequestPage.test.jsx` — all pass; then full `npx vitest run`; `npx vite build`. **Impeccable pass** on the page.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicChangeRequestPage.jsx src/app/routes.jsx src/pages/__tests__/PublicChangeRequestPage.test.jsx
git commit -m "feat(change-requests): public /cr/:token approve-decline page"
```

---

### Task 6: E2E (read-only) + full verification

**Files:**
- Create: `tests/e2e/change-requests.spec.js`

- [ ] **Step 1: Write the spec** — READ-ONLY (no create/send/approve against live data; assert the panel renders on a project).

```javascript
import { test, expect } from '@playwright/test'
const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('project page shows the Change requests panel', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('link', { name: 'Projects' }).click()
  await page.locator('a[href^="/projects/"]').first().click()
  await expect(page.getByRole('heading', { name: 'Change requests' })).toBeVisible()
})
```
If the admin account has no projects, the click finds none — in that case assert the panel via a known project URL, or skip gracefully; adjust the selector to the real projects list DOM.

- [ ] **Step 2: Run** — `E2E_USER_EMAIL=admin@loomlance.com E2E_USER_PASSWORD=<pw> npx playwright test tests/e2e/change-requests.spec.js` — Expected: PASS. Clean up any ZZ litter the run created via scoped SQL if applicable (this spec creates none).

- [ ] **Step 3: Full suite** — `npx vitest run` and `npx playwright test` (all specs; `happy-path`/admin specs stay green).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/change-requests.spec.js
git commit -m "test(e2e): change-requests panel renders on the project page"
```

---

## Self-review notes

- **Spec coverage:** table + enum + RLS + 4 RPCs incl. idempotent respond + notification (T1), pure derive/decision helpers (T2), API/hooks incl. bill-this-change via createInvoice (T3), project panel create/send/share/bill + double-bill guard (T4), public approve/decline page with decided/invalid states (T5), read-only e2e (T6). Out-of-scope items (email, tier-gating, multi-line, overage analytics) untouched.
- **Type consistency:** RPC names/params match between T1 and T3 (`send_change_request(p_id)`, `respond_to_change_request(p_token,p_decision,p_approver_name,p_reason)`); `deriveAmount`/`decisionState` signatures match T2 and their T4/T5 uses; hook names in T3 match imports in T4/T5; `billed_invoice_id` set in T3's `billChangeRequest` and read in T4's panel.
- **Known unknowns for the implementer:** exact kit prop names for `Badge`/`Modal`/`Textarea`/`Button` (T4/T5 reconcile against `NewInvoiceModal`/`AdminUsersPage`); the projects-list DOM selector for the e2e (T6 Step 1 note); whether `ProjectDetailPage` passes the full `project` object with `client_id`/`budget_currency` (verify when wiring T4 — it renders `ProjectFinancialsPanel project={project}`, so the object is in scope).
```
