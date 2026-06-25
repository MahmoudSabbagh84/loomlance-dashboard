# LoomLance — Fraud & Security Audit (focused manual pass)

**Date:** 2026-06-25 · **Mode:** Option 2 (focused manual, single-context) · **Scope:** RLS tenant
isolation, payment fraud, server-side tier enforcement, trial abuse, public edge functions,
header/HTML injection, secrets/JWT posture. Source of truth: committed `supabase/migrations/` +
`supabase/functions/` (authoritative) at dashboard `c99e7d9`.

**Bottom line:** the data layer and money path are genuinely well-hardened. Tenant isolation is
airtight, the Stripe webhooks are signature-verified + idempotent, amounts are recomputed
server-side, and the known self-upgrade / tier-bypass holes are already closed by triggers.
**No new P0/P1 code vulnerabilities found.** Live verification (Supabase MCP, 2026-06-25) confirms
`mock_payments_enabled = false` in prod (the headline risk is already closed — just drop the function
pre-prod), `tables_without_rls = 0`, and that every advisor-flagged `SECURITY DEFINER` RPC properly
gates on `auth.uid()`. The two P2s found (contact-form throttle, declarative `verify_jwt`) are fixed.
The remaining items are owner-actions: enable leaked-password protection, drop `mock_pay_invoice`, and
the standard go-live keys/config list.

---

## P0 — blocks go-live

