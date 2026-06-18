# Phase 3 "Send & Pay" (mock-externals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A freelancer can send an invoice (mock email), share a hardened public link, have the client view it (freelancer notified) and "pay" it (mock, auto-confirms), with link controls (regenerate/expiry) — all real except the external email/Stripe wiring.

**Architecture:** All server logic is Postgres `SECURITY DEFINER` RPCs applied to the hosted project via MCP (then mirrored into `supabase/migrations/`); the SPA calls them through the existing `api/* → hooks/*` layers. The public page is an unauthenticated route reading one curated RPC. No Edge Functions yet — the real Resend/Stripe wiring is a separate later task behind defined seams. Spec: `docs/superpowers/specs/2026-06-18-loomlance-phase-3-send-and-pay-design.md`.

**Tech Stack:** Supabase Postgres (pgcrypto in `extensions`), supabase-js `rpc()`, TanStack Query, react-hook-form, the Phase 2 `buildInvoiceBlob` PDF generator, Playwright.

**Conventions:** Apply each migration via MCP `apply_migration`, then `list_migrations` for the version, then write `supabase/migrations/<version>_<name>.sql` to match, then commit. Lint is a hard gate — only commit when `npx eslint . --max-warnings 0` exits 0. The test user (`test@loomlance.com` / `password123`) is in active use — seed/clean test data with `INV-9xxx`/`ZZ ` markers only, never bulk-delete. react-pdf only renders in a production build (`npm run preview`), not the dev server.

---

### Task 1: Database — schema, config flag, RPCs, error messages

**Files:**
- Create: `supabase/migrations/<version>_send_and_pay.sql` (mirror of the MCP migration)
- Modify: `src/lib/errors.js`

- [ ] **Step 1: Apply the migration via MCP `apply_migration` (name: `send_and_pay`)**

