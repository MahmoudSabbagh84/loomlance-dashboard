# Onboarding + Business Profile — Design Spec

- **Date:** 2026-06-24
- **Status:** Approved in brainstorm → ready for implementation plan
- **Linear:** LOO-92

## Summary

Two linked profile/onboarding reworks: (1) the Business profile adapts to **registered businesses vs. solo freelancers working under their own name**, via a business-type toggle that drives labels — without changing anything downstream; (2) the new-account **get-started checklist** leads with the business profile, is **tier-aware**, and adds a light one-time welcome.

## Part 1 — Business profile (LLC vs own name)

- New column **`profiles.business_type`** (`text`, `'business' | 'individual'`, **default `'business'`** so existing accounts are unchanged). Migration.
- A **toggle** at the top of `BusinessTab`: *"How do you work? — Registered business · Under my own name."*
  - **`business`** → field label **"Business name"**, placeholder "Acme LLC"; **Tax ID** shown normally.
  - **`individual`** → field label **"Your name"**, placeholder "Jane Smith"; **Tax ID** labeled *"Tax ID (optional)"* and de-emphasized.
- The **stored field stays `business_name`** (the invoice/PDF/email "from" name) regardless of type — nothing downstream changes. `business_type` only drives labels/emphasis.
- Built via Impeccable (matches the existing autosaved `BusinessTab` form pattern + Slate Pro).

## Part 2 — Get-started checklist (business-first + tier-aware)

- A pure helper **`onboardingTasks(tier, counts, profile)`** → ordered `[{ key, label, to, done }]`:
  1. **Set up your business profile** — `done = !!profile.business_name` → `/profile` *(all tiers, always first)*
  2. **Add your first client** — `done = counts.clients > 0` → `/clients`
  3. **Create your first project** — `done = counts.projects > 0` → `/projects`
  4. **Add your logo** — `done = !!profile.<logo field>` → `/profile?tab=branding` *(only when `hasFeature(tier, BRANDING)`)*
  5. **Send your first invoice** — `done = counts.invoices > 0` → `/invoices`
  - Tasks the tier doesn't include are **omitted** (not shown locked). **"Connect online payments" is intentionally not in the checklist** (dropped per QA).
- `OnboardingChecklist` renders the helper's list (keeps "hide when all done").
- **Light touch of B:** a one-time, dismissible **welcome** state on the checklist on first login — *"Welcome to LoomLance 👋 Start by setting up your business profile."* — dismissed via `localStorage` (`loomlance.onboardingWelcomeDismissed`). No blocking modal/gate.
- Built via Impeccable.

## Data flow

- `BusinessTab` reads/writes `business_type` + `business_name` (+ existing fields) via the existing autosave form.
- `OnboardingChecklist` fetches counts (existing query) + reads `profile` (business_name, logo field) + `tier` (`useProfile().subscription_tier` → `hasFeature`); passes them to `onboardingTasks`.

## Error handling / edge cases

- Existing accounts: `business_type` default `'business'` → identical to today's "Business name" labeling.
- No tier / loading: render nothing (as today) until profile + counts load.
- Branding task only appears for tiers that include branding; its "done" needs the profile logo field (confirm exact name in the plan).

## Testing

- **Unit:** `onboardingTasks(tier, counts, profile)` — business-first ordering; branding present only for branding tiers; `done` flags from counts/profile; all-done → empty.
- Manual: toggle business type → labels/placeholders swap; checklist shows business-first + tier-appropriate items; welcome shows once then dismisses.

## Build phases (→ writing-plans)

1. Migration: `profiles.business_type`.
2. `onboardingTasks` pure helper + unit tests.
3. `BusinessTab`: business-type toggle + adaptive labels/emphasis (Impeccable).
4. `OnboardingChecklist`: render the helper's list + welcome state (Impeccable).
5. Verify — lint / tests / build; manual.

## Open questions

None — resolved in brainstorm.
