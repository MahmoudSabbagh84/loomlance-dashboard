# Paid-Signup Auto-Trial — Design Spec

- **Date:** 2026-06-24
- **Status:** Approved in brainstorm → ready for implementation plan
- **Linear:** LOO-89
- **Repos:** dashboard (`LoomLance-Dashboard`) + splash (`LoomLance-Splash`)

## Summary

When a user signs up for a paid plan (Freelancer / Studio), automatically start their **14-day Stripe trial** so they land in the dashboard already on that tier — no manual "go to Subscription and pick a plan" step. The trial is **card-required** via the existing Stripe Checkout. Detection + redirect happen **dashboard-side** on first authenticated load, so it works whether or not email confirmation is on.

## Goals

- Paid signup → auto-redirect to Stripe Checkout (14-day trial, card) → return to the dashboard already trialing on the chosen tier.
- Works identically with email confirmation **on or off**.
- If the user abandons Stripe Checkout, they land on **Solo** with a resume banner — never an auto-redirect loop.

## Non-goals (YAGNI)

- Card-free trials (decided: card-required).
- Changing trial mechanics — `create-subscription-checkout` already does the 14-day trial.
- A new annual/monthly selector — period is carried from the pricing CTA, defaulting to monthly.
- New DB columns — **reuse `stripe_customer_id`** as the "already offered" marker.

## Decisions (from brainstorm)

1. **Trial model:** card-required via Stripe Checkout (reuse `create-subscription-checkout`).
2. **Start flow (option A):** auto-redirect to Stripe on first dashboard load; bail → Solo + resume banner.
3. **Detection is dashboard-side** (robust to email confirmation; the dashboard owns the session + subscription state).
4. **"Already offered" marker = `stripe_customer_id`** — `create-subscription-checkout` saves it to the profile *when it creates the session* (before payment), so its presence means "we already sent them once." No migration.
5. **Period:** from the pricing CTA (`?period=`), default `monthly`.

## Architecture / components

### `shouldStartTrial(profile, selectedPlan)` — pure helper (unit-tested)
Returns `'redirect' | 'banner' | 'none'`.
- `paidIntent = selectedPlan === 'freelancer' || selectedPlan === 'studio'`
- `isFree = profile.subscription_tier === 'free' && !profile.stripe_subscription_id`
- **redirect:** `paidIntent && isFree && !profile.stripe_customer_id` (never offered)
- **banner:** `paidIntent && isFree && profile.stripe_customer_id` (offered, bailed)
- else **none** (Solo signup, already subscribed/trialing, or no intent)

Inputs: `profile.subscription_tier`, `profile.stripe_customer_id`, `profile.stripe_subscription_id`; `selectedPlan` from `user.user_metadata.selected_plan`.

### `TrialBootstrap` — dashboard
Mounted inside the authenticated app shell (after `AuthGate` confirms a session), where `profile` + `user` are available. On mount, once both are loaded, compute `shouldStartTrial`:
- `redirect` → call `create-subscription-checkout({ plan: selectedPlan, period })`; `window.location = url` (Stripe). Guard against double-fire (a ref/once flag).
- `banner` → render `TrialResumeBanner`.
- `none` → nothing.

### `TrialResumeBanner` — built via Impeccable
Persistent, **dismissible** dashboard banner for the bailed state: *"Finish starting your {Plan} trial"* + a button that re-invokes `create-subscription-checkout` → Stripe. Dismiss persists for the session (localStorage) so a user can stay on Solo.

### Plan/period → checkout
`selectedPlan` (`freelancer`/`studio`) + `period` (from `user.user_metadata.selected_period`, default `monthly`) → `create-subscription-checkout` body `{ plan, period }` (it builds `STRIPE_PRICE_<PLAN>_<PERIOD>`). `solo` is free → never triggers.

> **Profile query:** ensure the dashboard profile fetch selects `stripe_customer_id` + `stripe_subscription_id` (in addition to `subscription_tier`) so the helper can read them.

## Data flow

1. **Splash signup** stores `selected_plan` (already) + `selected_period` (from `?period=`, default monthly) in auth metadata.
2. Handoff → dashboard; user authenticated.
3. `TrialBootstrap` reads profile + metadata → `shouldStartTrial`.
4. **redirect** → `create-subscription-checkout` → Stripe Checkout (card + 14-day trial).
   - **success** → `success_url` (dashboard); `stripe-subscription-webhook` (`customer.subscription.created`) sets `subscription_tier`; profile refetch → trialing tier.
   - **cancel** → `cancel_url` (dashboard); next load → `banner` (customer now exists).
5. **banner** → `TrialResumeBanner`; click → checkout again.
6. **none** → normal app.

## Splash changes (LoomLance-Splash)

- `signup.html`: read `?period=` (`monthly`/`annual`) → store `selected_period` in `meta`. Update post-signup copy — remove *"start your 14-day trial from Settings → Subscription"*; for the email-confirm view say *"We'll start your {Plan} trial right after you sign in."* (the dashboard handles the redirect).
- `pricing.html`: ensure plan CTAs pass `?plan=<x>&period=<monthly|annual>` to `/signup` (add `period` if missing).

## Error handling

- `create-subscription-checkout` fails → toast + fall back to the banner (never trap the user).
- Unknown plan/period → no redirect; treat as `none` (they can upgrade via Subscription as today).
- Webhook lag after `success_url`: profile may briefly read `free`; the subscription view refetches; the banner is suppressed once a subscription exists. Brief, acceptable.

## Testing

- **Unit:** `shouldStartTrial` across every state — redirect, banner, none (solo, already-subscribed, offered-but-bailed, no intent).
- **Manual:** paid signup end-to-end with a Stripe **test card** → trialing on tier; bail at Stripe → banner → resume works.

## Build phases (→ writing-plans)

1. `shouldStartTrial` pure helper + unit tests.
2. `TrialBootstrap` (read profile + metadata, redirect logic, double-fire guard) + ensure profile query has the Stripe fields; wire into the app shell.
3. `TrialResumeBanner` (via Impeccable) + wire.
4. Splash: `signup.html` period capture + copy update; `pricing.html` CTA `period` param.
5. Verify — lint / unit tests / build green; manual end-to-end with a Stripe test card.

## Open questions

None — resolved in brainstorm.
