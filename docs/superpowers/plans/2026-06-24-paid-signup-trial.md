# Paid-Signup Auto-Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user who signs up for a paid plan auto-starts their 14-day Stripe trial and lands in the dashboard on that tier — no manual "go to Subscription" step.

**Architecture:** Detection is dashboard-side. A pure `shouldStartTrial(profile, plan)` returns `redirect | banner | none`; a `TrialBootstrap` mounted in the app shell either redirects to the existing `create-subscription-checkout` (reusing `useBilling().startCheckout`) or shows a dismissible resume banner. `stripe_customer_id` (saved by that function before payment) is the "already offered" marker — no migration. The splash captures the chosen plan/period into user metadata.

**Tech Stack:** React + Vite, @tanstack/react-query, Supabase auth/edge functions, vitest. Splash = static HTML + vanilla JS.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-24-paid-signup-trial-design.md` (LOO-89).
- **Trial = card-required via Stripe Checkout**; reuse `create-subscription-checkout` unchanged.
- **No DB migration** — reuse `profiles.stripe_customer_id` as the offered-marker.
- **Plan ids:** `solo` (free, never triggers) / `freelancer` / `studio`. **Periods:** `monthly` (default) / `annual`.
- `getMyProfile` already `select('*')` → `subscription_tier`, `stripe_customer_id`, `stripe_subscription_id` are present. `useUser().user.user_metadata` holds `selected_plan` / `selected_period`.
- **UI (the banner) is built via Impeccable**, per the project rule. Match Slate Pro tokens.
- Every task: `npm run lint` + `npm run build` green; the user pushes/deploys.

---

### Task 1: `shouldStartTrial` pure helper + tests (TDD)

**Files:**
- Create: `src/lib/trial.js`
- Test: `src/lib/__tests__/trial.test.js`

**Interfaces:**
- Produces: `shouldStartTrial(profile, selectedPlan) → 'redirect' | 'banner' | 'none'`. `profile` is the row from `getMyProfile` (or null); `selectedPlan` is a string id.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { shouldStartTrial } from '@/lib/trial'

const free = { subscription_tier: 'free', stripe_customer_id: null, stripe_subscription_id: null }

describe('shouldStartTrial', () => {
  it('redirects a paid-intent free user with no stripe customer yet', () => {
    expect(shouldStartTrial(free, 'freelancer')).toBe('redirect')
    expect(shouldStartTrial(free, 'studio')).toBe('redirect')
  })
  it('shows the banner once a customer exists but no subscription (bailed)', () => {
    expect(shouldStartTrial({ ...free, stripe_customer_id: 'cus_1' }, 'freelancer')).toBe('banner')
  })
  it('does nothing for a Solo / no-intent signup', () => {
    expect(shouldStartTrial(free, 'solo')).toBe('none')
    expect(shouldStartTrial(free, undefined)).toBe('none')
  })
  it('does nothing once subscribed (tier set or subscription id present)', () => {
    expect(
      shouldStartTrial({ subscription_tier: 'tier_1', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }, 'freelancer')
    ).toBe('none')
    expect(shouldStartTrial({ ...free, stripe_subscription_id: 'sub_1' }, 'freelancer')).toBe('none')
  })
  it('does nothing without a profile', () => {
    expect(shouldStartTrial(null, 'freelancer')).toBe('none')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/trial.test.js`
Expected: FAIL — module not found / `shouldStartTrial is not a function`.

- [ ] **Step 3: Implement the helper**

```js
// Decide what to do about a paid-plan signup intent, dashboard-side.
//   redirect → first time: send to Stripe Checkout (starts the trial)
//   banner   → already sent once (stripe_customer_id exists) but no subscription → resume prompt
//   none     → Solo/no intent, or already trialing/subscribed
const PAID = new Set(['freelancer', 'studio'])

export function shouldStartTrial(profile, selectedPlan) {
  if (!profile) return 'none'
  if (!PAID.has(selectedPlan)) return 'none'
  const isFree = profile.subscription_tier === 'free' && !profile.stripe_subscription_id
  if (!isFree) return 'none'
  return profile.stripe_customer_id ? 'banner' : 'redirect'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/trial.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/trial.js src/lib/__tests__/trial.test.js
git commit -m "feat(trial): shouldStartTrial() helper + tests (LOO-89)"
```