### 1. `mock_pay_invoice` — ✅ already DISABLED live (verified 2026-06-25)
`security definer`, granted to `anon`. If enabled, anyone holding a public invoice token could mark
an invoice **paid with no money moving** (it mirrors the real webhook's DB effect).
- **Live check (Supabase MCP):** `select mock_payments_enabled from app_config` → **`false`**. The RPC
  now raises `MOCK_PAYMENTS_DISABLED`, so the live risk is **closed**. (LOO-5.)
- **Residual hygiene:** the function still exists and the security advisor still flags it as
  `anon`-executable (lints 0028/0029). **Drop `mock_pay_invoice` entirely before prod** so it can't be
  re-enabled by toggling one boolean. Keep LOO-5 open until the function is dropped.

---

## P1 — none found
The payment path, RLS, tier enforcement, and billing-column protection all hold up under review.

---

## P2 — fix before/around launch

### 2. `contact-form` has no rate limiting — ✅ FIXED (2026-06-25)
Public endpoint that sends an SES email per call to `info@loomlance.com`. Guards present: honeypot
(`company` field), length/format validation, CR/LF header-injection stripping, HTML escaping.
**Was missing:** any throttle → scriptable to flood the inbox and burn SES quota.
- **Fix:** added per-IP sliding-window limit (**5 / 10 min**). New migration
  `20260625000000_contact_rate_limit.sql` adds a `contact_rate_limit` table (RLS on, no policies =
  service-role-only) + a `security definer` RPC `check_contact_rate_limit(p_ip)` that prunes, counts,
  records, and returns allow/deny atomically (granted to `service_role` only). `contact-form` derives
  the client IP from `x-forwarded-for`/`x-real-ip`, calls the RPC after validation + before the SES
  send, returns **429** when over the cap, and **fails open** on RPC error.
- **Note:** `x-forwarded-for` leftmost hop is client-spoofable — this raises the bar, not a hard wall.
  A Turnstile/hCaptcha on the splash form (config already has a commented `[auth.captcha]` block)
  would be the stronger follow-up if abuse persists.

### 3. `config.toml` has no declarative `verify_jwt` per function — ✅ FIXED (2026-06-25)
The public/authenticated split was set **imperatively at deploy time** via `--no-verify-jwt` flags in
each function's header comment — nothing pinned it in `config.toml` (drift risk).
- **Correction to first-pass note:** `send-invoice` is **authenticated**, not public (its deploy line
  has no `--no-verify-jwt`; it relies on the caller's JWT for RLS scoping). The genuinely-public set
  is **4**: `stripe-webhook`, `stripe-subscription-webhook`, `stripe-checkout`, `contact-form`.
- **Fix:** pinned `verify_jwt` for all 8 functions in `config.toml` — `false` for the 4 public,
  `true` for the 4 authenticated (`send-invoice`, `create-subscription-checkout`,
  `create-billing-portal`, `stripe-connect`).
- **Mitigation already in place (defense-in-depth):** every authenticated function additionally
  re-checks `auth.getUser()` / RLS, so it 401/404s even if gateway verification were off.

---

## P3 — informational / accept-or-tighten

4. **`get_public_invoice` exposes issuer `subscription_tier`** in the public payload (`issuer.tier`).
   Minor info leak; harmless (used to badge "Powered by LoomLance" on free tier). Accept.
5. **`invoice_payments` allows self-INSERT** (`with check (user_id = auth.uid())`). A user can
   fabricate payment rows for *their own* invoices — self-deception only, no cross-tenant impact, no
   platform fraud. Could tighten to service_role-only inserts if you want the ledger to be
   webhook-authoritative, but not required.
6. **RLS perf rewrite (LOO-29, `20260624040000_rls_perf.sql`)** — ✅ **verified clean (2026-06-25)**.
   Live check: `tables_without_rls = 0`; every tenant table still carries its full set of policies
   (4 each for the CRUD tables, 2–3 for profiles/payments/notifications). The rewrite dropped nothing.
7. **Trial re-entry:** `shouldStartTrial` can't auto-loop (the `stripe_customer_id` marker flips
   redirect→banner), but a user could *manually* re-trigger checkout for another 14-day trial; only
   Stripe-side trial eligibility guards it. Low value to abuse (self-serve platform sub). Accept.
8. **Leaked-password protection is DISABLED** (advisor `auth_leaked_password_protection`, NEW this
   pass). Supabase can reject passwords found in HaveIBeenPwned breaches; it's off. Easy go-live
   hardening. **Action (owner):** Auth → Policies → enable "Leaked password protection". Also consider
   raising `minimum_password_length` (currently 6) to 8 in `config.toml`.

---

## Live advisor run (Supabase MCP, 2026-06-25)

- **`rls_enabled_no_policy` (INFO) on `app_config`, `invoice_number_sequences`, `stripe_events`** —
  **intentional** deny-all tables (only `security definer` fns / `service_role` touch them). Not bugs.
- **`anon_security_definer_function_executable` (WARN) on `get_public_invoice`, `mock_pay_invoice`** —
  `get_public_invoice` is the public invoice view (anon by design ✓). `mock_pay_invoice` → see P0 #1
  (disabled live; drop pre-prod).
- **`authenticated_security_definer_function_executable` (WARN)** on the app RPCs
  (`generate_invoice_from_expenses_for_client/project`, `generate_invoice_from_time_for_project`,
  `generate_recurring_invoice_now`, `set_project_budget`, `next_invoice_number`,
  `regenerate_invoice_link`) — **verified benign:** each pulled its live source and **every one gates on
  `auth.uid()`** and an ownership check (`UNAUTHORIZED`/`NOT_FOUND`) before touching data. No
  cross-tenant path. These WARNs are expected for an app's own authenticated RPC surface.
- **`auth_leaked_password_protection` (WARN)** — the one actionable item → P3 #8 above.

---

## Verified solid (no action)

- **Tenant isolation:** all 20 tables `enable row level security`; every tenant table is uniformly
  `user_id = auth.uid()` for select/insert/update/delete. Storage buckets scoped by
  `(storage.foldername(name))[1] = auth.uid()`.
- **`stripe_events` ledger:** RLS on, **no user policy = deny-all**; only service_role writes →
  idempotency ledger is tamper-proof.
- **`app_config`:** RLS on, no policy → unreadable by users; only `security definer` fns see it.
- **Self-upgrade blocked:** `protect_billing_columns` trigger forces `subscription_tier/status`,
  `stripe_*`, `current_period_end` back to old values for `authenticated`/`anon` updates (RLS can't
  do column-level). Profiles have no INSERT/DELETE policy.
- **Server-side tier enforcement:** `enforce_tier_feature` triggers block free/lower-tier inserts on
  `time_entries`/`recurring_templates`/`expenses`; `enforce_project_limit` caps active projects per
  tier. UI gating is correctly treated as non-authoritative.
- **Trigger fns not RPC-reachable:** `security_hygiene` migration revokes EXECUTE on all trigger
  functions + `next_invoice_number` from `anon`/`authenticated`/`public`.
- **Stripe Connect payment webhook (`stripe-webhook`):** signature-verified; idempotent (23505-only);
  **recomputes the expected amount server-side** from line items and refuses to mark paid on
  underpayment (logs a mismatch notification instead); handles refund/dispute/async-failure.
- **Public checkout (`stripe-checkout`):** validates token, status, expiry, and that the connected
  account `charges_enabled`; builds line items from the DB (client can't tamper amounts); destination
  charge to the issuer.
- **Subscription webhook:** signature-verified, idempotent; derives tier from product
  `metadata.tier`; never silently downgrades a live sub on a metadata misconfig.
- **`send-invoice`:** user-scoped (RLS) — an anon call can't read another user's invoice (404);
  recipient list sanitized (CR/LF/comma stripped → no header injection).
- **HTML/email injection:** `contact-form` + `send-invoice` escape HTML and strip CR/LF from headers.

---

## Go-live owner-actions to fold in (from handoff, not code)

LOO-5 (disable `mock_pay_invoice` — **see P0 #1**), LOO-8 (Stripe live keys), LOO-9 (prod Auth
redirect URLs), LOO-10 (IAM SES key), LOO-11 (token rotation), LOO-13 (register Stripe events:
`async_payment_failed`, `charge.refunded`, `charge.dispute.created`), LOO-90 (Stripe portal config).

## Follow-ups to file in Linear (team LOO) once MCP is authenticated

- ✅ **[P2] contact-form rate limiting** — DONE 2026-06-25 (per-IP 5/10min; migration + RPC). File as a
  closed issue for the record; optional Turnstile follow-up if abuse persists.
- ✅ **[P2] declarative `verify_jwt` in config.toml** — DONE 2026-06-25 (all 8 functions pinned).
- **[P3] live Supabase advisor run** to confirm RLS-perf rewrite + mock-pay disabled (verification task)

## Deploy/apply checklist for the 2026-06-25 P2 fixes

- `supabase db push` (applies `20260625000000_contact_rate_limit.sql`).
- `supabase functions deploy contact-form` (now reads `verify_jwt` from `config.toml` — the
  `--no-verify-jwt` flag is no longer needed but is harmless).
- Optionally redeploy the other functions so the gateway picks up their pinned `verify_jwt`.
- Smoke: 6 rapid contact submissions from one IP → the 6th returns HTTP 429.
