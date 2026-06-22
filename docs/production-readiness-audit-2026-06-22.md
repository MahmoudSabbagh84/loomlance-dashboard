# LoomLance — Production Readiness Audit
**Date:** 2026-06-22 · **Scope:** full platform — splash (`loomlance.com`) → dashboard (`app.loomlance.com`) → Supabase backend, Edge Functions, payments, infra · **Method:** code review of both repos + live DB inspection + Supabase security/performance advisors.

> **Purpose:** a shared, discussable picture of what is production‑grade and what must be done before going fully live (taking real money). Read the **TL;DR** and **Go‑live blockers** first; the per‑area sections back them up.

---

## How to read this
**Severity** — `P0` go‑live blocker (security hole / data loss / money risk / legal) · `P1` fix before/with launch · `P2` soon after · `P3` hygiene/nice‑to‑have.
**Owner** — `DEV` = code/migration change · `USER` = account/console action (Stripe, AWS, Supabase, Amplify) only you can do.

---

## TL;DR — overall grade: **B+ (core is genuinely A‑grade; not yet go‑live)**

The **engineering core is strong and production‑shaped**: complete row‑level security on every table, server‑side tier enforcement (not just UI), real Stripe webhook signature verification + idempotency, no service‑role secrets in the client, and the autosave/invoice flows are well‑built (the blank‑invoice bug from earlier today is fixed + tested). There are **no committed secrets** in either repo.

What stands between you and "fully live" is a **finite, well‑understood blocker list** — mostly the expected **Stripe live cutover + account chores**, plus **two real code bugs** (a stale‑client send path and the recurring‑invoice cron) and **security‑header/legal‑page gaps** normal for a pre‑launch site. Nothing here is architectural or open‑ended.

| Area | Grade | One‑line |
|---|---|---|
| Backend / data / security | **A−** | RLS complete, definer functions safe, self‑upgrade closed; fix the mock‑pay grant + webhook edge cases |
| Dashboard frontend / UX | **B+** | Solid patterns; 1 P0 (stale client on Send) + autosave data‑loss‑on‑close |
| Splash / marketing | **A−** | Clean, consistent, good flows; needs security headers, OG images, real legal pages |
| Payments / billing | **B** | Architecture & safety good; still TEST mode, cutover is multi‑step, Connect "ready" not verified |
| Infra / deploy / config | **B−** | Deployed & cron running; stale pre‑production doc, SPA rewrite + user chores pending |

---

## 🚦 Go‑live blockers (P0) — the must‑do list

| # | Blocker | Owner | Action |
|---|---|---|---|
| 1 | **`mock_pay_invoice` is still EXECUTE‑able by `anon`.** Today only a runtime flag (`app_config.mock_payments_enabled`, currently `false` on dev) stops an unauthenticated visitor with an invoice link from marking it **paid**. | DEV | Ship a migration to `drop function mock_pay_invoice(text)` (and remove its frontend caller) — don't rely on the flag in prod. Confirm flag `false` on the prod project. |
| 2 | **Send/Download uses a stale client after changing a draft's client.** Same class as today's line‑items bug: autosave writes `client_id` but the embedded `clients(*)` join isn't refreshed, so changing a draft's client then clicking Send emails the **previous** client (wrong recipient + wrong "Bill to"). | DEV | When `client_id` changes, invalidate `['invoices','detail',id]` (refetch the join) instead of shallow `setQueryData`. |
| 3 | **Recurring‑invoice cron has no per‑template error isolation.** One bad template aborts the whole daily batch — every later customer silently gets no invoice. | DEV | Wrap each loop iteration in `begin…exception when others then …continue` + log. |
| 4 | **Stripe LIVE cutover** (currently TEST mode). | USER + DEV | Swap `sk_test_`→`sk_live_`; register **both** webhooks in live (Connect *and* subscription) with their two distinct signing secrets; create live Products w/ `metadata.tier` + live Prices and set the four `STRIPE_PRICE_*` envs; enable Connect in live; run one real connect→pay end‑to‑end. |
| 5 | **Supabase Auth URL config not set** for `app.loomlance.com` (Site URL + Redirect URLs). | USER | Confirmation/reset/`emailRedirectTo` links break without it. Add the dashboard origin to Auth → URL Configuration. |
| 6 | **AWS: delete the root access key; use an IAM‑scoped SES sender.** Confirm SES is out of sandbox. | USER | SES creds for `send-invoice`/`contact-form` must be a dedicated IAM user limited to `ses:SendEmail`, not root. |
| 7 | **Rotate the previously‑leaked Supabase access token** (`sbp_…`, already noted unchecked in `pre-production.md §0`). | USER | Supabase → Account → Access Tokens; update CI/local. |
| 8 | **Verify the Amplify SPA rewrite** (`/<*> → /index.html`, 200) exists for the dashboard. | USER | Without it, deep links (`/i/:token`, `/profile`) 404 on refresh. |