---

### Task 2: `TrialResumeBanner` (via Impeccable)

**Files:**
- Create: `src/features/subscription/TrialResumeBanner.jsx`

**Interfaces:**
- Produces: `<TrialResumeBanner planName={string} onResume={() => void} onDismiss={() => void} />`.

> **Build through Impeccable** (`/impeccable craft "trial resume banner"`). Contract below; match Slate Pro tokens + the existing banner/Card patterns.

- [ ] **Step 1: Build the banner via Impeccable**
  - A slim, full-width banner that sits above page content. Copy: *"Finish starting your {planName} trial — 14 days free, cancel anytime."* + a primary button **"Start trial"** (calls `onResume`) + a dismiss **×** (calls `onDismiss`, `aria-label="Dismiss"`).
  - Tokens: `bg-primary/10 border border-primary/30 text-fg`, button `bg-primary text-primary-fg`. Rounded, `px-4 py-3`, responsive (stacks on mobile). No layout shift.
  - Accessible: `role="region" aria-label="Trial"`, the × is a real button.

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/subscription/TrialResumeBanner.jsx
git commit -m "feat(trial): TrialResumeBanner (LOO-89)"
```

---

### Task 3: `TrialBootstrap` + wire into the app shell

**Files:**
- Create: `src/features/subscription/TrialBootstrap.jsx`
- Modify: `src/components/layout/AppShell.jsx` (mount `<TrialBootstrap />` above page content)

**Interfaces:**
- Consumes: `shouldStartTrial` (Task 1); `TrialResumeBanner` (Task 2); `useProfile` (`@/hooks/useProfile`), `useUser` (`@/hooks/useAuth`), `useBilling` (`@/hooks/useBilling` → `startCheckout(plan, period)`).
- Produces: `<TrialBootstrap />` (renders the banner or null; runs the redirect effect once).

- [ ] **Step 1: Create `TrialBootstrap.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useUser } from '@/hooks/useAuth'
import { useBilling } from '@/hooks/useBilling'
import { shouldStartTrial } from '@/lib/trial'
import { TrialResumeBanner } from './TrialResumeBanner'

const PLAN_NAMES = { freelancer: 'Freelancer', studio: 'Studio' }
const DISMISS_KEY = 'loomlance.trialBannerDismissed'

export function TrialBootstrap() {
  const { user } = useUser()
  const { data: profile } = useProfile()
  const { startCheckout } = useBilling()
  const fired = useRef(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })

  const plan = user?.user_metadata?.selected_plan
  const period = user?.user_metadata?.selected_period || 'monthly'
  const action = profile ? shouldStartTrial(profile, plan) : 'none'

  useEffect(() => {
    if (action === 'redirect' && !fired.current) {
      fired.current = true // guard StrictMode double-invoke; the redirect navigates away anyway
      startCheckout(plan, period)
    }
  }, [action, plan, period, startCheckout])

  if (action !== 'banner' || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      /* private mode — in-memory only */
    }
    setDismissed(true)
  }

  return (
    <TrialResumeBanner
      planName={PLAN_NAMES[plan] || 'paid'}
      onResume={() => startCheckout(plan, period)}
      onDismiss={dismiss}
    />
  )
}
```

- [ ] **Step 2: Mount it in `AppShell.jsx`**

In `src/components/layout/AppShell.jsx`, import and render `<TrialBootstrap />` as the first child of the content container so the banner sits above the page:

```jsx
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from '@/features/search/CommandPalette'
import { TrialBootstrap } from '@/features/subscription/TrialBootstrap'

export function AppShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="relative flex-1 bg-bg">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-0 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent)] dark:opacity-100" />
          <div className="relative mx-auto max-w-7xl px-6 py-5">
            <TrialBootstrap />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/subscription/TrialBootstrap.jsx src/components/layout/AppShell.jsx
