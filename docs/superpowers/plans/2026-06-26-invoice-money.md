# Invoice Money: Rounding Consolidation + Partial Payments (LOO-33, LOO-35)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (LOO-33) Make the Stripe charge equal the displayed `money.js` invoice total to the cent, by routing both Stripe edge functions through one shared total algorithm. (LOO-35) Let the freelancer record **partial** manual payments and show a balance, replacing the "always full total + force paid" behavior.

**Architecture:** `money.js` is the single source of truth for invoice totals. Port it verbatim to a shared Deno module (`supabase/functions/_shared/money.ts`) and make `stripe-checkout` (charge) and `stripe-webhook` (expected amount) both use it, so all layers agree. For partial payments, add a `partially_paid` status; `MarkPaidModal` records an editable amount against the remaining balance and sets `paid` vs `partially_paid` accordingly; the invoice detail surfaces payments + balance. Partial payment is **manual/owner-side only** — the Stripe Checkout card path and the public page are unchanged (a Checkout session always collects the full amount; mixing card with manual partials is out of scope and would risk overcharging).

**Tech Stack:** React + Vite, Supabase (hosted dev `zbipqfsqxnvrzhpdjvvy`, apply via MCP), Deno edge functions (Stripe), Vitest, react-hook-form + zod, Impeccable for UI.

## Global Constraints

- **`money.js` is the single source of truth.** The Deno port must be a faithful, documented mirror of `src/lib/money.js` (`lineTotal` + `invoiceTotals`); add a comment in each pointing at the other, and a parity test locking the JS behavior.
- **Stripe must charge exactly `invoiceTotals(items).total`.** `stripe-checkout` builds itemized lines but reconciles their cent-sum to `round(invoiceTotals.total * 100)`; `stripe-webhook`'s expected amount uses the same shared `invoiceTotals`.
- **Partial payments are manual/owner-side only.** Do NOT change `stripe-webhook`'s payment-recording branches, the public invoice page's "Amount due", or `get_public_invoice`. Card payments remain full-amount. Note this limitation in the LOO-35 Linear close.
- **`invoice_payments.amount > 0`** CHECK (LOO-26) stays; the modal must also cap the amount at the remaining balance.
- **Status math uses a cent epsilon:** treat the invoice as fully `paid` when `sum(payments) >= total - 0.005` to avoid floating-point/rounding lockout; otherwise `partially_paid`.
- **All UI via Impeccable** (Slate Pro tokens), matching existing invoice components.
- Hosted dev `zbipqfsqxnvrzhpdjvvy`; apply migrations + redeploy edge functions via MCP (auto-timestamp cosmetic). Push is manual/gated — commit locally.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## File Structure

- `supabase/functions/_shared/money.ts` — **create** (Task 1): Deno port of `money.js`.
- `src/lib/__tests__/money.test.js` — **modify** (Task 1): lock the parity contract if not already covered.
- `supabase/functions/stripe-checkout/index.ts` — **modify** (Task 2).
- `supabase/functions/stripe-webhook/index.ts` — **modify** (Task 3).
- `supabase/migrations/20260626000000_invoice_partially_paid.sql` — **create** (Task 4).
- `src/api/schemas/invoices.js` — **modify** (Task 4): add enum value.
- `src/features/invoices/MarkPaidModal.jsx`, `src/features/invoices/InvoiceActions.jsx` — **modify** (Task 5).
- Invoice detail payments/balance display + status badge — **modify** (Task 6).

---

## Part A — LOO-33: rounding consolidation

### Task 1: Shared `money.ts` Deno port + parity test

**Files:**
- Create: `supabase/functions/_shared/money.ts`
- Modify (if needed): `src/lib/__tests__/money.test.js`

**Interfaces:**
- Produces: `lineTotal(line)` and `invoiceTotals(lines)` in Deno, byte-equivalent math to `src/lib/money.js`. Consumed by Tasks 2 & 3. The `items` passed by the edge functions have `{ quantity, unit_price, tax_rate, discount_rate }` (strings or numbers — coerce with `Number()`).

- [ ] **Step 1: Port the module**

Create `supabase/functions/_shared/money.ts` mirroring `src/lib/money.js` exactly (same `round2`, `lineTotal`, `invoiceTotals`), with `Number(...)` coercion on inputs and a header comment: `// PARITY: exact port of src/lib/money.js — keep in sync.` Export `lineTotal`, `invoiceTotals`.

