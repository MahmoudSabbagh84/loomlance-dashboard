# Go-Live Hardening (LOO-5 + P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the code/DB go-live blockers before production: remove the dev-only `mock_pay_invoice` public write (LOO-5), harden `send-invoice` (LOO-20), fix the one ownership gap found in the SECURITY DEFINER audit (`next_invoice_number`), and raise the minimum password length (LOO-34, config part).

**Architecture:** Five small, mostly independent changes — two DB migrations (one RPC hardening, one drop), one edge-function hardening, one frontend dead-code removal, one config bump — plus a verify pass. The mock-pay JS removal (Task 3) lands **before** the DB drop (Task 4) so nothing calls the function after it's gone.

**Tech Stack:** React + Vite, Supabase (hosted dev `zbipqfsqxnvrzhpdjvvy`, apply via MCP), Deno edge functions (AWS SES), Vitest.

## Global Constraints

- Hosted dev project `zbipqfsqxnvrzhpdjvvy`. Apply DB changes via Supabase MCP `apply_migration`; redeploy edge functions via MCP `deploy_edge_function`. MCP auto-generates migration version timestamps that differ cosmetically from the committed file name — expected, fine.
- **Push is manual/gated** — commit locally, do not push.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- `next_invoice_number` MUST stay EXECUTE-able by `authenticated` (the frontend calls it at `src/api/invoices.js:34`); the fix is an in-function ownership guard, NOT a revoke.
- The guard must allow `auth.uid() IS NULL` callers through (internal SECURITY DEFINER / pg_cron recurring-invoice generation legitimately passes the template owner's id) — use `auth.uid() is not null and p_user_id <> auth.uid()`.
- **Out of scope (owner config, NOT this plan):** enabling Supabase leaked-password protection (dashboard toggle), applying the new min-password-length to the live Auth instance (dashboard/CLI), Stripe live cutover, SES prod access, Amplify, PAT rotation. This plan only changes code/DB + `config.toml`.
- After Task 4, re-run `get_advisors(security)` and confirm `mock_pay_invoice` is no longer listed.
- The 6 other audited SECURITY DEFINER RPCs are already ownership-enforced — do NOT touch them.

## File Structure

- `supabase/migrations/20260625120000_harden_next_invoice_number.sql` — **create** (Task 1)
- `supabase/functions/send-invoice/index.ts` — **modify** (Task 2)
- `src/api/publicInvoice.js`, `src/hooks/usePublicInvoice.js`, `src/pages/PublicInvoicePage.jsx`, `src/lib/errors.js` — **modify** (Task 3)
- `supabase/migrations/20260625130000_drop_mock_pay_invoice.sql` — **create** (Task 4)
- `supabase/config.toml` — **modify** (Task 5)

---

### Task 1: Harden `next_invoice_number` ownership (SECURITY DEFINER audit fix)

**Files:**
- Create: `supabase/migrations/20260625120000_harden_next_invoice_number.sql`

**Interfaces:**
- Produces: `public.next_invoice_number(p_user_id uuid) returns text` unchanged in signature/behavior for legitimate callers, but now raises `UNAUTHORIZED` (errcode `P0001`) if an authenticated caller passes a `p_user_id` other than their own.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260625120000_harden_next_invoice_number.sql`. This is a full `create or replace` reproducing the current body (`20260617203513_contracts_and_invoices.sql:42-57`) plus the guard:

```sql
-- LOO-91 go-live audit: next_invoice_number is SECURITY DEFINER and EXECUTE-able by
-- authenticated (the app calls it on invoice create). Without a guard, a signed-in user
-- could pass another user's id and advance/observe their invoice sequence. Add an ownership
-- guard. auth.uid() is null for internal SECURITY DEFINER / pg_cron recurring callers, which
-- legitimately pass the template owner's id — allow those through.
create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  insert into public.invoice_number_sequences (user_id, last_number)
    values (p_user_id, 1)
  on conflict (user_id) do update set last_number = invoice_number_sequences.last_number + 1
  returning last_number into v_next;
  return 'INV-' || lpad(v_next::text, 4, '0');
end;
$$;
```

- [ ] **Step 2: Confirm the frontend caller passes the session user's id**

Read `src/api/invoices.js` around line 34. Confirm `p_user_id` is the authenticated user's own id (derived from the session), so the new guard does not break invoice creation. Note the finding in your report (no code change expected here).

- [ ] **Step 3: Apply to hosted dev**

Apply via Supabase MCP `apply_migration` (name `harden_next_invoice_number`).

- [ ] **Step 4: Verify**

```sql
select pg_get_functiondef('public.next_invoice_number(uuid)'::regprocedure) ilike '%UNAUTHORIZED%' as has_guard;
```
Expected: `has_guard = true`. Then a functional check — calling with your own id still works (run as service role here, which has null auth.uid(), so it should succeed):
```sql
select public.next_invoice_number('00000000-0000-0000-0000-000000000000') as sample;
```
Expected: returns an `INV-XXXX` string without error (service-role / null auth.uid() path). Paste both results into your report.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260625120000_harden_next_invoice_number.sql
git commit -m "fix(security): ownership guard on next_invoice_number RPC (go-live)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `send-invoice` hardening — subject CRLF strip + PDF size cap (LOO-20)

**Files:**
- Modify: `supabase/functions/send-invoice/index.ts`

**Interfaces:**
- Produces: same function contract; now rejects oversized PDFs with HTTP 413 and strips CR/LF from the caller-supplied `subject` before it reaches the MIME header.

- [ ] **Step 1: Add the PDF size cap**

In `supabase/functions/send-invoice/index.ts`, immediately after the request body is destructured (`const { invoiceId, to, cc, subject, body, pdfBase64 } = await req.json()`, ~line 24), add:

```ts
// Cap the attached PDF. SES's hard raw-message limit is 40 MB; 10 MB of base64
// (~7.5 MB decoded) is a sane ceiling and keeps the in-memory MIME string bounded.
const MAX_PDF_B64 = 10 * 1024 * 1024
if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > MAX_PDF_B64) {
  return json({ error: 'PDF attachment too large' }, 413)
}
```

- [ ] **Step 2: Strip CR/LF from the subject**

Find where the subject is resolved (~line 61, `const subj = subject ?? \`Invoice ${num} from ${businessName}\``). Replace it so a caller-supplied subject can't inject MIME headers:

