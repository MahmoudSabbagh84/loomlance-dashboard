# Payments & Invoice Pay-Flow Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the master "Accept online payments" toggle and make each provider _offered by virtue of being connected_, then redesign the hosted invoice pay page so the client explicitly picks among the methods the freelancer offers (with payment instructions as the always-available baseline).

**Architecture:** "Connected = offered." The public-invoice RPC (`get_public_invoice`) is the single security boundary: it derives `can_pay` (card) from `stripe_connect_account_id` and exposes `paypal_link`, **without** any master flag. A pure helper `paymentMethods({ can_pay, paypal_link })` turns that public payload into an ordered method list the pay page renders. `PaymentsTab` drops the toggle and shows three always-live blocks; `PublicInvoicePage` replaces its header pay buttons with a "Pay this invoice" card. The `profiles.online_payments_enabled` column is dropped **last**, once nothing references it. UI work goes through Impeccable against Slate Pro tokens.

**Tech Stack:** React + Vite, TanStack Query, Tailwind (Slate Pro tokens), Supabase (hosted dev — no local Docker; apply via Supabase MCP), Vitest. Stripe Connect + `stripe-checkout` edge function and the dev `mock_pay_invoice` path are reused unchanged.

## Global Constraints

- **All UI via the Impeccable skill** (`/impeccable`), matching Slate Pro tokens and the existing card/autosave patterns in `PaymentsTab`. Never hand-roll UI.
- **No master toggle, no per-provider enable flag (YAGNI).** A provider is offered purely by connection state: Stripe connected (`stripe_connect_account_id` non-null) → card; `paypal_link` set → PayPal. Disconnect / clear = off.
- **Cash/bank payment instructions are always available** (the baseline) on both the settings page and the invoice.
- **The public page must NEVER receive the raw `stripe_connect_account_id`.** Card availability reaches the client only as the RPC's derived boolean `can_pay`. Therefore `paymentMethods(issuer)` consumes `{ can_pay, paypal_link }` — **this is a deliberate deviation** from the spec's literal "inputs: `stripe_connect_account_id`, `paypal_link`," made to preserve the security boundary. The freelancer-side `PaymentsTab` reads its own raw connection fields directly and does **not** use the helper.
- **Migration ordering is reversed from the spec's phase list for safety:** update `get_public_invoice` FIRST (Task 1), drop `profiles.online_payments_enabled` LAST (Task 5), after the function, `PaymentsTab`, and the pay page all stop referencing it. Dropping it first would leave the live function referencing a missing column.
- **`can_pay` keeps `stripe_connect_account_id is not null`** (the `'mock_connect'` sentinel still counts as connected for `can_pay`, exactly as today; `stripe-checkout` still rejects it in real mode and dev uses mock-pay). Only the `online_payments_enabled` operand is removed. Behavior is otherwise unchanged.
- **Preserved unchanged:** `paymentsAreReal` (`VITE_PAYMENTS_PROVIDER === 'stripe'`) mock-vs-real branching, the `stripe-checkout` invoke (`invokeEdge('stripe-checkout', { token })`), `paypalHref` link handling, the dev `mock_pay_invoice` path, and the paid-state banner.
- **Edge-case verified at design time:** 0 of 5 profiles are "online-off but provider-connected," so re-deriving availability from connection state changes no current account's behavior. No data migration beyond the column drop.
- **Out of scope (do not entrench, do not fix here):** the `mock_connect` write being silently rolled back by `protect_billing_columns`; the `mock_pay_invoice` dev-gated public write (tracked as LOO-5, to be dropped before prod). Leave `app_config.mock_payments_enabled` false.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Hosted dev is Supabase project `zbipqfsqxnvrzhpdjvvy`. Apply migrations via Supabase MCP `apply_migration` (it auto-generates a timestamp version that differs cosmetically from the committed file name — expected, harmless). Push is manual/gated — commit locally, do not push.

