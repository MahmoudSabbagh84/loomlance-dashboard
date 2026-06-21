# Phase 5 — Real Integrations (Email + Payments) — Design Spec

> **STATUS: SPEC (brainstormed 2026-06-21).** Built in 3 sub-projects (5a → 5b → 5c). Much of the Edge-Function code already exists (written for real providers, currently un-deployed / mock-gated). Going **live** requires the user to provision external accounts + deploy + set secrets — flagged per sub-project. No code started yet.

## Decisions (locked)
- **Email = AWS SES** (cheapest, AWS-native). Sender identity: **platform-verified domain** (e.g. `invoices@send.loomlance.com`) with **reply-to = the freelancer's email** and `from "{Business Name}"` display. No per-user domain verification.
- **Payments = Stripe (full, exists) + PayPal (link-MVP first)**, both **optional per user**. AWS has no payments equivalent (Amazon Pay ≠ Connect) — not used.
- **PayPal MVP:** freelancer saves a PayPal.me link / PayPal email; invoice shows a "Pay with PayPal" link; confirmation is **manual** (mark-paid). Upgrade to Orders API + webhook later.
- **Per-user model:** `profiles.online_payments_enabled` (explicit master toggle) + default payment instructions on the profile; cash/bank is the universal baseline that works everywhere.

## Current state (discovered)
- Provider flags: `src/lib/providers.js` — `EMAIL_PROVIDER` (`mock`|`resend`→will add `ses`), `PAYMENTS_PROVIDER` (`mock`|`stripe`).
- Edge Functions **already written** (un-deployed): `supabase/functions/send-invoice` (Resend), `stripe-connect`, `stripe-checkout`, `stripe-webhook`, `_shared/cors.ts`. Invoked via `src/api/edge.js` `invokeEdge(name, body)`.
- Payments = **Stripe Connect** per freelancer (`profiles.stripe_connect_account_id`). Manual path exists: `MarkPaidModal` records a payment with `method` (`bank`/`cash`/…) + flips invoice to `paid`; invoices have `payment_instructions` + `public_token`; public page `PublicInvoiceView` / `/i/:token`.
- ⚠️ `app_config.mock_payments_enabled` (dev-gated public write `mock_pay_invoice`) must be **disabled before prod**.

---

## Sub-project 5a — Email (SES) + per-user payment model + cash-first
**Buildable now in code; live email needs the AWS account.**

- **Schema (migration):** `profiles.online_payments_enabled boolean not null default false`; `profiles.default_payment_instructions text`; `profiles.paypal_link text` (prep for 5c). Prefill new invoices' `payment_instructions` from `profiles.default_payment_instructions`.
- **SES adapter:** rewrite `supabase/functions/send-invoice` to send via **SES** instead of Resend — SigV4-signed request to the SES v2 API using `aws4fetch` (Deno), secrets `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`. Set `from` = `"{business_name}" <SES_FROM_EMAIL>`, `replyTo` = freelancer email, PDF as a raw-MIME attachment (SES v2 `SendEmail` with raw content, or `SendRawEmail`). Add `EMAIL_PROVIDER='ses'` to `providers.js` (`emailIsReal = provider !== 'mock'`).
- **UI:** `PaymentsTab` (profile) — add the **Online payments** master toggle (`online_payments_enabled`) + a **Default payment instructions** textarea. `MarkPaidModal` — ensure `cash` is a selectable `method`. Public invoice page — always show payment instructions; show "Pay online" only when `online_payments_enabled` AND a provider is connected.
- **Live prerequisites (user):** verify the sending domain in SES (DKIM/SPF/DMARC DNS), request **SES production access** (sandbox only sends to verified addresses), create an IAM user with `ses:SendEmail`, set the 4 secrets, `supabase functions deploy send-invoice`, set `VITE_EMAIL_PROVIDER=ses`.

## Sub-project 5b — Stripe (finish + go live)
**Code largely exists; mainly verification + deployment.**

- Review/finish `stripe-connect` (Express onboarding link), `stripe-checkout` (creates a Checkout Session for `/i/:token`), `stripe-webhook` (on `checkout.session.completed`/`payment_intent.succeeded` → record payment + mark invoice paid). Confirm webhook signature verification + idempotency.
- Gate Stripe UI on `online_payments_enabled` + `stripe_connect_account_id`.
- **Live prerequisites (user):** Stripe account + Connect enabled; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_*` secrets; register the webhook endpoint; deploy the 3 functions; set `VITE_PAYMENTS_PROVIDER=stripe`; **disable `app_config.mock_payments_enabled`**.

## Sub-project 5c — PayPal (link MVP)
**Fully buildable now; no PayPal app needed for the MVP.**

- `profiles.paypal_link` already added in 5a. `PaymentsTab` — field to save a PayPal.me URL or PayPal email; toggle on/off independent of Stripe.
- Public invoice page — render "Pay with PayPal" linking to the saved PayPal.me/checkout URL (optionally with amount, e.g. `paypal.me/{handle}/{amount}`). No webhook → the freelancer confirms via **Mark as paid** (`method: 'paypal'`).
- **Later upgrade (separate):** PayPal Orders API + Smart Buttons + `paypal-webhook` for auto-reconcile (needs PayPal Commerce Platform / app credentials + per-seller onboarding).

---

## Provider abstraction
Generalize `src/lib/providers.js` so a user can have **0..n** connected methods; the public invoice page renders whichever are enabled, and cash/bank instructions always show. Per-user truth lives in `profiles` (`online_payments_enabled`, `stripe_connect_account_id`, `paypal_link`); the build-time flags only decide whether each integration is wired at all.

## Verification
- Code-level: lint/tests/build per task. SES: test the Edge Function against SES **sandbox** (verified test address). Stripe: **test mode** + Stripe CLI webhook forwarding. PayPal MVP: just a link — verify the URL + manual mark-paid (method `paypal`).
- Live DB checks via MCP with `ZZ-` isolation as usual.
- Pre-prod checklist: SES out of sandbox; Stripe live keys + webhook; `mock_payments_enabled=false`; provider env flags flipped.

## What I can build vs what needs you
- **I build now (mock/sandbox-verifiable):** the migration, SES adapter in `send-invoice`, per-user toggle + default instructions UI, cash/paypal `method`s, PayPal link UI + public button, provider-abstraction generalization, public-page conditional pay options.
- **You provision (to go live):** AWS SES (domain + prod access + IAM keys), Stripe account/keys/webhook, (later) PayPal app; deploy functions; set secrets; flip flags; disable mock payments.
