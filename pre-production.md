# Pre-Production Checklist

Everything that must be done **before** LoomLance Dashboard goes live. The app currently runs in **mock mode** for email and payments (see [Provider flags](#provider-flags)); this checklist turns the real integrations on and closes the dev-only shortcuts.

Legend: 🔴 **blocker** (must do — security/correctness) · 🟡 **required for the feature** · ⚪ **recommended**

---

## 0. Critical security gates 🔴

These are dangerous if shipped as-is.

- [ ] 🔴 **Disable the mock payment RPC.** `public.mock_pay_invoice(token)` lets *anyone with a valid unpaid invoice link* mark it paid. It is gated by `app_config.mock_payments_enabled` (default `true`). Before launch:
  ```sql
  update public.app_config set mock_payments_enabled = false where id = true;
  ```
  Once the real Stripe webhook is verified live, **drop it entirely**:
  ```sql
  drop function if exists public.mock_pay_invoice(text);
  ```
- [ ] 🔴 **Rotate the leaked Supabase access token.** The personal access token `sbp_a4ed…1f23` was committed/exposed earlier and rotation was deferred. Rotate it in the Supabase dashboard (Account → Access Tokens), update `.env.supabase.local` / CI secrets, and confirm nothing references the old one.
- [ ] 🔴 **Confirm no service-role key or secret is in the client bundle.** Only `VITE_SUPABASE_ANON_KEY` (publishable) belongs in the frontend. Grep the build for `service_role` / secret keys.
- [ ] 🟡 **Run the Supabase security advisors** and resolve findings: dashboard → Advisors, or MCP `get_advisors` (security + performance). Pay attention to any `SECURITY DEFINER` function or RLS gap.

---

## 1. Provider flags

The frontend chooses mock vs real per integration via build-time env vars (default `mock`). Set these in Vercel (and `.env.local` for local real-mode testing) **only after** the corresponding service is set up and the Edge Functions are deployed:

| Var | Mock (now) | Real |
|---|---|---|
| `VITE_EMAIL_PROVIDER` | `mock` | `resend` |
| `VITE_PAYMENTS_PROVIDER` | `mock` | `stripe` |

While a flag is `mock`, that path uses the in-app simulation and needs no external account.

---

## 2. Stripe (online payments) 🟡

The freelancer receives money from their clients via **Stripe Connect**; LoomLance takes no cut (application fee = 0).

- [ ] Create a Stripe account; start in **test mode**.
- [ ] Enable **Connect** (Express accounts) in the Stripe dashboard.
- [ ] Get the **secret key** (`sk_test_…`, later `sk_live_…`).
- [ ] Deploy the Edge Functions (see §4), then add a **webhook endpoint** in Stripe → Developers → Webhooks pointing at the deployed `stripe-webhook` function URL:
  `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/stripe-webhook`
  Subscribe to: **`checkout.session.completed`** (and optionally `account.updated`). Copy the **signing secret** (`whsec_…`).
- [ ] Set the Supabase secrets (see §4): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- [ ] Set `VITE_PAYMENTS_PROVIDER=stripe`.
- [ ] **Verify live (test mode):** connect a test Express account from Profile → Payments; open a sent invoice's public link; **Pay now** → Stripe Checkout → pay with test card `4242 4242 4242 4242` → confirm the webhook marks the invoice `paid` and creates the `invoice_paid` notification. Confirm a **second** delivery of the same event does **not** double-record (idempotency via `stripe_events`).
- [ ] Repeat the connect + pay verification with **live** keys before real customers.

---

## 3. Resend (invoice email) 🟡

- [ ] Create a Resend account; get an **API key** (`re_…`).
- [ ] Verify a **sending domain** (default `send.loomlance.com`) — add the SPF/DKIM DNS records Resend provides. (Until verified, Resend only sends to your own account email; fine for testing.)
- [ ] Confirm/adjust the from-address in the `send-invoice` function (default `invoices@send.loomlance.com`).
- [ ] Set the Supabase secret `RESEND_API_KEY` (see §4).
- [ ] Set `VITE_EMAIL_PROVIDER=resend`.
- [ ] **Verify live:** Send a real invoice → confirm the client receives the email with the PDF attached and the hosted link, and the invoice flips to `sent`.

---

## 4. Supabase Edge Functions 🟡

Four functions live in `supabase/functions/`: `send-invoice`, `stripe-connect`, `stripe-checkout`, `stripe-webhook`.

- [ ] Set secrets (never commit these):
  ```bash
  supabase secrets set RESEND_API_KEY=re_xxx STRIPE_SECRET_KEY=sk_test_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx PUBLIC_SITE_URL=https://app.loomlance.com
  ```
- [ ] Deploy:
  ```bash
  supabase functions deploy send-invoice
  supabase functions deploy stripe-connect
  supabase functions deploy stripe-checkout
  supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe calls this unauthenticated; signature is the auth
  ```
  (`stripe-checkout` is also called unauthenticated from the public invoice page → deploy with `--no-verify-jwt` as well; it validates the token itself.)
- [ ] Apply the `stripe_events` idempotency migration (already in `supabase/migrations/`) to production.

---

## 5. Frontend env / deploy ⚪→🟡

- [ ] Vercel project env (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL` (e.g. `https://app.loomlance.com` — **used for the public invoice share links**, so it must be the real domain), `VITE_SPLASH_URL`, and the two provider flags from §1.
- [ ] Supabase → Authentication → URL Configuration: add the production + preview URLs to **Redirect URLs** (password-reset links) and Site URL.
- [ ] Confirm the Vercel SPA rewrite (`vercel.json`) serves `/i/:token` and other deep links (it routes everything to `/`).

---

## 6. Database & data 🟡

- [ ] Re-apply all `supabase/migrations/` to the production project (if production ≠ the current dev project `zbipqfsqxnvrzhpdjvvy`); confirm `list_migrations` Local == Remote.
- [ ] **Remove dev/test data** from the production project (any `ZZ `/`INV-9xxx` seed rows, the test user, dummy clients).
- [ ] Confirm `pg_cron` jobs (`mark-overdue-invoices`, `notify-due-soon-invoices`) exist on production and run at the intended hour. Revisit per-user timezone vs the current 06:00 UTC if needed.

---

## 7. Recommended before launch ⚪

- [ ] Replace `pgTAP` "skipped" with real RLS/tier SQL tests (deferred during the build for lack of test infra) on a dedicated test project.
- [ ] Account deletion + data export (Profile → Data) — Phase 4 scope, but legally relevant.
- [ ] Confirm error monitoring: `error_logs` / `usage_events` tables exist but aren't wired to a client-side logger yet.
- [ ] Lighthouse / a11y pass; real favicon set (currently the logo PNG); meta/OG tags for the public invoice page.
- [ ] Remove or guard any remaining dev affordances (e.g., the "(simulated)" Stripe toggle copy once real).

---

## Quick "are we safe to launch?" gate

1. `app_config.mock_payments_enabled = false` ✅
2. Leaked access token rotated ✅
3. Stripe + Resend verified live (test then live) ✅
4. Provider flags flipped, secrets set, functions deployed ✅
5. Production migrations applied, dev data purged ✅