> Items 4–8 are the expected "flip to production" chores (most already tracked in `pre-production.md`). Items 1–3 are code fixes I can do now.

---

## A. Backend / data / security — **A−**

### ✅ Solid
- **RLS on every user table**, scoped `user_id = auth.uid()` for select/insert/update/delete. Internal tables (`app_config`, `stripe_events`, `invoice_number_sequences`) have RLS on with **no policies** = correctly deny‑all to end users.
- **Every `SECURITY DEFINER` function sets `search_path = public`** (no search‑path injection). Owner‑scoped RPCs re‑check `auth.uid()`; internal workers are revoked from `anon, authenticated`.
- **Self‑upgrade hole closed** — `protect_billing_columns` trigger forces `subscription_tier/status/stripe_*` back to OLD for authenticated/anon updates (RLS can't do column‑level); `enforce_tier_feature` triggers gate time/recurring/expenses at the data layer.
- **No service‑role key client‑side** (verified). Client uses only the anon/publishable key.
- **`get_public_invoice`** returns only curated display fields (no token/internal IDs), respects link expiry, gates `can_pay`/`paypal_link` on the per‑user toggle.

### ⚠️ Needs work
- **[P0 · DEV] `mock_pay_invoice` granted to `anon`** — see blocker #1. `drop`/`revoke` for prod.
- **[P1 · DEV] Payment webhook doesn't reconcile amount or handle failure/refund** — `stripe-webhook` marks `paid` on `checkout.session.completed` using `amount_total` with no check vs the invoice total, and ignores `async_payment_failed` / `charge.refunded` / disputes → an under/failed/refunded invoice stays "paid." Handle the failure event (don't mark paid) and ideally refunds/disputes.
- **[P1 · DEV] Idempotency swallows *all* insert errors** — both webhooks treat any `stripe_events` insert error as "duplicate → 200." A transient DB error then makes Stripe stop retrying → dropped event. Only swallow on unique‑violation (`23505`); else return 500.
- **[P2 · DEV] `send-invoice` doesn't validate `to` / cap `pdfBase64`** — recipient goes into the `To:` header unchecked (no CR/LF strip like contact‑form has) → header‑injection / arbitrary‑recipient via the platform SES domain. Validate email + strip CR/LF + size‑cap.
- **[P2 · DEV] CORS `Allow-Origin: '*'` on all functions** — tighten to the dashboard+splash origins for the authenticated functions.
- **[P2 · DEV] Subscription webhook defaults missing‑metadata tier to `free`** — a live Product without `metadata.tier` would silently downgrade a paying user. Log/skip instead of defaulting.
- **[P2 · DEV] `createPayment`/`updateMyProfile` spread raw input, no zod; `invoice_payments.amount` has no CHECK** — data‑quality (e.g. negative payments). Add a schema + `amount > 0` check. (Not a security hole — RLS + trigger still protect.)
- **[P3 · DEV] Totals computed in 3 places** (`lib/money.js`, `mock_pay_invoice` SQL, `stripe-checkout`) with slightly different rounding → possible 1‑cent drift between displayed/charged/recorded on mixed tax rates. Consolidate on one rule.

---

## B. Dashboard frontend / UX / correctness — **B+**

