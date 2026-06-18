# LoomLance Phase 3 — "Send & Pay" Design

**Status:** Approved 2026-06-18
**Supersedes:** the Phase 3 sketch in `2026-06-04-loomlance-rebuild-design.md` §9.3 (this doc refines it for a **mock-externals** build).

## 1. Goal

Let a freelancer share an invoice with their client via a public link, have the client view it (with the freelancer notified), and capture payment — **without yet wiring up the external services** (Resend email, Stripe). Email delivery and Stripe onboarding are **mocked behind clean seams**; the payment is auto-confirmed via a dev-gated RPC that mirrors the real Stripe webhook. Everything that does not depend on an external account (hosted page, link controls, viewed-tracking, notifications, all UI) is **fully real and verifiable**.

## 2. Scope

### Real & fully working in this phase
- Public hosted invoice page `/i/:public_token` (view + download).
- Link controls: copy, regenerate (rotate token), optional expiry.
- Viewed-tracking (idempotent) + `invoice_viewed` notification.
- `invoice_paid` notification.
- All UI: Send modal, Profile → Payments tab, hosted page, share/link controls on the invoice detail.

### Mocked (clean seams; real wiring is a later task)
- **Email delivery** — "Send" flips the invoice to `sent` and surfaces the link; no real email goes out.
- **Stripe Connect onboarding** — a simulated "connected" toggle that sets/clears `profiles.stripe_connect_account_id`.
- **Payment** — public Pay Now → a **dev-gated** `mock_pay_invoice` RPC that does exactly what the real webhook will (record payment, mark paid, notify).

### Explicitly out of scope (deferred to the "Phase 3 real integrations" task)
- Resend email send + Edge Function `send_invoice` + uploading the PDF to Storage for attachment.
- Stripe Connect Express onboarding (account links) + callback.
- Stripe Checkout Session creation + signature-verified webhook + idempotency (this **replaces** `mock_pay_invoice`).
- `payment_failed` notifications (payments always "succeed" in mock mode).

## 3. Architecture

No Edge Functions are introduced in this phase. With externals mocked, the entire system is **Postgres RPCs + client code**, reusing existing patterns (`src/api/*` → `src/hooks/*` → UI; `mapPostgresError` → `AppError`). Three **seams** are defined now so the real integrations slot in later without reworking the UI or data model:

| Seam | Mock implementation (this phase) | Real implementation (later) |
|---|---|---|
| `sendInvoice(invoiceId, opts)` | Authenticated mutation: ensure `public_token`, set `status='sent'`, `sent_at=now()`. Returns the share link. | Calls `send_invoice` Edge Function → generates+uploads PDF, sends via Resend with link + attachment. |
| Stripe connection | Toggle sets/clears `profiles.stripe_connect_account_id` to a sentinel (`'mock_connect'`). | Connect Express onboarding writes the real account id. |
| Payment capture | Public Pay Now → dev-gated `mock_pay_invoice(token)` RPC (insert `invoice_payments` + status `paid` + notify). | Stripe `checkout.session.completed` webhook (signature-verified, idempotent) does the same DB writes. |

**Why this is safe to swap later:** the *database effect* of "payment captured" is identical between the mock RPC and the real webhook (an `invoice_payments` row + `status='paid'` + an `invoice_paid` notification). The UI reads state from the DB and is agnostic to which path wrote it.

## 4. Components

### 4.1 Hosted invoice page `/i/:public_token` (public, no auth) — security-critical

A new **public route** (joins `/login`, `/forgot-password`, `/reset-password` in the unauthenticated route group; renders outside `AuthGate`/`AppShell`, so no session is required).

**Data access — the single curated read path.** The page calls one RPC:

```
get_public_invoice(p_token text) returns jsonb   -- SECURITY DEFINER, search_path = public
```

