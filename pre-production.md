# Pre-Production Checklist

Everything that must be done **before** LoomLance Dashboard goes live. The app currently runs in **mock mode** for email and payments (see [Provider flags](#1-provider-flags)); this checklist turns the real integrations on and closes the dev-only shortcuts.

**Stack (actual):** Vite SPA hosted on **AWS Amplify** · Supabase (project `zbipqfsqxnvrzhpdjvvy`) · **AWS SES** for transactional email · **Stripe** (Connect for client→freelancer invoice payments, Subscriptions for Tier 1/Tier 2). Signup + subscription Checkout originate in the separate **Splash** project; this Dashboard owns login + the in-app subscription management.

Legend: 🔴 **blocker** (must do — security/correctness) · 🟡 **required for the feature** · ⚪ **recommended** · ✅ **done in code (2026-06-25 hardening batch)**

---

## 0. Critical security gates 🔴

- [x] ✅ **Mock payment RPC removed.** `public.mock_pay_invoice(token)` (an `anon`-callable write that let anyone with an invoice link mark it paid) and its `app_config` flag table were **dropped** in migration `20260625130000_drop_mock_pay_invoice.sql`, and the dead frontend path was removed. Nothing to toggle — just confirm the migration is applied to the production project (§6). In prod, `stripe-webhook` records payments.
- [ ] 🔴 **Rotate the leaked Supabase access token (LOO-11).** The personal access token `sbp_a4ed…1f23` was exposed earlier. Rotate it in the Supabase dashboard (Account → Access Tokens), update `.env.supabase.local` / CI secrets, and confirm nothing references the old one.
- [ ] 🔴 **Confirm no service-role key or secret is in the client bundle.** Only `VITE_SUPABASE_ANON_KEY` (publishable) belongs in the frontend. Grep the build output for `service_role` / secret keys.
- [x] ✅ **SECURITY DEFINER ownership audit (go-live).** All 7 advisor-flagged `authenticated`-callable `SECURITY DEFINER` RPCs were audited; 6 already enforce ownership. `next_invoice_number(p_user_id)` was hardened with an `auth.uid()` ownership guard (migration `20260625120000_harden_next_invoice_number.sql`).
- [ ] 🟡 **Run the Supabase security advisors** (dashboard → Advisors, or MCP `get_advisors` security + performance) on the production project and resolve findings. **Accepted/by-design (do not "fix"):** `get_public_invoice` is intentionally `anon`-callable (public invoice page; access is by unguessable token); the `rls_enabled_no_policy` INFO items (`contact_rate_limit`, `invoice_number_sequences`, `stripe_events`) are the correct deny-all-to-clients posture; the 6 ownership-enforced `SECURITY DEFINER` app RPCs (revoking EXECUTE would break the app). **Still open:** enable Leaked Password Protection (§5).

---

## 1. Provider flags

The frontend chooses mock vs real per integration via build-time env vars (default `mock`). Set these in **Amplify** (Environment variables) — and `.env.local` for local real-mode testing — **only after** the corresponding service is set up and the Edge Functions are deployed:

| Var | Mock (now) | Real |
|---|---|---|
| `VITE_EMAIL_PROVIDER` | `mock` | `ses` |
| `VITE_PAYMENTS_PROVIDER` | `mock` | `stripe` |

While a flag is `mock`, that path uses the in-app simulation and needs no external account. (`paymentsAreReal` / `emailIsReal` live in `src/lib/providers.js`.)

---

## 2. Stripe — invoice payments (Connect) 🟡

The freelancer receives money from their clients via **Stripe Connect**; LoomLance takes no cut (application fee = 0). Powered by `stripe-connect`, `stripe-checkout`, `stripe-webhook`.

- [ ] Create a Stripe account; start in **test mode**.
- [ ] Enable **Connect** (Express accounts) in the Stripe dashboard.
- [ ] Get the **secret key** (`sk_test_…`, later `sk_live_…`) → `STRIPE_SECRET_KEY`.
- [ ] Deploy the Edge Functions (§4), then add the **payments webhook** in Stripe → Developers → Webhooks pointing at:
  `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/stripe-webhook`
  Subscribe to: **`checkout.session.completed`**, **`payment_intent.payment_failed`**, **`charge.refunded`**, **`charge.dispute.created`** (failure/refund/dispute handling shipped in LOO-13). Copy the **signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.
- [ ] **Verify live (test mode):** connect a test Express account from Profile → Payments; open a sent invoice's public link; **Pay by card** → Stripe Checkout → test card `4242 4242 4242 4242` → confirm the webhook marks the invoice `paid` and creates the `invoice_paid` notification. Re-deliver the same event and confirm **no** double-record (idempotency via `stripe_events`).
- [ ] Repeat the connect + pay verification with **live** keys before real customers.

---

## 3. Stripe — subscriptions (Tier 1 / Tier 2) 🟡

How users actually pay LoomLance. Powered by `create-subscription-checkout`, `create-billing-portal`, `stripe-subscription-webhook`. **Following only §2 leaves subscriptions silently not updating tier — this section is required.**

- [ ] In Stripe, create the **Products + recurring Prices** for both tiers, monthly and annual (4 prices total).
- [ ] On **each Product**, set **`metadata.tier`** = `tier_1` (Freelancer) / `tier_2` (Studio). The subscription webhook derives the tier from `product.metadata.tier` and does **not** default a missing value (LOO-22) — if metadata is absent, tier won't update.
- [ ] Set the four price-id secrets: `STRIPE_PRICE_FREELANCER_MONTHLY`, `STRIPE_PRICE_FREELANCER_ANNUAL`, `STRIPE_PRICE_STUDIO_MONTHLY`, `STRIPE_PRICE_STUDIO_ANNUAL`.
- [ ] Add the **subscription webhook** in Stripe → Developers → Webhooks pointing at:
  `https://zbipqfsqxnvrzhpdjvvy.functions.supabase.co/stripe-subscription-webhook`
  Subscribe to: **`customer.subscription.created`**, **`customer.subscription.updated`**, **`customer.subscription.deleted`**. Copy the **signing secret** → `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` (this is a **separate** secret from the payments webhook).
- [ ] Configure the **Stripe Billing Portal** (Settings → Billing → Customer portal) and brand it (LOO-90) — `create-billing-portal` returns its URL from Profile → Subscription.
- [ ] **Verify live (test mode):** from Profile → Subscription, **Start 14-day trial** → Checkout (test card) → confirm `customer.subscription.created` flips `profiles.subscription_tier`/`subscription_status` for the user, and the dashboard reflects the new tier after the `?upgraded=1` return. Then open **Manage billing** → confirm the portal loads. (The Splash signup handoff writes `user_metadata.selected_plan`; `TrialBootstrap` auto-starts checkout on first dashboard load — verify that path too.)

---

## 4. AWS SES — invoice email 🟡

`send-invoice` sends the invoice email (text + HTML + optional PDF attachment) via **AWS SES v2**. `contact-form` (splash) uses the same SES path.

- [ ] Verify a **sending domain** (default `send.loomlance.com`) in SES — add the **DKIM** CNAMEs + **SPF** (and a **DMARC** record); see LOO-81 for the full DNS/auth hardening.
- [ ] **Request SES production access** (Account dashboard → "Request production access"). New SES accounts are in the **sandbox** and can only send to verified addresses — **start this early, it has AWS review lead time.**
- [ ] Create an **IAM-scoped** SES sender (not the root key — LOO-10): an IAM user/role limited to `ses:SendEmail`/`SendRawEmail`. Get its access key id + secret.
- [ ] Set the Supabase secrets (§5 list): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (default `us-east-1`), `SES_FROM_EMAIL` (default `invoices@send.loomlance.com`; domain must be SES-verified). For `contact-form` optionally `CONTACT_FROM_EMAIL` / `CONTACT_TO_EMAIL`.
- [ ] Set `VITE_EMAIL_PROVIDER=ses`.
- [ ] **Verify live:** send a real invoice → client receives the email with the PDF attached + the hosted link, and the invoice flips to `sent`. (`send-invoice` validates recipients, strips CR/LF from subject/recipients, and caps the PDF at ~10 MB — LOO-20.)

---

## 5. Supabase Edge Functions & secrets 🟡

**Eight** functions live in `supabase/functions/`: `send-invoice`, `contact-form`, `stripe-connect`, `stripe-checkout`, `stripe-webhook`, `stripe-subscription-webhook`, `create-subscription-checkout`, `create-billing-portal`.

JWT verification is **declarative** in `config.toml` (LOO-94) — do **not** pass `--no-verify-jwt`; the deploy honors `config.toml`. The four public (`verify_jwt = false`) functions are `stripe-webhook`, `stripe-subscription-webhook`, `stripe-checkout`, `contact-form` (each authenticates via Stripe signature / public token / rate-limit). The rest require a user JWT.

- [ ] Set secrets (never commit these):
  ```bash
  supabase secrets set \
    STRIPE_SECRET_KEY=sk_test_xxx \
    STRIPE_WEBHOOK_SECRET=whsec_xxx \
    STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxx \
    STRIPE_PRICE_FREELANCER_MONTHLY=price_xxx \
    STRIPE_PRICE_FREELANCER_ANNUAL=price_xxx \
    STRIPE_PRICE_STUDIO_MONTHLY=price_xxx \
    STRIPE_PRICE_STUDIO_ANNUAL=price_xxx \
    AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx AWS_REGION=us-east-1 \
    SES_FROM_EMAIL=invoices@send.loomlance.com \
    PUBLIC_SITE_URL=https://app.loomlance.com
  ```
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the Edge runtime — do not set them.)
- [ ] Deploy all eight (config.toml controls `verify_jwt`):
  ```bash
  supabase functions deploy send-invoice
  supabase functions deploy contact-form
  supabase functions deploy stripe-connect
  supabase functions deploy stripe-checkout
  supabase functions deploy stripe-webhook
  supabase functions deploy stripe-subscription-webhook
  supabase functions deploy create-subscription-checkout
  supabase functions deploy create-billing-portal
  ```
- [ ] Every Stripe/SES function reads its secret at module load (`new Stripe(...)` / AWS creds) — a missing secret fails the invocation loudly, so deploy secrets **before** flipping the provider flags.

---

## 6. Frontend env / Amplify deploy 🟡

- [ ] **Amplify** environment variables (all branches that deploy): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL` (e.g. `https://app.loomlance.com` — **used for public invoice share links**, must be the real domain), `VITE_SPLASH_URL`, and the two provider flags from §1.
- [ ] **Amplify SPA rewrite (LOO-12):** add the rewrite rule so client-side routes (`/i/:token`, `/login`, deep links) serve `index.html` instead of 404 — Amplify → Rewrites and redirects: source `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff2?|map|json)$)([^.]+$)/>`, target `/index.html`, type `200 (Rewrite)`.
- [ ] **Supabase → Authentication → URL Configuration (LOO-9):** set the **Site URL** to the prod domain and add the production + preview URLs to **Redirect URLs** (password-reset / magic-link returns).
- [ ] **Enable Leaked Password Protection** (Auth → Policies; LOO-34) and confirm `minimum_password_length = 8` is applied on the live instance (raised in `config.toml`).
- [ ] Add **security headers + CSP** at the Amplify layer (LOO-16).

---

## 7. Database & data 🟡

- [ ] Re-apply all `supabase/migrations/` to the production project (if production ≠ the current dev project `zbipqfsqxnvrzhpdjvvy`); confirm `list_migrations` Local == Remote — this includes the go-live hardening migrations (`20260625120000_harden_next_invoice_number`, `20260625130000_drop_mock_pay_invoice`).
- [ ] **Remove dev/test data** from the production project (any `ZZ `/`INV-9xxx` seed rows, the test user, dummy clients).
- [ ] Confirm `pg_cron` jobs (`mark-overdue-invoices`, `notify-due-soon-invoices`, recurring-invoice generation) exist on production and run at the intended hour. Revisit per-user timezone vs the current 06:00 UTC if needed.

---

## 8. Recommended before launch ⚪

- [ ] Replace `pgTAP` "skipped" with real RLS/tier SQL tests (deferred for lack of test infra) on a dedicated test project.
- [ ] Account deletion + data export (Profile → Data) — legally relevant.
- [ ] Confirm error monitoring: `error_logs` / `usage_events` tables exist but aren't wired to a client-side logger yet.
- [ ] Lighthouse / a11y pass; real favicon set (currently the logo PNG); meta/OG tags for the public invoice page (LOO-57).
- [ ] Publish/link real Terms of Service & Privacy Policy (LOO-27; pages shipped on Splash in LOO-76).

---

## Quick "are we safe to launch?" gate

1. `mock_pay_invoice` dropped (migration applied to prod) ✅ in code — confirm on prod project
2. Leaked access token rotated (LOO-11)
3. Stripe **payments + subscription** webhooks both registered (2 endpoints, 2 secrets); `STRIPE_PRICE_*` set; product `metadata.tier` set
4. SES domain verified + **production access granted**; IAM sender key set
5. Provider flags flipped (`stripe` / `ses`), all 8 functions deployed, secrets set
6. Amplify SPA rewrite verified; Supabase Auth URLs set; leaked-password protection enabled
7. Production migrations applied, dev data purged
8. Verified live (test → live): one invoice payment, one subscription trial, one real invoice email