git commit -m "feat(trial): TrialBootstrap — auto-start trial / resume banner on first load (LOO-89)"
```

---

### Task 4: Splash — capture period + update copy (LoomLance-Splash repo)

**Files (in `C:\Users\mahmo\Desktop\LoomLance-Splash`):**
- Modify: `signup.html`
- Modify: `pricing.html`

- [ ] **Step 1: `signup.html` — capture the period into metadata**

Add a `selectedPeriod` variable defaulting to `'monthly'`, read from `?period=`, and include it in the signup `meta`.

In the init block (currently reads `plan` from the URL), add period handling:
```js
const params = new URLSearchParams(window.location.search)
const planFromUrl = params.get('plan')
const periodFromUrl = params.get('period')
selectedPeriod = periodFromUrl === 'annual' ? 'annual' : 'monthly'
applyPlan(planFromUrl && PLANS[planFromUrl] ? planFromUrl : selectedPlan)
```
Declare `let selectedPeriod = 'monthly'` next to `let selectedPlan = 'freelancer'`. Then in the `meta` object passed to `LoomAuth.signUp`, add:
```js
selected_period: selectedPeriod,
```

- [ ] **Step 2: `signup.html` — update the copy (trial is now automatic)**

Replace the manual-trial wording so it reflects auto-start:
- Plan note for paid plans (`applyPlan`, the `else` branch): change `You'll start your 14-day ${PLANS[id].name} trial (card required) from your dashboard after signing in.` → `We'll start your 14-day ${PLANS[id].name} trial (card required) right after you sign in.`
- Check-email view (`showCheckEmail`, the paid `note.textContent`): change `After signing in, start your 14-day ${PLANS[selectedPlan].name} trial from Settings → Subscription.` → `After you confirm and sign in, we'll start your 14-day ${PLANS[selectedPlan].name} trial automatically.`

- [ ] **Step 3: `pricing.html` — pass plan + period on the CTAs**

Read `pricing.html`. For each plan's "Get started"/CTA link to `/signup`, ensure the href carries the plan id and the currently-selected billing period, i.e. `/signup?plan=<freelancer|studio>&period=<monthly|annual>` (Solo → `/signup?plan=solo`). If the monthly/annual toggle is JS-driven, update the CTA hrefs when the toggle changes so `period` matches. (Default-monthly in signup means this is an enhancement, not a hard dependency.)

- [ ] **Step 4: Commit (splash repo)**

```bash
cd /c/Users/mahmo/Desktop/LoomLance-Splash
git add signup.html pricing.html
git commit -m "feat(signup): capture trial period + auto-start copy (LOO-89)"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Full dashboard checks**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean, all tests pass (incl. the 5 new), build succeeds.

- [ ] **Step 2: Manual smoke (with Stripe test mode)**
  - Sign up for **Freelancer** → land in dashboard → auto-redirect to Stripe Checkout → enter a **test card** → return → dashboard shows the tier (trialing). 
  - Sign up again / cancel at Stripe → land on Solo → **resume banner** appears → click "Start trial" → back to Stripe. Dismiss → banner gone (persists per browser).
  - Sign up for **Solo** → no redirect, no banner.

---

## Self-Review

**Spec coverage:** card-required trial reusing create-subscription-checkout (Task 3 via `useBilling`) ✓; auto-redirect on first load + bail→banner (Task 3) ✓; `shouldStartTrial` redirect/banner/none using `stripe_customer_id` marker, no migration (Task 1) ✓; `TrialBootstrap` + `TrialResumeBanner` via Impeccable (Tasks 2–3) ✓; splash period capture + copy (Task 4) ✓; period default monthly (Task 3 `|| 'monthly'`) ✓; profile already exposes the Stripe fields (no query change — confirmed `getMyProfile` selects `*`) ✓; tests (Task 1) ✓.

**Placeholder scan:** none — real code in every dashboard step; the banner (Task 2) and the splash pricing CTA (Task 4.3) are interface-specified where Impeccable/an existing-file read owns the exact markup, not hand-waved.

**Type consistency:** `shouldStartTrial(profile, selectedPlan) → 'redirect'|'banner'|'none'` matches between Task 1 (def) and Task 3 (consume). `startCheckout(plan, period)` matches `useBilling`. Metadata keys `selected_plan`/`selected_period` match between splash (Task 4) and dashboard (Task 3). Plan ids `freelancer`/`studio` consistent.

## Open questions

None.