```ts
// PARITY: exact port of src/lib/money.js — keep the algorithm identical.
const round2 = (n: number) => Math.round(n * 100) / 100

export function lineTotal(line: { quantity?: number|string; unit_price?: number|string; tax_rate?: number|string; discount_rate?: number|string }) {
  const quantity = Number(line.quantity) || 0
  const unit_price = Number(line.unit_price) || 0
  const tax_rate = Number(line.tax_rate) || 0
  const discount_rate = Number(line.discount_rate) || 0
  const gross = quantity * unit_price
  const discount = round2(gross * (discount_rate / 100))
  const net = gross - discount
  const tax = round2(net * (tax_rate / 100))
  return { subtotal: round2(gross), discount, tax, total: round2(net + tax) }
}

export function invoiceTotals(lines: Array<Record<string, unknown>>) {
  let subtotal = 0, discount = 0
  const taxByRate: Record<string, number> = {}
  for (const line of lines ?? []) {
    const r = lineTotal(line as any)
    subtotal += r.subtotal
    discount += r.discount
    const rate = Number((line as any).tax_rate) || 0
    if (rate > 0) taxByRate[rate] = round2((taxByRate[rate] ?? 0) + r.tax)
  }
  const totalTax = round2(Object.values(taxByRate).reduce((a, b) => a + b, 0))
  return { subtotal: round2(subtotal), discount: round2(discount), taxByRate, totalTax, total: round2(subtotal - discount + totalTax) }
}
```

- [ ] **Step 2: Lock the parity contract in the JS test**

Open `src/lib/__tests__/money.test.js`. Ensure there is at least one case that pins a multi-line invoice with mixed tax + discount + quantity>1 to an exact `invoiceTotals(...).total`. If absent, add:

```js
it('LOO-33 parity anchor: mixed qty/discount/tax grand total', () => {
  const lines = [
    { quantity: 3, unit_price: 3.33, tax_rate: 10, discount_rate: 0 },
    { quantity: 2, unit_price: 10, tax_rate: 0, discount_rate: 15 },
  ]
  expect(invoiceTotals(lines).total).toBe(27.99)
})
```
(Compute the real expected value from the actual `money.js` before committing; replace `27.99` with the value the function returns. This anchor is what the Deno port must match.)

- [ ] **Step 3: Run the JS test**

Run: `npx vitest run src/lib/__tests__/money.test.js` → PASS.

- [ ] **Step 4: Add a header comment in `money.js`**

Add atop `src/lib/money.js`: `// PARITY: supabase/functions/_shared/money.ts mirrors this — keep in sync (LOO-33).`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/money.ts src/lib/money.js src/lib/__tests__/money.test.js
git commit -m "feat(money): shared Deno port of invoiceTotals for Stripe parity (LOO-33)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `stripe-checkout` charges exactly the money.js total

**Files:**
- Modify: `supabase/functions/stripe-checkout/index.ts`

**Interfaces:**
- Consumes: `invoiceTotals`, `lineTotal` from `../_shared/money.ts` (Task 1).
- Produces: a Checkout session whose line items' cents sum to `round(invoiceTotals(items).total * 100)`.

- [ ] **Step 1: Replace the per-unit line-item math**

In `supabase/functions/stripe-checkout/index.ts`, import `{ invoiceTotals, lineTotal } from '../_shared/money.ts'`. Replace the current `lineItems` builder (the `unit_amount: Math.round(withTax * 100)` per-unit version) with itemized lines whose **per-line** cents equal the money.js line total (quantity folded into the unit_amount, Stripe `quantity: 1`), then reconcile the sum to the money.js grand total:

```ts
const cents = (n: number) => Math.round(n * 100)
const grandTotalCents = cents(invoiceTotals(items ?? []).total)

const lineItems = (items ?? []).map((li: any) => ({
  price_data: {
    currency: String(inv.currency).toLowerCase(),
    product_data: { name: `${Number(li.quantity)} × ${li.description || 'Item'}` },
    unit_amount: cents(lineTotal(li).total), // full per-line total, quantity folded in
  },
  quantity: 1,
}))

// Reconcile any residual cent (bucketed tax rounding) onto the last line so the
// charged sum == the money.js grand total exactly.
const built = lineItems.reduce((s, l) => s + l.price_data.unit_amount, 0)
const delta = grandTotalCents - built
if (delta !== 0 && lineItems.length > 0) {
  lineItems[lineItems.length - 1].price_data.unit_amount += delta
}
```