## File Structure

- `supabase/migrations/20260625100000_payflow_connection_derived.sql` — **create** (Task 1): `create or replace function get_public_invoice` with `can_pay`/`paypal_link` derived from connection state only.
- `src/lib/payments.js` — **create** (Task 2): pure `paymentMethods(issuer)` helper.
- `src/lib/__tests__/payments.test.js` — **create** (Task 2): unit tests for the helper.
- `src/features/profile/PaymentsTab.jsx` — **modify** (Task 3): remove the master toggle; three always-live blocks.
- `src/pages/PublicInvoicePage.jsx` — **modify** (Task 4): "Pay this invoice" card + instructions fallback.
- `supabase/migrations/20260625110000_drop_online_payments_enabled.sql` — **create** (Task 5): drop the column.

---

### Task 1: Re-derive `get_public_invoice` from connection state (no master flag)

**Files:**
- Create: `supabase/migrations/20260625100000_payflow_connection_derived.sql`

**Interfaces:**
- Produces: `public.get_public_invoice(p_token text) returns jsonb` whose `can_pay = (stripe_connect_account_id is not null and status not in ('paid','void'))` and `paypal_link = case when status not in ('paid','void') then paypal_link else null end`. The returned JSON shape is otherwise byte-identical to today. Consumed by Tasks 2 & 4 (via `usePublicInvoice`).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260625100000_payflow_connection_derived.sql`. This is a full `create or replace` — it must reproduce the entire current function body, changing **only** the two derivation lines (and dropping the now-unused `online_payments_enabled` from the `select … into inv`):

```sql
-- LOO-91: "connected = offered". Online pay availability now derives purely from connection
-- state — card from a non-null stripe_connect_account_id, PayPal from a set paypal_link —
-- with no master online_payments_enabled flag. The column is dropped in a later migration.
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
         p.stripe_connect_account_id, p.paypal_link
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
    -- Card is offered whenever Stripe is connected and the invoice is still payable.
    'can_pay', (inv.stripe_connect_account_id is not null and inv.status not in ('paid','void')),
    -- PayPal link is shown whenever it is set and the invoice is still payable.
    'paypal_link', case when inv.status not in ('paid','void') then inv.paypal_link else null end,
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
```

- [ ] **Step 2: Apply to hosted dev**

Apply to project `zbipqfsqxnvrzhpdjvvy` via Supabase MCP `apply_migration` (name `payflow_connection_derived`, body = the SQL above). Expect an auto-generated version timestamp — cosmetic, fine.

- [ ] **Step 3: Verify the function no longer references the flag and still runs**

Run (Supabase MCP `execute_sql`):

```sql
select pg_get_functiondef('public.get_public_invoice(text)'::regprocedure) ilike '%online_payments_enabled%' as still_references_flag;
```

Expected: `still_references_flag = false`.

Then smoke it against a real token (returns `null` cleanly if there are no invoices — that's an acceptable pass):

```sql
select get_public_invoice((select public_token from public.invoices where public_token is not null limit 1)) -> 'can_pay' as can_pay_sample;
```

Expected: either a boolean (`true`/`false`) or `null` (no rows) — no error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260625100000_payflow_connection_derived.sql
git commit -m "feat(payments): derive public-invoice can_pay/paypal from connection state (LOO-91)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `paymentMethods` pure helper + unit tests

**Files:**
- Create: `src/lib/payments.js`
- Test: `src/lib/__tests__/payments.test.js`

**Interfaces:**
- Produces: `paymentMethods(issuer) -> string[]`, an ordered subset of `['card', 'paypal']`. `issuer` is the public-invoice payment shape `{ can_pay?: boolean, paypal_link?: string | null }` (the object returned by `get_public_invoice`). `'card'` is included when `issuer.can_pay` is truthy; `'paypal'` is included when `issuer.paypal_link` is a non-empty (trimmed) string. Order is always card-before-paypal. Missing/`null`/`undefined` `issuer` → `[]`. Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/payments.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { paymentMethods } from '@/lib/payments'

describe('paymentMethods', () => {
  it('returns ["card"] when only Stripe is connected (can_pay true, no paypal)', () => {
    expect(paymentMethods({ can_pay: true, paypal_link: null })).toEqual(['card'])
  })

  it('returns ["paypal"] when only a PayPal link is set', () => {
    expect(paymentMethods({ can_pay: false, paypal_link: 'paypal.me/jane' })).toEqual(['paypal'])
  })

  it('returns ["card","paypal"] in that order when both are available', () => {
    expect(paymentMethods({ can_pay: true, paypal_link: 'paypal.me/jane' })).toEqual(['card', 'paypal'])
  })

  it('returns [] when neither is available', () => {
    expect(paymentMethods({ can_pay: false, paypal_link: null })).toEqual([])
  })

  it('ignores a blank/whitespace paypal_link', () => {
    expect(paymentMethods({ can_pay: false, paypal_link: '   ' })).toEqual([])
  })

  it('returns [] for missing/undefined issuer (no throw)', () => {
    expect(paymentMethods(undefined)).toEqual([])
    expect(paymentMethods(null)).toEqual([])
    expect(paymentMethods({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/payments.test.js`