```sql
-- 1. Optional link expiry.
alter table public.invoices add column if not exists link_expires_at timestamptz;

-- 2. Single-row app config; gates the mock payment RPC. RLS denies end-user access;
--    only SECURITY DEFINER functions (which bypass RLS) read it.
create table if not exists public.app_config (
  id boolean primary key default true check (id),
  mock_payments_enabled boolean not null default true
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;
alter table public.app_config enable row level security;

-- 3. Public read path: returns ONLY invoice-display fields by token; stamps viewed_at once.
create or replace function public.get_public_invoice(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select i.id, i.user_id, i.invoice_number, i.issue_date, i.due_date, i.currency, i.status,
         i.notes, i.terms, i.payment_instructions, i.viewed_at, i.link_expires_at,
         c.name as client_name, c.company as client_company, c.address as client_address,
         p.business_name, p.address as issuer_address, p.tax_id, p.logo_url,
         p.invoice_accent_color, p.invoice_footer, p.subscription_tier,
         p.stripe_connect_account_id
  into inv
  from public.invoices i
  join public.profiles p on p.id = i.user_id
  left join public.clients c on c.id = i.client_id
  where i.public_token = p_token;

  if not found then
    return null;
  end if;
  if inv.link_expires_at is not null and inv.link_expires_at < now() then
    return null;
  end if;

  if inv.viewed_at is null then
    update public.invoices set viewed_at = now() where id = inv.id;
    insert into public.user_notifications (user_id, kind, payload, link_to)
    values (
      inv.user_id, 'invoice_viewed',
      jsonb_build_object(
        'title', 'Invoice ' || inv.invoice_number || ' was viewed',
        'body', coalesce(inv.client_name, 'Your client') || ' opened it'
      ),
      '/invoices/' || inv.id
    );
  end if;

  return jsonb_build_object(
    'invoice_number', inv.invoice_number,
    'issue_date', inv.issue_date,
    'due_date', inv.due_date,
    'currency', inv.currency,
    'status', inv.status,
    'notes', inv.notes,
    'terms', inv.terms,
    'payment_instructions', inv.payment_instructions,
    'can_pay', (inv.stripe_connect_account_id is not null and inv.status not in ('paid','void')),
    'issuer', jsonb_build_object(
      'business_name', inv.business_name,
      'address', inv.issuer_address,
      'tax_id', inv.tax_id,
      'logo_url', inv.logo_url,
      'invoice_accent_color', inv.invoice_accent_color,
      'invoice_footer', inv.invoice_footer,
      'tier', inv.subscription_tier
    ),
    'client', jsonb_build_object(
      'name', inv.client_name,
      'company', inv.client_company,
      'address', inv.client_address
    ),
    'line_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', li.description, 'quantity', li.quantity, 'unit_price', li.unit_price,
        'tax_rate', li.tax_rate, 'discount_rate', li.discount_rate, 'position', li.position
      ) order by li.position)
      from public.invoice_line_items li where li.invoice_id = inv.id
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

-- 4. Owner-scoped token rotation (invalidates a shared link).
create or replace function public.regenerate_invoice_link(p_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  new_token := encode(extensions.gen_random_bytes(16), 'hex');
  update public.invoices set public_token = new_token
  where id = p_invoice_id and user_id = auth.uid();
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return new_token;
end;
$$;
revoke all on function public.regenerate_invoice_link(uuid) from public, anon;
grant execute on function public.regenerate_invoice_link(uuid) to authenticated;

-- 5. DEV-ONLY mock payment. Mirrors the real Stripe webhook's DB effect.
--    MUST be removed/disabled (app_config.mock_payments_enabled=false) in production.
create or replace function public.mock_pay_invoice(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  v_total numeric(14,2);
  v_enabled boolean;
begin
  select mock_payments_enabled into v_enabled from public.app_config where id = true;
  if not coalesce(v_enabled, false) then
    raise exception 'MOCK_PAYMENTS_DISABLED' using errcode = 'P0001';
  end if;

  select * into inv from public.invoices where public_token = p_token;
  if not found then
    raise exception 'INVOICE_LINK_INVALID' using errcode = 'P0001';
  end if;
  if inv.link_expires_at is not null and inv.link_expires_at < now() then
    raise exception 'INVOICE_LINK_INVALID' using errcode = 'P0001';
  end if;
  if inv.status in ('paid','void') then
    return jsonb_build_object('status', inv.status, 'already', true);
  end if;

  select coalesce(sum(
    round(
      (li.quantity*li.unit_price - round(li.quantity*li.unit_price*li.discount_rate/100.0, 2))
      + round((li.quantity*li.unit_price - round(li.quantity*li.unit_price*li.discount_rate/100.0, 2)) * li.tax_rate/100.0, 2)
    , 2)
  ), 0) into v_total
  from public.invoice_line_items li where li.invoice_id = inv.id;

  insert into public.invoice_payments (user_id, invoice_id, amount, currency, paid_at, method)
  values (inv.user_id, inv.id, v_total, inv.currency, now(), 'stripe');

  update public.invoices set status = 'paid', paid_at = now() where id = inv.id;

  insert into public.user_notifications (user_id, kind, payload, link_to)
  values (
    inv.user_id, 'invoice_paid',
    jsonb_build_object(
      'title', 'Invoice ' || inv.invoice_number || ' was paid',
      'body', inv.currency || ' ' || to_char(v_total, 'FM999999990.00') || ' received'
    ),
    '/invoices/' || inv.id
  );

  return jsonb_build_object('status', 'paid', 'amount', v_total, 'currency', inv.currency);
end;
$$;
grant execute on function public.mock_pay_invoice(text) to anon, authenticated;
```

- [ ] **Step 2: Mirror locally.** Run MCP `list_migrations`, take the new version, and Write the identical SQL to `supabase/migrations/<version>_send_and_pay.sql`.

- [ ] **Step 3: Add the two new error messages.** Edit `src/lib/errors.js` — add to the `CODE_MESSAGES` object (after `STRIPE_NOT_CONNECTED`):

```js
  INVOICE_LINK_INVALID: 'This invoice link is no longer valid.',
  MOCK_PAYMENTS_DISABLED: 'Online payments aren’t available right now.',
```