```ts
const subj = subject
  ? String(subject).replace(/[\r\n]/g, ' ').slice(0, 200)
  : `Invoice ${num} from ${businessName}`
```

(The default branch already uses the CR/LF-stripped `businessName`.) Confirm `subj` is what's written to the `Subject:` header line (~line 101) and nothing else interpolates the raw `subject`.

- [ ] **Step 3: Redeploy the edge function to hosted dev**

Redeploy `send-invoice` via Supabase MCP `deploy_edge_function`. Include the function's own `index.ts` **and** any files it imports from `_shared/` (e.g. `_shared/cors.ts`), using path-preserving names and `entrypoint_path = "send-invoice/index.ts"`, the same way `contact-form` was deployed. Read the import lines at the top of `index.ts` first to enumerate the shared files to include.

- [ ] **Step 4: Verify deploy**

Confirm the new version is live (MCP `list_edge_functions` shows a bumped version for `send-invoice`). Note it in your report. (A full live SES send is an owner action — do not send real email here.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-invoice/index.ts
git commit -m "fix(security): send-invoice strips subject CRLF + caps PDF size (LOO-20)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Remove the dead mock-pay frontend path (LOO-5, part 1)

**Files:**
- Modify: `src/api/publicInvoice.js`, `src/hooks/usePublicInvoice.js`, `src/pages/PublicInvoicePage.jsx`, `src/lib/errors.js`

**Interfaces:**
- Produces: `onPay` on the public invoice page always hands off to `stripe-checkout`; the `useMockPay`/`mockPayInvoice` exports and the `MOCK_PAYMENTS_DISABLED` message are gone. No call-site outside these files references them (verified in scoping).

- [ ] **Step 1: Remove `mockPayInvoice` from the API layer**

In `src/api/publicInvoice.js`, delete the entire `mockPayInvoice` export (the `export async function mockPayInvoice(token) { … }` block). Keep `getPublicInvoice`.

- [ ] **Step 2: Remove `useMockPay` from the hook**

In `src/hooks/usePublicInvoice.js`: remove `mockPayInvoice` from the import (leaving `import { getPublicInvoice } from '@/api/publicInvoice'`), and delete the `export function useMockPay() { … }` block. `usePublicInvoice` stays.

- [ ] **Step 3: Simplify the public page**

In `src/pages/PublicInvoicePage.jsx`:
- Change the hook import to `import { usePublicInvoice } from '@/hooks/usePublicInvoice'` (drop `useMockPay`).
- Remove `import { paymentsAreReal } from '@/lib/providers'` (now unused here).
- Remove `const pay = useMockPay()`.
- Replace `onPay` with the always-real version:

```jsx
const onPay = async () => {
  setPaying(true)
  try {
    const { url } = await invokeEdge('stripe-checkout', { token })
    window.location.href = url // hand off to Stripe Checkout
  } catch (e) {
    toast.error(e.userMessage || 'Payment could not be completed')
  } finally {
    setPaying(false)
  }
}
```

- Change the card button's loading prop from `loading={paying || pay.isPending}` to `loading={paying}`.

(`setPaid` and `refetch` remain — they're still used by the `?paid=1` effect. The "Pay by card" button only renders when `data.can_pay`, which already requires a connected Stripe account, so removing the mock branch loses no reachable behavior.)

- [ ] **Step 4: Remove the dead error message**

In `src/lib/errors.js`, delete the `MOCK_PAYMENTS_DISABLED: '…'` entry from `CODE_MESSAGES` (only `mock_pay_invoice` could raise it).

- [ ] **Step 5: Lint + grep-confirm**

Run `npm run lint` → no new errors and no unused-import/var warnings in the four files. Then confirm the symbols are gone:
`git grep -n "mockPayInvoice\|useMockPay\|MOCK_PAYMENTS_DISABLED\|mock_pay_invoice" -- src` → no matches.

- [ ] **Step 6: Commit**

```bash
git add src/api/publicInvoice.js src/hooks/usePublicInvoice.js src/pages/PublicInvoicePage.jsx src/lib/errors.js
git commit -m "refactor(payments): remove dead mock-pay path ahead of prod (LOO-5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Drop `mock_pay_invoice` + `app_config` (LOO-5, part 2)

**Files:**
- Create: `supabase/migrations/20260625130000_drop_mock_pay_invoice.sql`

**Interfaces:**
- Produces: the `anon`/`authenticated`-callable SECURITY DEFINER function `mock_pay_invoice` and the `app_config` table no longer exist. `stripe-webhook` is the real payment-recording path.

- [ ] **Step 1: Confirm nothing in `src/` still calls it**

Run `git grep -n "mock_pay_invoice\|app_config\|mock_payments_enabled" -- src`. Expected: **empty** (Task 3 removed the last frontend reference). If anything remains, STOP and report — do not drop with a live caller.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260625130000_drop_mock_pay_invoice.sql`:

```sql
-- LOO-5: remove the dev-only mock payment path before production. mock_pay_invoice was an
-- anon-callable SECURITY DEFINER write that marked invoices paid without Stripe; in prod the
-- stripe-webhook records payments. app_config only ever held mock_payments_enabled for it.
drop function if exists public.mock_pay_invoice(text);
drop table if exists public.app_config;
```

- [ ] **Step 3: Apply to hosted dev**

Apply via Supabase MCP `apply_migration` (name `drop_mock_pay_invoice`).

- [ ] **Step 4: Verify the drop + advisors**

```sql
select
  to_regprocedure('public.mock_pay_invoice(text)') is null as fn_gone,
  to_regclass('public.app_config') is null as tbl_gone;
```
Expected: both `true`. Then run Supabase MCP `get_advisors(type: security)` and confirm `mock_pay_invoice` no longer appears in the `anon_security_definer_function_executable` list. Paste both into your report.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260625130000_drop_mock_pay_invoice.sql
git commit -m "feat(security): drop mock_pay_invoice + app_config before prod (LOO-5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Raise minimum password length (LOO-34, config part)

**Files:**
- Modify: `supabase/config.toml`

**Interfaces:**
- Produces: `minimum_password_length = 8` in the `[auth]` block (line ~182). (Applying it to the live Auth instance + enabling leaked-password protection are owner dashboard actions, noted in the report.)

- [ ] **Step 1: Bump the value**

In `supabase/config.toml`, in the `[auth]` section, change `minimum_password_length = 6` to:

```toml
minimum_password_length = 8
```

- [ ] **Step 2: Commit**

```bash
git add supabase/config.toml
git commit -m "chore(auth): raise minimum_password_length to 8 (LOO-34)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify + Linear

**Files:** none (verification only).

- [ ] **Step 1: Full unit test run** — `npx vitest run` → all pass (no test touches the removed mock path; if any test referenced `useMockPay`/`mockPayInvoice`, it would have surfaced in Task 3 — fix or report).
- [ ] **Step 2: Lint** — `npm run lint` → clean.
- [ ] **Step 3: Build** — `npm run build` → succeeds.
- [ ] **Step 4: Advisor recheck** — Supabase MCP `get_advisors(security)`: confirm `mock_pay_invoice` is gone; note the remaining intentional items (`get_public_invoice` anon-callable = by design; `rls_enabled_no_policy` INFO = deny-all posture; `auth_leaked_password_protection` = owner toggle).
- [ ] **Step 5: Update Linear (dual-home)** — LOO-5 → Done; LOO-20 → Done (note the two fixes); LOO-34 → comment that the config min-length is bumped and the live toggle + leaked-password protection remain owner actions. Add a comment recording the SECURITY DEFINER audit result (6/7 already enforced; `next_invoice_number` hardened). Mirror to local docs/memory.

---

## Self-Review

**Spec coverage:**
- LOO-5 remove mock pay (DB drop + dead JS) → Tasks 3, 4 ✅
- LOO-20 send-invoice (recipient validation already done; subject CRLF + PDF cap added) → Task 2 ✅
- SECURITY DEFINER audit, fix the one gap → Task 1 ✅ (other 6 confirmed enforced, untouched)
- LOO-34 config part (min password length) → Task 5 ✅; owner toggles flagged in Task 6 ✅
- Verify (tests/lint/build/advisors) → Task 6 ✅

**Ordering safety:** dead JS removed (Task 3) before the DB drop (Task 4); both DB migrations land after their app references are gone/guarded.

**Placeholder scan:** none — every step has real SQL/TS/JS/commands.

**Type/behavior consistency:** `onPay` keeps `setPaying`/`toast`; `setPaid`/`refetch` stay (used by the `?paid=1` effect). `next_invoice_number` signature unchanged. `send-invoice` request shape unchanged (only validation added). `minimum_password_length` is the existing key.