Expected: FAIL — `paymentMethods` is not exported / not defined.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/payments.js`:

```js
// Ordered list of online payment methods a client can use on the public invoice page,
// derived from the public-invoice payload (which already encodes connection state on the
// server). 'card' = issuer has Stripe connected (the RPC's can_pay); 'paypal' = issuer set a
// PayPal link. Pure — the page passes the get_public_invoice result in. Card before PayPal.
export function paymentMethods(issuer) {
  const i = issuer ?? {}
  const methods = []
  if (i.can_pay) methods.push('card')
  if (typeof i.paypal_link === 'string' && i.paypal_link.trim() !== '') methods.push('paypal')
  return methods
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/payments.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments.js src/lib/__tests__/payments.test.js
git commit -m "feat(payments): paymentMethods helper for offered online methods (LOO-91)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `PaymentsTab` rework — drop the master toggle, three live blocks (Impeccable)

**Files:**
- Modify: `src/features/profile/PaymentsTab.jsx`

**Interfaces:**
- Consumes: existing `useProfile`/`useUpdateProfile`, `invokeEdge('stripe-connect', {})`, `paymentsAreReal`.
- Produces: no exported API change — same `PaymentsTab` component; it no longer reads or writes `online_payments_enabled`.

- [ ] **Step 1: Run Impeccable for the reframed layout**

Invoke `/impeccable` (craft) to refine the settings layout into a single "How clients can pay you" group with an intro line and **three always-live blocks** — Payment instructions, Stripe, PayPal — matching Slate Pro tokens and the existing `Card`/autosave pattern. There must be **no greyed/dimmed-but-interactive** controls (the bug LOO-91 reported): every block is fully live. Intro copy verbatim: *"Clients always see your payment instructions. Connect Stripe or PayPal to also let them pay online — they choose how."*

- [ ] **Step 2: Implement the change**

Replace `src/features/profile/PaymentsTab.jsx` with the following (Impeccable refines the heading/spacing, but keep this structure, the autosave wiring, and the unchanged Stripe/PayPal handlers). The diff vs. today: remove `onlineEnabled`, `setOnline`, the master-toggle `Card`, the `dimmed` prop on `PayPalLinkCard`, and the `opacity-60` classes; add the intro block.

```jsx
import { useEffect, useRef, useState } from 'react'
import { CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { invokeEdge } from '@/api/edge'
import { paymentsAreReal } from '@/lib/providers'

// Default payment instructions autosave (debounced) — no manual Save.
function DefaultInstructionsCard({ profile, update }) {
  const [value, setValue] = useState(profile.default_payment_instructions || '')
  const [status, setStatus] = useState('idle')
  const timer = useRef(null)
  const idle = useRef(null)

  const save = async (v) => {
    setStatus('saving')
    try {
      await update.mutateAsync({ default_payment_instructions: v })
      setStatus('saved')
      clearTimeout(idle.current)
      idle.current = setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }
  const onChange = (v) => {
    setValue(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(v), 700)
  }
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(idle.current) }, [])

  return (
    <Card className="space-y-2">
      <Label htmlFor="pay-instructions">Default payment instructions</Label>
      <Textarea
        id="pay-instructions"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Bank transfer to IBAN … · or pay cash on delivery"
      />
      <div className="flex h-5 justify-end">
        <SaveStatus status={status} onRetry={() => save(value)} />
      </div>
    </Card>
  )
}

// PayPal.me link autosave (debounced) — invoices render a "Pay with PayPal" button.
function PayPalLinkCard({ profile, update }) {
  const [value, setValue] = useState(profile.paypal_link || '')
  const [status, setStatus] = useState('idle')
  const timer = useRef(null)
  const idle = useRef(null)

  const save = async (v) => {
    setStatus('saving')
    try {
      await update.mutateAsync({ paypal_link: v.trim() || null })
      setStatus('saved')
      clearTimeout(idle.current)
      idle.current = setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }
  const onChange = (v) => {
    setValue(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(v), 700)
  }
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(idle.current) }, [])

  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold">PayPal</h3>
      <p className="text-sm text-fg-muted">
        Add your PayPal.me link or username — invoices show a “Pay with PayPal” button. There’s no auto-reconcile, so
        you confirm receipt with <span className="font-medium">Mark as paid</span>.
      </p>
      <Label htmlFor="paypal-link">PayPal.me link or username</Label>
      <Input
        id="paypal-link"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="paypal.me/yourname  ·  or just yourname"
      />
      <div className="flex h-5 justify-end">
        <SaveStatus status={status} onRetry={() => save(value)} />
      </div>
    </Card>
  )
}

export function PaymentsTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const [connecting, setConnecting] = useState(false)
  const connected = !!profile?.stripe_connect_account_id && profile.stripe_connect_account_id !== 'mock_connect'
  const mockConnected = profile?.stripe_connect_account_id === 'mock_connect'

  const connectReal = async () => {
    setConnecting(true)
    try {
      const { url } = await invokeEdge('stripe-connect', {})
      window.location.href = url
    } catch (e) {
      toast.error(e.userMessage || 'Could not start Stripe onboarding')
      setConnecting(false)
    }
  }

  const toggleStripe = async (next) => {
    try {
      await update.mutateAsync({ stripe_connect_account_id: next ? 'mock_connect' : null })
      toast.success(next ? 'Stripe connected (simulated)' : 'Stripe disconnected')
    } catch (e) {
      toast.error(e.userMessage || 'Could not update')
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold">How clients can pay you</h2>
        <p className="mt-0.5 text-sm text-fg-muted">
          Clients always see your payment instructions. Connect Stripe or PayPal to also let them pay online — they choose how.
        </p>
      </div>

      {/* Payment instructions — the universal cash/bank baseline, prefilled onto new invoices. */}
      {profile ? <DefaultInstructionsCard key={profile.id} profile={profile} update={update} /> : null}

      {/* Stripe (card payments) — always live; connect/disconnect is the switch. */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <h3 className="text-sm font-semibold">Stripe (card payments)</h3>
          {connected || mockConnected ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3" /> {mockConnected ? 'Connected (simulated)' : 'Connected'}
            </Badge>
          ) : (
            <Badge>Not connected</Badge>
          )}
        </div>
        <p className="text-sm text-fg-muted">Connect Stripe so clients can pay invoices by card. Available in Stripe-supported countries.</p>
        {paymentsAreReal ? (
          <Button onClick={connectReal} loading={connecting}>
            {connected ? 'Manage Stripe account' : 'Connect Stripe'}
          </Button>
        ) : mockConnected ? (
          <Button variant="secondary" onClick={() => toggleStripe(false)} loading={update.isPending}>Disconnect</Button>
        ) : (
          <Button onClick={() => toggleStripe(true)} loading={update.isPending}>Connect Stripe (simulated)</Button>
        )}
      </Card>

      {/* PayPal (link MVP) — always live. */}
      {profile ? <PayPalLinkCard key={profile.id} profile={profile} update={update} /> : null}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run the dev server, open `/profile` (Payments tab):
- No "Accept online payments" checkbox; no greyed-out blocks — all three blocks are fully interactive.
- Editing instructions or the PayPal link still autosaves (SaveStatus cycles to saved).
- Stripe connect/disconnect (or simulated, in dev) still works.

Run lint: `npm run lint` → no new errors in `PaymentsTab.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/PaymentsTab.jsx
git commit -m "feat(payments): remove master toggle; connected=offered settings (LOO-91)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `PublicInvoicePage` — "Pay this invoice" card + instructions fallback (Impeccable)

**Files:**
- Modify: `src/pages/PublicInvoicePage.jsx`

**Interfaces:**
- Consumes: `paymentMethods` (Task 2); the Task 1 RPC fields `can_pay`, `paypal_link`, `payment_instructions`, `currency`, `status`, `line_items`; `formatCurrency` from `@/lib/currency`; existing `paymentsAreReal`, `invokeEdge('stripe-checkout', { token })`, `paypalHref`, `invoiceTotals`, `useMockPay`.
- Produces: no exported API change — same default-exported page; the route `/i/:token` is unchanged.

- [ ] **Step 1: Run Impeccable for the pay card**

Invoke `/impeccable` (craft) for a **"Pay this invoice"** card placed near the top of the page (below the header, above the invoice body): it shows **Amount due** + one button per offered method (**Pay by card** / **Pay with PayPal**); when no online method is offered it shows the payment instructions prominently; when there are none of either, a neutral line. Slate Pro tokens; no blocking modal. "Download PDF" stays in the header.

- [ ] **Step 2: Implement the change**

Replace `src/pages/PublicInvoicePage.jsx` with the following (Impeccable refines the card visuals; keep the data wiring, the `onPay` branching, and the paid-state logic). The diff vs. today: add the `formatCurrency` and `paymentMethods` imports; remove the two header pay buttons (leaving only Download PDF); compute `methods`; render the paid banner **or** the pay card.

```jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Download, CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePublicInvoice, useMockPay } from '@/hooks/usePublicInvoice'
import { PublicInvoiceView } from '@/features/invoices/PublicInvoiceView'
import { invokeEdge } from '@/api/edge'
import { paymentsAreReal } from '@/lib/providers'
import { invoiceTotals } from '@/lib/money'
import { paypalHref } from '@/lib/paypal'
import { paymentMethods } from '@/lib/payments'
import { formatCurrency } from '@/lib/currency'

export default function PublicInvoicePage() {
  const { token } = useParams()
  const { data, isLoading, refetch } = usePublicInvoice(token)
  const pay = useMockPay()
  const [paid, setPaid] = useState(false)
  const [paying, setPaying] = useState(false)

  // Returning from a real Stripe Checkout lands on /i/:token?paid=1 — reflect it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('paid') === '1') {
      setPaid(true)
      refetch()
    }
  }, [refetch])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Skeleton className="h-96" />
      </div>
    )
  }

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
      invoice_number: data.invoice_number,
      issue_date: data.issue_date,
      due_date: data.due_date,
      currency: data.currency,
      notes: data.notes,
      terms: data.terms,
      payment_instructions: data.payment_instructions,
      invoice_line_items: data.line_items,
    }
    const profile = { ...data.issuer, subscription_tier: data.issuer.tier }
    const blob = await buildInvoiceBlob({ invoice, client: data.client, profile })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const onPay = async () => {
    setPaying(true)
    try {
      if (paymentsAreReal) {
        const { url } = await invokeEdge('stripe-checkout', { token })
        window.location.href = url // hand off to Stripe Checkout
        return
      }
      await pay.mutateAsync(token)
      setPaid(true)
      await refetch()
    } catch (e) {
      toast.error(e.userMessage || 'Payment could not be completed')
    } finally {
      setPaying(false)
    }
  }

  const isPaid = paid || data.status === 'paid'
  const total = invoiceTotals(
    (data.line_items || []).map((li) => ({
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      tax_rate: Number(li.tax_rate),
      discount_rate: Number(li.discount_rate),
    }))
  ).total
  const paypalUrl = data.paypal_link ? paypalHref(data.paypal_link, total, data.currency) : null
  const methods = isPaid ? [] : paymentMethods({ can_pay: data.can_pay, paypal_link: data.paypal_link })

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="LoomLance" className="size-8" />
          <Button variant="secondary" size="sm" onClick={download}>
            <Download className="size-4" /> Download PDF
          </Button>
        </div>

        {isPaid ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> This invoice has been paid. Thank you!
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-muted">Amount due</p>
                <p className="text-xl font-semibold text-fg">{formatCurrency(total, data.currency)}</p>
              </div>
              <h2 className="text-sm font-semibold text-fg">Pay this invoice</h2>
            </div>
            {methods.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {methods.includes('card') ? (
                  <Button onClick={onPay} loading={paying || pay.isPending}>
                    <CreditCard className="size-4" /> Pay by card
                  </Button>
                ) : null}
                {methods.includes('paypal') && paypalUrl ? (
                  <Button variant="secondary" onClick={() => window.open(paypalUrl, '_blank', 'noopener')}>
                    Pay with PayPal
                  </Button>
                ) : null}
              </div>
            ) : data.payment_instructions ? (
              <div className="mt-3 whitespace-pre-line rounded-md bg-bg-muted p-3 text-sm text-fg">
                {data.payment_instructions}
              </div>
            ) : (
              <p className="mt-3 text-sm text-fg-muted">Contact the sender to arrange payment.</p>
            )}
          </div>
        )}

        <PublicInvoiceView data={data} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

This page needs the running app and a real invoice token. Reason through + (if a token is available) check in the browser:
- Issuer with Stripe connected → "Pay by card" button shows; clicking hands off to mock-pay (dev) / Stripe Checkout (real).
- Issuer with a PayPal link → "Pay with PayPal" opens the PayPal URL.
- Both → both buttons, card first.
- Neither → the card shows the payment instructions (or the neutral "Contact the sender…" line when there are none).
- Paid invoice → paid banner, no pay card.

Run lint: `npm run lint` → no new errors in `PublicInvoicePage.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PublicInvoicePage.jsx
git commit -m "feat(payments): client-choice 'Pay this invoice' card on public page (LOO-91)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Drop `profiles.online_payments_enabled` (now unreferenced)

**Files:**
- Create: `supabase/migrations/20260625110000_drop_online_payments_enabled.sql`

**Interfaces:**
- Produces: `profiles` no longer has `online_payments_enabled`. By this point nothing references it (Task 1 removed the function's use; Task 3 removed the settings page's read/write; no RLS/trigger references it).

- [ ] **Step 1: Confirm there are no remaining references**

Run (repo search): `git grep -n online_payments_enabled -- src supabase | grep -v 20260621 | grep -v 20260625100000`
Expected: no matches (only the historical phase-5 migrations and — if you haven't migrated yet — none in current `src`). If anything in `src/` still references it, fix that first; do not drop the column with live readers.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/20260625110000_drop_online_payments_enabled.sql`:

```sql
-- LOO-91: the master online-payments flag is gone — availability is derived from connection
-- state (see 20260625100000_payflow_connection_derived). Verified at design time: 0 accounts
-- were "online-off but provider-connected", so dropping changes no current account's behavior.
alter table public.profiles drop column if exists online_payments_enabled;
```

- [ ] **Step 3: Apply to hosted dev**

Apply via Supabase MCP `apply_migration` (name `drop_online_payments_enabled`).

- [ ] **Step 4: Verify the column is gone and the function still resolves**

```sql
select count(*) as col_count
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'online_payments_enabled';
```

Expected: `col_count = 0`. Then re-run the Task 1 smoke (`select get_public_invoice(...) -> 'can_pay'`) and confirm it still runs without error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260625110000_drop_online_payments_enabled.sql
git commit -m "feat(payments): drop profiles.online_payments_enabled (LOO-91)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify — lint, tests, build, manual matrix + Linear

**Files:** none (verification only).

- [ ] **Step 1: Full unit test run**

Run: `npx vitest run`
Expected: all suites pass, including the new `payments.test.js` (6 tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (no new errors).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual matrix (per spec "Testing")**

- Settings page has **no greyed/disabled-but-clickable** controls.
- Connect both Stripe + PayPal → pay page shows both buttons (card first).
- Disconnect Stripe → only PayPal. Clear PayPal → only card. None → instructions shown (or neutral line).
- Paid invoice → paid banner, no pay card.

- [ ] **Step 5: Update Linear LOO-91 + dual-home note**

Move LOO-91 to In Review (or the appropriate state), comment with the commit list and the two documented deviations (helper input shape; migration ordering). Update local docs/memory per the dual-home rule.

---

## Self-Review

**Spec coverage:**
- Drop master toggle / `online_payments_enabled`; connected = offered → Tasks 1, 3, 5 ✅
- No per-provider enable flag (YAGNI) → Task 3 (connect/disconnect is the switch) ✅
- Cash/bank instructions always shown → Task 3 (always-live block) + Task 4 (fallback) ✅
- Pay page = explicit client choice, button per method, instructions when none → Task 4 ✅
- `paymentMethods(issuer)` pure helper + unit tests (card/paypal/both/none) → Task 2 ✅
- `PaymentsTab` reframed "How clients can pay you", three live blocks, helper line → Task 3 ✅
- `PublicInvoicePage` "Pay this invoice" card, keep Download PDF, keep `paymentsAreReal` branch + paid banner → Task 4 ✅
- Public-invoice source derives availability from connection, not the dropped flag → Task 1 ✅
- Migration: drop the column (sequenced safely) → Task 5 ✅
- Error/edge: no method + no instructions → neutral line; 0 affected accounts → Tasks 4, 5 ✅
- Testing: unit for helper; manual matrix → Tasks 2, 6 ✅

**Placeholder scan:** No TBD/"handle edge cases"/empty-test placeholders — every step carries real SQL/JSX/commands.

**Type consistency:** Helper returns `string[]` from `['card','paypal']`; Task 4 reads `methods.includes('card'|'paypal')`. Helper input `{ can_pay, paypal_link }` matches the Task 1 RPC's returned fields exactly. `formatCurrency(amount, currency)` matches `@/lib/currency`. `invoiceTotals(...).total` and `paypalHref(link, total, currency)` match existing usage. RPC JSON keys (`can_pay`, `paypal_link`, `payment_instructions`, `currency`, `status`, `line_items`, `issuer`, `client`) preserved identically from the current function.

**Deviations from spec wording (deliberate, documented in Global Constraints):**
1. `paymentMethods` consumes `{ can_pay, paypal_link }` (the public payload), not the raw `stripe_connect_account_id`, to keep the Connect account id off the public wire. `can_pay` already encodes "Stripe connected."
2. Migration order reversed: update the RPC first (Task 1), drop the column last (Task 5), to avoid the live function referencing a dropped column.