(`detectCode` already maps a P0001 whose message's first word is a known `CODE_MESSAGES` key, and `NOT_FOUND`/`STRIPE_NOT_CONNECTED` already exist.)

- [ ] **Step 4: Functional test via MCP `execute_sql` (self-cleaning).** Seed one sent invoice with a line item for the test user, then:

```sql
-- get_public_invoice returns curated JSON + stamps viewed
select public.get_public_invoice((select public_token from invoices where invoice_number='INV-9301'));
-- assert: jsonb has invoice_number/line_items/issuer/client/can_pay; NO user_id/email/stripe key.
-- second call: no new invoice_viewed notification (viewed_at already set).
-- mock_pay_invoice marks paid + payment row + notification
select public.mock_pay_invoice((select public_token from invoices where invoice_number='INV-9301'));
-- assert: status now 'paid', one invoice_payments row, one invoice_paid notification.
```

Then delete the seeded invoice + its notifications (markers `INV-93%`).

- [ ] **Step 5: Gate + commit.**

```bash
npx eslint . --max-warnings 0   # must exit 0
git add supabase/migrations/<version>_send_and_pay.sql src/lib/errors.js docs/superpowers/plans/2026-06-18-loomlance-phase-3-send-and-pay.md docs/superpowers/specs/2026-06-18-loomlance-phase-3-send-and-pay-design.md
git commit -m "feat(send-pay): schema + RPCs for public invoice, link controls, mock pay"
```

---

### Task 2: Public invoice API + hooks

**Files:**
- Create: `src/api/publicInvoice.js`
- Create: `src/hooks/usePublicInvoice.js`

- [ ] **Step 1: `src/api/publicInvoice.js`**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Returns the curated invoice JSON, or null if the token is invalid/expired.
export async function getPublicInvoice(token) {
  const { data, error } = await supabase.rpc('get_public_invoice', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}

export async function mockPayInvoice(token) {
  const { data, error } = await supabase.rpc('mock_pay_invoice', { p_token: token })
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 2: `src/hooks/usePublicInvoice.js`**

```js
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPublicInvoice, mockPayInvoice } from '@/api/publicInvoice'

export function usePublicInvoice(token) {
  return useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => getPublicInvoice(token),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  })
}

export function useMockPay() {
  return useMutation({ mutationFn: (token) => mockPayInvoice(token) })
}
```

- [ ] **Step 3: Gate + commit.** `npm run build` (PASS), `npx eslint . --max-warnings 0` (exit 0). `git add src/api/publicInvoice.js src/hooks/usePublicInvoice.js && git commit -m "feat(send-pay): public invoice api + hooks"`.

---

### Task 3: Invoice API additions — send / regenerate / expiry

**Files:**
- Modify: `src/api/invoices.js` (append exports)
- Modify: `src/hooks/useInvoices.js` (append hooks)

- [ ] **Step 1: Append to `src/api/invoices.js`** (it already imports `supabase` + `mapPostgresError`):

```js
export async function sendInvoice(id) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, public_token, status, sent_at')
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function regenerateInvoiceLink(id) {
  const { data, error } = await supabase.rpc('regenerate_invoice_link', { p_invoice_id: id })
  if (error) throw mapPostgresError(error)
  return data // new token string
}

export async function setLinkExpiry(id, expiresAt) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ link_expires_at: expiresAt }) // ISO string or null to clear
    .eq('id', id)
    .select('id, link_expires_at')
    .single()
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 2: Append hooks to `src/hooks/useInvoices.js`** (match the file's existing mutation style; it uses `useMutation` + `queryClient.invalidateQueries`). Import `sendInvoice, regenerateInvoiceLink, setLinkExpiry` from `@/api/invoices` and add:

```js
export function useSendInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => sendInvoice(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invoice', data.id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useRegenerateInvoiceLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => regenerateInvoiceLink(id),
    onSuccess: (_token, id) => qc.invalidateQueries({ queryKey: ['invoice', id] }),
  })
}

export function useSetLinkExpiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, expiresAt }) => setLinkExpiry(id, expiresAt),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['invoice', data.id] }),
  })
}
```

(Verify the actual invoice-detail query key in `useInvoices.js` — it is `['invoice', id]` for `useInvoice`; align the invalidation keys to it.)

- [ ] **Step 3: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`. `git add src/api/invoices.js src/hooks/useInvoices.js && git commit -m "feat(send-pay): invoice send/regenerate-link/expiry api + hooks"`.

---

### Task 4: Public invoice page + route

**Files:**
- Create: `src/features/invoices/PublicInvoiceView.jsx` (presentational, plain-data invoice paper)
- Create: `src/pages/PublicInvoicePage.jsx`
- Modify: `src/app/routes.jsx` (add public route)