### ✅ Solid
- **The invoice blank‑send bug is fixed + tested** (`InvoiceEditor.save()` now refreshes the detail cache's line items; `InvoiceEditor.cache.test.jsx`).
- **Autosave engine is well‑designed** — serialized writes (latest‑wins), failed patches retained + retryable, no‑op skipping, validates before persist; `SaveStatus` + retry surface errors.
- **Controlled‑select‑with‑async‑options bug class is fixed everywhere** (invoice/contract/project/expense/recurring/time editors).
- **Tier gating centralized** (`lib/tier.js`), consistent with the DB triggers (which are the real enforcement).
- **Accessibility basics + error/loading/empty states** present; PDF/preview null‑safe.

### ⚠️ Needs work
- **[P0 · DEV] Stale embedded client on Send/PDF after changing a draft's client** — see blocker #2. Sends to the wrong client.
- **[P1 · DEV] Pending autosave dropped on modal close / navigation** — `useAutosave` cleanup clears the debounce timer without flushing. Typing then closing a form modal (or navigating) within ~700ms silently loses the last edit, while the user believes "it autosaved." Flush on unmount / before `onClose`.
- **[P2 · DEV] Validation failures during autosave give no feedback** — an invalid field is dropped and status returns to `idle`; user thinks it saved. Surface a "not saved — fix errors" state.
- **[P2 · DEV] Reports don't refresh after payment/timer mutations while open** — `['reports', …]` keys aren't invalidated (refetch on mount mitigates, but a CSV export from an already‑open report can capture stale rows). Add `invalidateQueries(['reports'])`.
- **[P3 · DEV] Duplicate / Void / Mark‑sent buttons not disabled while pending** — double‑click Duplicate can create two invoices. Add `disabled/loading`.
- **[P3 · DEV] `MarkPaidModal` always records the full total + forces `paid`** — partial payments still flip to fully paid. Confirm intended.

---

## C. Splash / marketing — **A−**

### ✅ Solid
- **Link integrity clean** — extensionless paths, no leftover `.html`/orange/`styles.css`; `?plan=` deep‑links work.
- **Design system consistent** with the dashboard; good contrast on dark bands.
- **Auth handoff design is sound** — splash stores no session; hands off via the URL **hash** (never sent to servers/referrers); `signin.html` is a correct hostname‑aware redirect to the canonical dashboard `/login`.
- **Signup flow** — lean fields (F3), correct `autocomplete`, live password rules, clear plan‑intent messaging; **contact form** has a real honeypot + validation + rate‑limit + graceful fallback; gtag consistent across pages.

### ⚠️ Needs work
- **[P1 · USER/DEV] No security headers at the hosting layer** — the per‑page CSP `<meta>` was removed (it blocked gtag/lucide/fonts) and nothing replaced it. Add at Amplify: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`/CSP `frame-ancestors` (clickjacking on the auth origins), and a CSP allow‑listing googletagmanager/unpkg/fonts/Supabase. Applies to the **dashboard** origin too.
- **[P1 · DEV] Auth refresh‑token lands in browser history** via the hash handoff — acceptable for launch (magic‑link shape, short‑lived access token), **but confirm the dashboard scrubs the hash** (`history.replaceState`) right after `detectSessionInUrl` consumes it.
- **[P1 · DEV] OG/Twitter image + canonical missing** — only `signup.html` has any OG/canonical; `twitter:card=summary_large_image` with no image → blank unfurls. Add `og:image`/`twitter:image` (1200×630) + `<link rel="canonical">` to index/pricing/contact.
- **[P2 · USER] Terms of Service & Privacy Policy are `alert()` placeholders** — signup *requires* agreeing to them (plus marketing consent). Publish real `/terms` and `/privacy` before going live (compliance, esp. EU).
- **[P2 · DEV] Contact `sanitizeInput` deletes the substring "script"** — mangles legit text ("JavaScript" → "Java"). Remove it; rely on output‑encoding (already done server‑side).
- **[P2 · DEV] Contact name regex rejects international names** (José/王/Müller). Loosen to Unicode letters.
- **[P3 · DEV] Lucide pinned to `@latest`** on every page — an upstream change/outage breaks all icons in prod. Pin an exact version (and consider SRI/self‑host).
- **[P3 · DEV] Password‑toggle `aria-label` never updates** (stays "Show password").

---

## D. Payments / billing — **B**

### ✅ Solid
- Webhook **signature verification** (both) + **idempotency ledger** (`stripe_events`); **Connect** is a destination charge with 0 platform fee (correct for the model); public `stripe-checkout` validates token/expiry/status/connected‑account before creating a session.
- **Mock gate is OFF on dev** (live‑confirmed: `mock_pay_invoice` raises `MOCK_PAYMENTS_DISABLED`); frontend routes to real `stripe-checkout` when `VITE_PAYMENTS_PROVIDER=stripe`.

### ⚠️ Needs work
- **[P0]** Stripe live cutover — blocker #4 (note: `pre-production.md` lists only one webhook and omits the subscription webhook + `STRIPE_PRICE_*` envs — **incomplete; subscriptions would silently never update tier**).
- **[P2 · DEV] Connect onboarding never confirms `charges_enabled`** — a freelancer can show "Connected" yet not actually accept charges (no `account.updated` handler), so a client's checkout could fail at pay time. Check `charges_enabled` before showing "can pay."
- **[P2] PayPal is honor‑system by design** (manual "Mark paid", no reconciliation) — fine for MVP; keep the in‑product note clear.

---

## E. Infra / deploy / config / DB advisors — **B−**

### ✅ Solid
- Both apps deployed on Amplify (splash no‑build serving committed `app.css`; dashboard Vite build). All three pg_cron jobs active and correctly ordered (overdue 06:00, due‑soon 06:15, recurring 06:30 UTC). **No committed secrets** (Stripe/Resend values in docs are `xxx` placeholders).

### ⚠️ Needs work
- **[P1 · DEV] `pre-production.md` is stale** — says **Resend** (actual: AWS **SES**) and **Vercel** (actual: **Amplify**), and the Stripe section omits the subscription webhook + price envs. Reconcile it so the cutover checklist is trustworthy.
- **[P2 · DEV] DB performance hygiene** (Supabase advisors, non‑blocking): **53× `auth_rls_initplan`** — RLS policies re‑evaluate `auth.uid()` per row; wrap as `(select auth.uid())` for a big scan speedup. **13 unindexed foreign keys** (add covering indexes). 4 unused indexes. [linter docs](https://supabase.com/docs/guides/database/database-linter)
- **[P3 · USER] Enable leaked‑password protection** (Supabase Auth → HaveIBeenPwned).
- **[P3 · DEV] `set_updated_at` has a mutable `search_path`** — set `search_path = public` to match the others.
- **[P3 · DEV] Trigger functions exposed via `/rest/v1/rpc`** (enforce_*, handle_new_user, protect_billing_columns, seed_default_columns) — harmless (they error without trigger context) but `REVOKE EXECUTE … FROM anon, authenticated` is the clean posture. Also revoke `next_invoice_number` from anon.

---

## Appendix — DB advisor raw counts
- **Security:** 1× `function_search_path_mutable` (WARN), ~21× `*_security_definer_function_executable` (WARN, mostly by‑design triggers/RPCs), 3× `rls_enabled_no_policy` (INFO, intentional), 1× leaked‑password‑protection disabled (WARN).
- **Performance:** 53× `auth_rls_initplan` (WARN), 13× `unindexed_foreign_keys` (INFO), 4× `unused_index` (INFO), 1× auth connection‑pool note.

---

## Suggested sequence for discussion
1. **This week (DEV, I can do now):** blockers #1–#3 + the two P1 webhook fixes + autosave flush‑on‑close. All small, all covered by the patterns already in the codebase.
2. **Cutover day (USER):** blockers #4–#8 (Stripe live, Auth URLs, AWS IAM/SES, rotate PAT, Amplify rewrite) + reconcile `pre-production.md`.
3. **Fast‑follow (DEV):** security headers/CSP, OG/canonical, Connect `charges_enabled`, RLS initplan + FK indexes, legal pages (USER content).

> **Bottom line:** the platform is close. The core is trustworthy enough to put in front of paying users *once the P0 list is cleared* — none of it is rework, it's the expected last‑mile of going live.