- Looks up the invoice by `public_token = p_token` (indexed, parameterized — no string concatenation).
- Rejects if not found, or `link_expires_at is not null and link_expires_at < now()` → returns `null` (page shows "link no longer valid").
- On success, returns a **hand-built JSON containing only invoice-display fields**:
  - invoice: `invoice_number, issue_date, due_date, currency, status, notes, terms, payment_instructions`
  - line items: `description, quantity, unit_price, tax_rate, discount_rate, position`
  - issuer (from `profiles`): `business_name, address, tax_id, logo_url, invoice_accent_color, invoice_footer` (branding honored per the issuer's tier)
  - bill-to (from `clients`): `name, company, address`
  - `can_pay` boolean: issuer has a (mock) `stripe_connect_account_id` **and** status ∉ (`paid`,`void`)
  - **Never** returns: `user_id`, client/issuer email or phone, `stripe_*` ids, `public_token`, other invoices, or any other table's data.
- **Side effect (idempotent):** if `viewed_at is null`, set `viewed_at = now()` and insert one `invoice_viewed` notification for the issuer. Repeat opens are no-ops (no extra notifications, `viewed_at` not overwritten).

**Page rendering.** Renders the invoice client-side (reusing the Phase 2 `InvoicePreview`/PDF layout from the returned JSON — no server render, no storage exposure), a **Download PDF** button (client-side generation), and a **Pay Now** button shown only when `can_pay` is true.

**Security model (recap of the threat analysis):**
- `public_token` = 16 random bytes (128-bit) → unguessable, non-enumerable. Unique-indexed.
- `get_public_invoice` is the **only** public read path; RLS continues to deny all direct anonymous reads of `invoices`/`profiles`/`clients`/etc.
- Returns a whitelist of display fields only — a valid token yields exactly one invoice's printable data and nothing else.
- Parameterized token → no SQL injection. React escapes all rendered text → no XSS (no `dangerouslySetInnerHTML`).
- No public Storage bucket (PDF rendered client-side from returned data).
- Writes from the public context are limited to: idempotent `viewed_at` + one notification, and the **dev-gated** `mock_pay_invoice` (see §4.4). Blast radius of a leaked token = **one invoice**.
- The Supabase anon/publishable key used by the page is already public in the SPA bundle; security rests on RLS + the curated RPC, not key secrecy.

### 4.2 Link controls (real)

- **Schema:** add `invoices.link_expires_at timestamptz` (nullable).
- **Invoice detail UI:** a "Share link" section showing the `${VITE_PUBLIC_SITE_URL}/i/${public_token}` URL with a **Copy** button; a **Regenerate link** action; an optional **expiry date** picker (writes `link_expires_at`).
- **Regenerate:** RPC `regenerate_invoice_link(p_invoice_id uuid) returns text` — `SECURITY DEFINER`, but **scoped to the caller's own invoice** (`where id = p_invoice_id and user_id = auth.uid()`); sets `public_token = encode(extensions.gen_random_bytes(16),'hex')` and returns the new token. Rotating instantly invalidates any previously shared link. UI guards with a confirm dialog ("this breaks any link you've already shared").
- Expired/rotated token → `get_public_invoice` returns null → page shows a clean "This invoice link is no longer valid" state.

### 4.3 Send flow (mock)

- **"Send invoice"** button on the invoice detail, enabled for `draft` only.
- Opens a **Send modal**: recipient (defaults to client email), subject + body (simple templates with invoice number/business name), and the **shareable link** shown prominently with Copy. A note clarifies email delivery is simulated for now.
- **On confirm (`sendInvoice`):** ensure `public_token` exists, set `status='sent'`, `sent_at=now()` (authenticated mutation on the user's own invoice). No real email. Success state surfaces the copy-able link so the freelancer can share it manually meanwhile.
- This is the `sendInvoice` seam; the real Resend path replaces only the "deliver email + attach PDF" step.

### 4.4 Stripe Connect + Pay (mock)

- **Profile → Payments tab** (new tab in the existing tabbed Profile page): shows connection status. **"Connect Stripe (simulated)"** sets `profiles.stripe_connect_account_id = 'mock_connect'`; **"Disconnect"** clears it. Copy explains this is a simulation until real Stripe is wired.
- **Pay Now (hosted page):** shown when `can_pay`. Simulates a Stripe Checkout success screen, then calls:

```
mock_pay_invoice(p_token text) returns jsonb   -- SECURITY DEFINER, DEV-GATED
```

- **Gate:** reads a flag (`app_config.mock_payments_enabled`, a single-row config table, default `true`). If the flag is off, the RPC raises and does nothing. **The flag must be set `false` in production** until this RPC is deleted in favor of the real webhook.
- **Effect (mirrors the real webhook):** look up invoice by token; if not already paid, insert an `invoice_payments` row (`method='stripe'`, amount = invoice total computed from line items, `paid_at=now()`); set `status='paid'`, `paid_at`; insert one `invoice_paid` notification for the issuer. Idempotent: a second call on an already-paid invoice is a no-op.
- **⚠️ Caveat (documented in code + this spec):** because this RPC is callable from the unauthenticated public page, anyone with a valid, unpaid invoice link could mark it paid while the gate is on. This is acceptable **only** for a no-accounts demo. The real flow has no public payment-write at all — the `paid` write comes from Stripe's signed, server-to-server `checkout.session.completed` webhook (metadata carries `invoice_id`). The real webhook **replaces** `mock_pay_invoice`, and the gate ships `false`.

### 4.5 Notifications (real)

- Two `user_notifications.kind` values: `invoice_viewed` and `invoice_paid`.
- Payload `{ title, body }` + `link_to = '/invoices/<id>'`, rendered by the existing `NotificationBell` (`payload.title`/`payload.body`/`link_to`/`created_at`).
  - `invoice_viewed`: title `"Invoice <number> was viewed"`, body `"<client name> opened it"`.
  - `invoice_paid`: title `"Invoice <number> was paid"`, body `"<formatted amount> received"`.
- `invoice_viewed` is created at most once per invoice (guarded by the `viewed_at is null` check). `invoice_paid` once per invoice (guarded by the not-already-paid check).

## 5. Schema changes (one migration)

1. `alter table invoices add column link_expires_at timestamptz;`
2. `create table app_config (id boolean primary key default true check (id), mock_payments_enabled boolean not null default true);` seeded with one row. (Single-row config; RLS denies end-user writes; read by the gated RPC via `SECURITY DEFINER`.)
3. RPCs (all `SECURITY DEFINER`, `set search_path = public`):
   - `get_public_invoice(p_token text) returns jsonb` — public read + idempotent viewed stamp + viewed notification. `EXECUTE` granted to `anon, authenticated`.
   - `regenerate_invoice_link(p_invoice_id uuid) returns text` — own-invoice token rotation. `EXECUTE` to `authenticated` only.
   - `mock_pay_invoice(p_token text) returns jsonb` — dev-gated payment simulation. `EXECUTE` to `anon, authenticated` (needed by the public page) **but** behind the `mock_payments_enabled` gate.
4. Reused as-is: `invoices.public_token` (128-bit, unique-indexed), `invoices.sent_at`/`viewed_at`/`paid_at`, `invoice_payments.*`, `profiles.stripe_connect_account_id`.

## 6. Frontend structure

- `src/pages/PublicInvoicePage.jsx` — the `/i/:token` route (unauthenticated group).
- `src/api/publicInvoice.js` + `src/hooks/usePublicInvoice.js` — wrap `get_public_invoice` / `mock_pay_invoice`.
- `src/api/invoices.js` (+ hooks) — add `sendInvoice`, `regenerateInvoiceLink`, `setLinkExpiry`.
- `src/features/invoices/SendInvoiceModal.jsx`, `src/features/invoices/ShareLinkPanel.jsx` — Send modal + share/link controls on the invoice detail.
- `src/features/profile/PaymentsTab.jsx` + wire into `ProfilePage` tabs.
- Reuse the Phase 2 invoice render/PDF for the public page.

## 7. Error handling

- New `AppError` codes via `mapPostgresError`: `INVOICE_LINK_INVALID` (expired/rotated/not-found), `MOCK_PAYMENTS_DISABLED` (gate off), `STRIPE_NOT_CONNECTED` (Pay attempted without connection). Mapped to friendly messages.
- Public page handles a `null` from `get_public_invoice` as the "link no longer valid" state (not an error toast).

## 8. Testing & verification

- **Live Playwright (full real loop, no accounts needed):**
  1. Log in → create/seed an invoice → **Send** (mock) → assert `status=sent` + link shown.
  2. Open `/i/:token` in a **fresh, unauthenticated browser context** → invoice renders → back in the authed session, the **`invoice_viewed`** notification appears.
  3. With Stripe "connected," **Pay Now** on the public page → invoice flips to **paid** + **`invoice_paid`** notification.
  4. **Regenerate link** → the old token now shows "link no longer valid."
  5. **Expiry** in the past → public page shows "link no longer valid."
  6. **No-leak assertion:** the `get_public_invoice` JSON contains only the whitelisted display fields (no `user_id`, emails, `stripe_*`, other invoices).
- **Unit:** link expiry/validity logic, notification payload builders, invoice-total computation reused by `mock_pay_invoice`.
- Seed/clean test data with own markers (`INV-9xxx` / `ZZ ` prefixes); the user uses the app live, so no bulk deletes.

## 9. Decisions made during brainstorming

- **Full scope** kept (all four pieces), externals **mocked**.
- **Public page = our hosted page + link controls** (regenerate + optional expiry), standard hardening (curated RPC, 128-bit token, RLS intact, client-side PDF, no public storage).
- **PDF:** hosted page renders client-side; email-attachment PDF upload deferred to the real-email task.
- **Mock payment confirmation:** public Pay Now → **dev-gated `mock_pay_invoice` RPC** (more realistic demo), explicitly flagged for removal when the real signed webhook lands.