- [ ] **Step 1: `PublicInvoiceView.jsx`** — renders the curated JSON as a white-paper invoice (mirrors `InvoicePreview` markup but takes plain `data`, not a form control). `branded = data.issuer.tier !== 'free'`.

```jsx
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { invoiceTotals } from '@/lib/money'

export function PublicInvoiceView({ data }) {
  const { issuer, client, line_items: lines = [], currency } = data
  const totals = invoiceTotals(lines.map((li) => ({
    quantity: Number(li.quantity), unit_price: Number(li.unit_price),
    tax_rate: Number(li.tax_rate), discount_rate: Number(li.discount_rate),
  })))
  const branded = issuer.tier !== 'free'
  const accent = branded ? issuer.invoice_accent_color : '#2D3E50'

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-border bg-white p-6 text-sm leading-snug text-black shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          {branded && issuer.logo_url
            ? <img src={issuer.logo_url} alt="" className="mb-2 h-12" />
            : <h2 className="text-xl font-bold" style={{ color: accent }}>{issuer.business_name || 'Your Business'}</h2>}
          {issuer.address ? <p className="whitespace-pre-line text-xs">{issuer.address}</p> : null}
          {issuer.tax_id ? <p className="text-xs">Tax ID: {issuer.tax_id}</p> : null}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>INVOICE</h1>
          <p className="mt-1 text-xs">{data.invoice_number}</p>
          <p className="text-xs">Issued: {data.issue_date ? formatDate(data.issue_date) : '—'}</p>
          <p className="text-xs">Due: {data.due_date ? formatDate(data.due_date) : '—'}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-1 text-xs uppercase text-gray-500">Bill to</p>
        <p className="font-medium">{client.name}</p>
        {client.company ? <p>{client.company}</p> : null}
        {client.address ? <p className="whitespace-pre-line text-xs">{client.address}</p> : null}
      </div>

      <table className="mb-6 w-full text-xs">
        <thead className="border-b border-gray-300">
          <tr><th className="py-2 text-left">Description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit</th><th className="py-2 text-right">Total</th></tr>
        </thead>
        <tbody>
          {lines.map((li, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="whitespace-pre-line py-2 pr-2">{li.description || '—'}</td>
              <td className="py-2 text-right tabular-nums">{Number(li.quantity)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(Number(li.unit_price), currency)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(Number(li.quantity) * Number(li.unit_price), currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-xs tabular-nums">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, currency)}</span></div>
        {totals.discount > 0 ? <div className="flex justify-between"><span>Discount</span><span>−{formatCurrency(totals.discount, currency)}</span></div> : null}
        {Object.entries(totals.taxByRate).map(([r, a]) => <div key={r} className="flex justify-between"><span>Tax {r}%</span><span>{formatCurrency(a, currency)}</span></div>)}
        <div className="flex justify-between border-t border-gray-400 pt-1 font-semibold"><span>Total</span><span>{formatCurrency(totals.total, currency)}</span></div>
      </div>

      {data.notes ? <div className="mt-6 text-xs"><p className="font-semibold">Notes</p><p className="whitespace-pre-line">{data.notes}</p></div> : null}
      {data.payment_instructions ? <div className="mt-3 text-xs"><p className="font-semibold">Payment</p><p className="whitespace-pre-line">{data.payment_instructions}</p></div> : null}
      {branded && issuer.invoice_footer ? <p className="mt-8 whitespace-pre-line text-center text-xs text-gray-600">{issuer.invoice_footer}</p> : null}
    </div>
  )
}
```

- [ ] **Step 2: `PublicInvoicePage.jsx`** — reads the token from the URL, renders the view, Download PDF (reusing `buildInvoiceBlob`), and Pay Now (mock).

```jsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePublicInvoice, useMockPay } from '@/hooks/usePublicInvoice'
import { PublicInvoiceView } from '@/features/invoices/PublicInvoiceView'

export default function PublicInvoicePage() {
  const { token } = useParams()
  const { data, isLoading, refetch } = usePublicInvoice(token)
  const pay = useMockPay()
  const [paid, setPaid] = useState(false)

  if (isLoading) return <div className="mx-auto max-w-2xl p-6"><Skeleton className="h-96" /></div>

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">This invoice link is no longer valid</h1>
          <p className="mt-1 text-sm text-fg-muted">Ask the sender for an up-to-date link.</p>
        </div>
      </div>
    )
  }

  const download = async () => {
    const { buildInvoiceBlob } = await import('@/features/invoices/InvoicePDF')
    const invoice = {
      invoice_number: data.invoice_number, issue_date: data.issue_date, due_date: data.due_date,
      currency: data.currency, notes: data.notes, terms: data.terms, payment_instructions: data.payment_instructions,
      invoice_line_items: data.line_items,
    }
    const profile = { ...data.issuer, subscription_tier: data.issuer.tier }
    const blob = await buildInvoiceBlob({ invoice, client: data.client, profile })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${data.invoice_number}.pdf`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  const onPay = async () => {
    try {
      await pay.mutateAsync(token)
      setPaid(true)
      await refetch()
    } catch (e) {
      toast.error(e.userMessage || 'Payment could not be completed')
    }
  }

  const isPaid = paid || data.status === 'paid'

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="LoomLance" className="size-8" />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={download}><Download className="size-4" /> Download PDF</Button>
            {data.can_pay && !isPaid ? <Button size="sm" onClick={onPay} loading={pay.isPending}><CreditCard className="size-4" /> Pay now</Button> : null}
          </div>
        </div>
        {isPaid ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> This invoice has been paid. Thank you!
          </div>
        ) : null}
        <PublicInvoiceView data={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the public route.** Edit `src/app/routes.jsx` — import `PublicInvoicePage` and add to the Public group:

```jsx
import PublicInvoicePage from '@/pages/PublicInvoicePage'
// ...in the Public section, after reset-password:
  { path: '/i/:token', element: <PublicInvoicePage /> },
```

- [ ] **Step 4: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`, `npx vitest run` (28 pass). `git add src/features/invoices/PublicInvoiceView.jsx src/pages/PublicInvoicePage.jsx src/app/routes.jsx && git commit -m "feat(send-pay): public hosted invoice page + route"`.

---

### Task 5: Send invoice modal + wire into the invoice detail

**Files:**
- Create: `src/features/invoices/SendInvoiceModal.jsx`
- Modify: `src/features/invoices/InvoiceActions.jsx`

- [ ] **Step 1: `SendInvoiceModal.jsx`** — collects recipient/subject/body (display-only in mock), shows the share link, confirms via `useSendInvoice`.

```jsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useSendInvoice } from '@/hooks/useInvoices'