Guard: if `lineItems` is empty or `grandTotalCents <= 0`, keep the existing error/early-return behavior (don't create a zero session). Confirm `items`/`inv.currency` are the same variables the current code uses (read the file).

- [ ] **Step 2: Redeploy**

Redeploy `stripe-checkout` via MCP `deploy_edge_function`, including `stripe-checkout/index.ts` + `_shared/money.ts` (+ any existing `_shared/*` it already imports, e.g. cors), path-preserving, `entrypoint_path = "stripe-checkout/index.ts"`.

- [ ] **Step 3: Verify**

Confirm deploy version bumped (`list_edge_functions`). Reason through the example from scoping (`qty=3, unit_price=3.33, tax=10%`): money.js line total `10.99` → `unit_amount=1099, quantity=1`; grand total reconciled to `invoiceTotals.total`. Note in report. (No live charge here.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-checkout/index.ts
git commit -m "fix(payments): stripe-checkout charges exact money.js total (LOO-33)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `stripe-webhook` expected amount uses the shared total

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

**Interfaces:**
- Consumes: `invoiceTotals` from `../_shared/money.ts`.
- Produces: `expectedAmountCents(items)` returns `round(invoiceTotals(items).total * 100)` — identical basis to Task 2, so the underpayment guard compares like-for-like.

- [ ] **Step 1: Replace `expectedAmountCents`**

In `supabase/functions/stripe-webhook/index.ts`, import `{ invoiceTotals } from '../_shared/money.ts'` and replace the local `expectedAmountCents` (the per-unit `cents += Math.round(withTax*100) * quantity` version) with:

```ts
const expectedAmountCents = (items: any[]) => Math.round(invoiceTotals(items ?? []).total * 100)
```

Leave the rest of the webhook (the `paidCents < expected` mismatch branch, the insert, the status set) unchanged.

- [ ] **Step 2: Redeploy**

Redeploy `stripe-webhook` via MCP including `stripe-webhook/index.ts` + `_shared/money.ts` (+ existing shared imports), path-preserving.

- [ ] **Step 3: Verify**

Confirm version bump. Confirm by reading that `expectedAmountCents` now matches the Task 2 charge basis (both = `round(invoiceTotals.total*100)`), so a correct Stripe payment passes the guard. Note in report.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "fix(payments): stripe-webhook expected amount uses shared total (LOO-33)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Part B — LOO-35: partial payments (manual/owner-side)

### Task 4: `partially_paid` status (DB enum + Zod)

**Files:**
- Create: `supabase/migrations/20260626000000_invoice_partially_paid.sql`
- Modify: `src/api/schemas/invoices.js`

**Interfaces:**
- Produces: `invoice_status` enum gains `'partially_paid'`; the invoices Zod `status` enum includes it. Consumed by Tasks 5 & 6.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260626000000_invoice_partially_paid.sql`:

```sql
-- LOO-35: partial (manual) payments. An invoice with some but not all of its
-- balance recorded sits in 'partially_paid' until the balance clears.
alter type public.invoice_status add value if not exists 'partially_paid';
```

(PG15 allows `ADD VALUE` outside a txn-using context; the new value is not used within this migration, so it applies cleanly.)

- [ ] **Step 2: Apply + verify**

Apply via MCP `apply_migration` (name `invoice_partially_paid`). Verify:
```sql
select 'partially_paid' = any(enum_range(null::public.invoice_status)::text[]) as has_value;
```
Expected `has_value = true`.

- [ ] **Step 3: Update the Zod enum**

In `src/api/schemas/invoices.js`, add `'partially_paid'` to the `status` enum list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260626000000_invoice_partially_paid.sql src/api/schemas/invoices.js
git commit -m "feat(invoices): add partially_paid status (LOO-35)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `MarkPaidModal` records partial amounts (Impeccable)

**Files:**
- Modify: `src/features/invoices/MarkPaidModal.jsx`, `src/features/invoices/InvoiceActions.jsx`

**Interfaces:**
- Consumes: `useInvoicePayments(invoice.id)` (existing hook), `invoiceTotals`, `useCreatePayment`, `useUpdateInvoice`.
- Produces: a payment insert with the entered amount + a status of `paid` (balance cleared) or `partially_paid` (balance remaining).

- [ ] **Step 1: Run Impeccable**

Invoke `/impeccable` (craft) to refine the modal: show **Invoice total**, **Already paid**, **Balance due** (computed), default the amount input to the balance, and a clear label. Slate Pro tokens; matches the existing modal.

- [ ] **Step 2: Rework the modal**

In `MarkPaidModal.jsx`:
- Read existing payments: `const { data: payments = [] } = useInvoicePayments(invoice.id)`.
- `const total = invoiceTotals(invoice.invoice_line_items || []).total`
- `const alreadyPaid = round2(payments.reduce((s, p) => s + Number(p.amount), 0))` (import/define a 2dp round)
- `const balance = round2(total - alreadyPaid)`
- Default the form `amount` to `balance` (not `total`).
- Validate: amount `> 0` and `<= balance + 0.005` (cap at balance; the existing `paymentCreateSchema` keeps `> 0` — add the max-balance check in the form, e.g. a `superRefine` or an inline check before submit, surfacing a field error).
- `onSubmit`: after `create.mutateAsync({ ...values, amount })`, compute `const paidAfter = round2(alreadyPaid + Number(values.amount))` and set status conditionally:
  ```js
  const fullyPaid = paidAfter >= total - 0.005
  await update.mutateAsync({ id: invoice.id, patch: { status: fullyPaid ? 'paid' : 'partially_paid', paid_at: fullyPaid ? new Date().toISOString() : null } })
  toast.success(fullyPaid ? 'Invoice marked as paid' : 'Partial payment recorded')
  ```
- Display the balance breakdown (Impeccable-refined) above the amount field.

- [ ] **Step 3: Allow re-opening on partially_paid**

In `InvoiceActions.jsx`, add `'partially_paid'` to the `canMarkPaid` status array so a partially-paid invoice can receive further payments. If the action label is "Mark paid", keep it (or relabel to "Record payment" — Impeccable's call), but the action must be available for `partially_paid`.

- [ ] **Step 4: Verify**

Dev server: on a sent invoice, record a partial amount → status becomes `partially_paid`, toast "Partial payment recorded"; reopen → balance reflects the prior payment; pay the remainder → status `paid`. Run `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/invoices/MarkPaidModal.jsx src/features/invoices/InvoiceActions.jsx
git commit -m "feat(invoices): record partial payments against balance (LOO-35)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Surface payments + balance + status badge (Impeccable)

**Files:**
- Modify: the invoice detail view (`src/pages/InvoiceDetailPage.jsx` and/or `InvoiceActions`/editor area) and wherever the status badge renders (invoice list + detail).

**Interfaces:**
- Consumes: `useInvoicePayments`, `invoiceTotals`. Produces: a read-only payments summary (Total / Paid / Balance + a payment list) and a `partially_paid` badge label/variant.

- [ ] **Step 1: Run Impeccable**

Invoke `/impeccable` (craft) for a compact **Payments** summary on the invoice detail: Total, Paid, Balance due, and a small list of recorded payments (date · method · amount). Slate Pro tokens; read-only.

- [ ] **Step 2: Implement the summary**

Add the payments summary to the invoice detail page (it already fetches `invoice_payments(*)` via `getInvoice`). Show Total / Paid (`sum(payments.amount)`) / Balance, and the payment rows. Only render the summary when there is at least one payment OR the status is `paid`/`partially_paid`.

- [ ] **Step 3: Status badge**

Find where invoice status renders as a badge (invoice list `src/pages/InvoicesPage.jsx` and detail). Add a `partially_paid` → label "Partially paid" with an appropriate (e.g. warning/info) variant. Ensure no switch/map defaults a partially_paid invoice to an unstyled/blank state.

- [ ] **Step 4: Verify**

Dev server: a partially-paid invoice shows the "Partially paid" badge in the list + detail, and the detail shows Total/Paid/Balance + the payment row. Run `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoices): payments summary + partially-paid badge (LOO-35)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verify + Linear

- [ ] **Step 1:** `npx vitest run` → all pass (incl. money parity anchor).
- [ ] **Step 2:** `npm run lint` → clean.
- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4:** Close **LOO-33** (Done) — comment: shared `_shared/money.ts`; `stripe-checkout` + `stripe-webhook` now charge/expect exactly `invoiceTotals().total`. Close **LOO-35** (Done) — comment: manual partial payments + `partially_paid` status + balance UI; note the explicit scope limit (card/public path unchanged — Checkout collects full amount). Mirror to local docs/memory.

---

## Self-Review

**Spec coverage:**
- LOO-33 three-layer divergence → reduced to one source (`money.js`), ported to Deno, both Stripe functions routed through it → Tasks 1–3 ✅ (DB layer already gone with `mock_pay_invoice`).
- LOO-35 partial amounts + status + visibility → Tasks 4–6 ✅; manual-only scope stated.

**Placeholder scan:** none — real SQL/TS/JSX/commands; the one numeric placeholder (`27.99`) is explicitly flagged to compute from `money.js`.

**Type consistency:** shared `money.ts` mirrors `money.js` (`lineTotal`/`invoiceTotals`, same fields). `stripe-checkout` charge basis == `stripe-webhook` expected basis == `round(invoiceTotals.total*100)`. Status enum value `'partially_paid'` consistent across migration + Zod + modal + badge. Epsilon `0.005` used consistently for the paid/partially-paid boundary.

**Risk notes:** edge functions touch the LIVE payment path — both redeployed and reasoned through; behavior change is rounding-basis only. Partial payments deliberately exclude the card/public path to avoid overcharge. `ADD VALUE IF NOT EXISTS` is idempotent and PG15-safe.