export function SendInvoiceModal({ open, onClose, invoice }) {
  const send = useSendInvoice()
  const client = invoice.clients
  const [to, setTo] = useState(client?.email || '')
  const [subject, setSubject] = useState(`Invoice ${invoice.invoice_number}`)
  const [body, setBody] = useState(`Hi ${client?.name || ''},\n\nPlease find invoice ${invoice.invoice_number} attached. You can view and pay it online via the link below.\n\nThank you.`)

  const onConfirm = async () => {
    try {
      await send.mutateAsync(invoice.id)
      toast.success('Invoice marked as sent')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not send invoice')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send invoice" size="lg">
      <div className="space-y-4">
        <p className="rounded-md bg-bg-muted px-3 py-2 text-xs text-fg-muted">
          Email delivery is simulated for now — confirming will mark the invoice sent and give you a shareable link to send manually.
        </p>
        <div><Label htmlFor="to">To</Label><Input id="to" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label htmlFor="subject">Subject</Label><Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><Label htmlFor="body">Message</Label><Textarea id="body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} loading={send.isPending}>Mark as sent</Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Wire into `InvoiceActions.jsx`** — add a "Send" button for `draft` status, before the existing "Mark sent" button (replace the bare status flip with this richer modal). Import `SendInvoiceModal` + `Send` icon; add `const [sendOpen, setSendOpen] = useState(false)`; render for `invoice.status === 'draft'`:

```jsx
{invoice.status === 'draft' ? (
  <Button size="sm" onClick={() => setSendOpen(true)}><Send className="size-4" /> Send</Button>
) : null}
{/* ...near the other conditionally-mounted modals: */}
{sendOpen ? <SendInvoiceModal open onClose={() => setSendOpen(false)} invoice={invoice} /> : null}
```

Remove the old inline "Mark sent" button (the modal now owns the draft→sent transition). Keep Mark paid / Void / Duplicate / Delete as-is.

- [ ] **Step 3: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`. `git add src/features/invoices/SendInvoiceModal.jsx src/features/invoices/InvoiceActions.jsx && git commit -m "feat(send-pay): send-invoice modal (mock email)"`.

---

### Task 6: Share-link panel (copy / regenerate / expiry) on the invoice detail

**Files:**
- Create: `src/features/invoices/ShareLinkPanel.jsx`
- Modify: `src/pages/InvoiceDetailPage.jsx` (render the panel for non-draft invoices)

- [ ] **Step 1: `ShareLinkPanel.jsx`**

```jsx
import { useState } from 'react'
import { Copy, RefreshCw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useRegenerateInvoiceLink, useSetLinkExpiry } from '@/hooks/useInvoices'
import { formatDate } from '@/lib/date'

export function ShareLinkPanel({ invoice }) {
  const regen = useRegenerateInvoiceLink()
  const setExpiry = useSetLinkExpiry()
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [copied, setCopied] = useState(false)
  const base = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin
  const url = `${base}/i/${invoice.public_token}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { toast.error('Could not copy') }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Share link</h3>
        {invoice.viewed_at ? <span className="text-xs text-fg-muted">Viewed {formatDate(invoice.viewed_at)}</span> : null}
      </div>
      <div className="flex gap-2">
        <Input readOnly value={url} className="flex-1" onFocus={(e) => e.target.select()} />
        <Button variant="secondary" size="sm" onClick={copy}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(true)} loading={regen.isPending}><RefreshCw className="size-4" /> Regenerate link</Button>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          Expires
          <Input
            type="date"
            className="h-8 w-40"
            value={invoice.link_expires_at ? invoice.link_expires_at.slice(0, 10) : ''}
            onChange={(e) => setExpiry.mutate({ id: invoice.id, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </label>
      </div>
      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate link?"
        body="This creates a new link and immediately breaks any link you’ve already shared. This cannot be undone."
        confirmLabel="Regenerate"
        variant="danger"
        loading={regen.isPending}
        onCancel={() => setConfirmRegen(false)}
        onConfirm={async () => {
          try { await regen.mutateAsync(invoice.id); toast.success('New link generated'); setConfirmRegen(false) }
          catch (e) { toast.error(e.userMessage || 'Could not regenerate') }
        }}
      />
    </Card>
  )
}
```

- [ ] **Step 2: Render in `InvoiceDetailPage.jsx`** — show the panel once the invoice has left draft (it has a meaningful link to share). Import `ShareLinkPanel`; between the header and `<InvoiceEditor/>`:

```jsx
{invoice.status !== 'draft' ? <ShareLinkPanel invoice={invoice} /> : null}
```

- [ ] **Step 3: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`. `git add src/features/invoices/ShareLinkPanel.jsx src/pages/InvoiceDetailPage.jsx && git commit -m "feat(send-pay): share-link panel with regenerate + expiry"`.

---

### Task 7: Profile → Payments tab (mock Stripe Connect)

**Files:**
- Create: `src/features/profile/PaymentsTab.jsx`
- Modify: `src/pages/ProfilePage.jsx` (add the tab)

- [ ] **Step 1: `PaymentsTab.jsx`** — toggles the mock connection via `useUpdateProfile` (writes `stripe_connect_account_id`).

```jsx
import { CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'

export function PaymentsTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const connected = !!profile?.stripe_connect_account_id

  const toggle = async (next) => {
    try {
      await update.mutateAsync({ stripe_connect_account_id: next ? 'mock_connect' : null })
      toast.success(next ? 'Stripe connected (simulated)' : 'Stripe disconnected')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update')
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              <h3 className="text-sm font-semibold">Online payments</h3>
              {connected ? <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Connected</Badge> : <Badge>Not connected</Badge>}
            </div>
            <p className="mt-2 text-sm text-fg-muted">
              When connected, your invoices show a “Pay now” button so clients can pay you online.
            </p>
          </div>
        </div>
        <p className="rounded-md bg-bg-muted px-3 py-2 text-xs text-fg-muted">
          This is a simulated connection. Real Stripe Connect onboarding and live payments will be wired up in a later release.
        </p>
        {connected
          ? <Button variant="secondary" onClick={() => toggle(false)} loading={update.isPending}>Disconnect</Button>
          : <Button onClick={() => toggle(true)} loading={update.isPending}>Connect Stripe (simulated)</Button>}
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Add the tab to `ProfilePage.jsx`** — import `PaymentsTab`; add `{ key: 'payments', label: 'Payments' }` to the `TABS` array (after `business`); render `{tab === 'payments' && <PaymentsTab />}`.

- [ ] **Step 3: Gate + commit.** `npm run build`, `npx eslint . --max-warnings 0`. `git add src/features/profile/PaymentsTab.jsx src/pages/ProfilePage.jsx && git commit -m "feat(send-pay): profile payments tab (mock stripe connect)"`.

---

### Task 8: Full live verification (Playwright, production build)

**Files:**
- (verification only — no committed code unless fixes are needed)

- [ ] **Step 1:** Seed via MCP a draft invoice with a line item for the test user (`INV-9401`, client = first client, qty 2 × $100, 10% tax → total $220).
- [ ] **Step 2:** `npm run build` then `npm run preview` (note the port). Playwright script (place inside the repo dir so `playwright` resolves):
  1. Log in (authed context) → `/profile?tab=payments` → click **Connect Stripe (simulated)** → Badge shows Connected.
  2. Go to the seeded invoice → click **Send** → **Mark as sent** → status badge shows `sent`; **ShareLinkPanel** appears with a `/i/<token>` URL. Capture the token from the input value.
  3. Open `/i/<token>` in a **fresh, unauthenticated** browser context → `PublicInvoiceView` renders the invoice (number, $220 total) → **Pay now** visible.
  4. Back in the authed context, open the notification bell → an **“Invoice INV-9401 was viewed”** notification is present.
  5. In the public context, click **Pay now** → “This invoice has been paid” banner; Pay button gone.
  6. Authed context: invoice status now `paid`; bell shows **“Invoice INV-9401 was paid”**.
  7. **Regenerate:** authed → ShareLinkPanel → Regenerate → confirm. Re-open the OLD `/i/<token>` → “link no longer valid”.
  8. **No-leak assertion:** evaluate `get_public_invoice` response JSON (from step 3 network or a direct `supabase.rpc` in-page) and assert keys ⊆ {invoice_number, issue_date, due_date, currency, status, notes, terms, payment_instructions, can_pay, issuer, client, line_items} — no `user_id`, no email, no `stripe*`.
  Expected: all assertions pass, 0 page errors.
- [ ] **Step 3:** Clean up — delete `INV-94%` invoices + their `invoice_payments` + the seeded `invoice_viewed`/`invoice_paid` notifications; set the test user's `stripe_connect_account_id` back to `null` (leave their real data untouched).
- [ ] **Step 4:** Update memory (`loomlance_phase2_progress.md` → add a Phase 3 section or create `loomlance_phase3_progress.md`) with what shipped and the mock seams + the `mock_pay_invoice` removal note.

---

## Self-review

**Spec coverage:** §4.1 hosted page → Tasks 1 (RPC) + 4 (page). §4.2 link controls → Tasks 1 (column/RPC) + 3 (api) + 6 (UI). §4.3 send → Tasks 3 + 5. §4.4 connect/pay → Tasks 1 (RPC/config) + 4 (Pay UI) + 7 (connect). §4.5 notifications → Task 1 (inside RPCs). §5 schema → Task 1. §6 frontend files → Tasks 2,4,5,6,7. §7 errors → Task 1 Step 3. §8 testing → Task 8. Covered.

**Type/name consistency:** RPC names (`get_public_invoice`, `regenerate_invoice_link`, `mock_pay_invoice`) and params (`p_token`, `p_invoice_id`) consistent across Tasks 1–4. API fns (`getPublicInvoice`, `mockPayInvoice`, `sendInvoice`, `regenerateInvoiceLink`, `setLinkExpiry`) match their hooks. Public JSON keys used in `PublicInvoiceView`/`PublicInvoicePage` match the `jsonb_build_object` in Task 1.

**Note for the executor:** confirm `useInvoice`'s query key in `useInvoices.js` before writing the invalidations in Task 3 Step 2 (assumed `['invoice', id]`); adjust if different.
