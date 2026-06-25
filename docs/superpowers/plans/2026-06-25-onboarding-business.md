# Onboarding + Business Profile Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Business profile adapt to registered-business vs. solo-under-own-name, and replace the dashboard get-started checklist with a business-first, tier-aware list plus a one-time welcome.

**Architecture:** One additive DB column (`profiles.business_type`) drives only labels/emphasis — the stored `business_name` and everything downstream are unchanged. A pure helper `onboardingTasks(tier, counts, profile)` computes the ordered checklist; `OnboardingChecklist` renders it and self-fetches profile + tier (no prop changes at the call site). UI work goes through Impeccable against Slate Pro tokens.

**Tech Stack:** React + Vite, react-hook-form + zod + `useAutosaveForm`, TanStack Query, Tailwind (Slate Pro tokens), Supabase (hosted dev — no local Docker), Vitest.

## Global Constraints

- **All UI via the Impeccable skill** (`/impeccable`), matching the existing Slate Pro tokens and the autosaved form pattern in `BusinessTab`/`BrandingTab`. Never hand-roll UI.
- **The stored "from" field stays `business_name`** regardless of type — invoices/PDF/email are untouched. `business_type` only drives labels/emphasis.
- **`business_type` default is `'business'`** so every existing account is identical to today.
- **Feature flag for branding is `FEATURES.CUSTOM_BRANDING`** from `src/lib/tier.js` (the spec's "BRANDING"). Use `hasFeature(tier, FEATURES.CUSTOM_BRANDING)`.
- **Logo field is `profiles.logo_url`.** Tier is `profile.subscription_tier` (fallback `'free'`).
- **"Connect online payments" is intentionally NOT in the checklist** (dropped per QA).
- **localStorage key convention is `loomlance.<thing>`** — welcome dismiss key is `loomlance.onboardingWelcomeDismissed`.
- **Commit trailer on every commit:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Hosted dev is Supabase project `zbipqfsqxnvrzhpdjvvy`. Push is manual/gated — commit locally, do not push.

---

### Task 1: Migration — `profiles.business_type`

**Files:**
- Create: `supabase/migrations/20260625000000_business_type.sql`

**Interfaces:**
- Produces: column `public.profiles.business_type text not null default 'business'`, constrained to `'business' | 'individual'`. Consumed by Tasks 2–4.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260625000000_business_type.sql`:

```sql
-- business_type drives ONLY the BusinessTab labels (registered business vs. solo under own
-- name). The stored "from" field stays business_name; nothing downstream changes.
-- Default 'business' keeps every existing account identical to today.
alter table public.profiles
  add column if not exists business_type text not null default 'business';

alter table public.profiles
  drop constraint if exists profiles_business_type_check;
alter table public.profiles
  add constraint profiles_business_type_check
  check (business_type in ('business', 'individual'));
```

- [ ] **Step 2: Apply to hosted dev**

Apply the migration to project `zbipqfsqxnvrzhpdjvvy`. Either:
- Supabase MCP `apply_migration` with name `business_type` and the SQL above, **or**
- `supabase db push` if the CLI is linked.

- [ ] **Step 3: Verify the column exists and defaults correctly**

Run (Supabase MCP `execute_sql` or psql):

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'business_type';
```

Expected: one row, `data_type = text`, `column_default = 'business'::text`, `is_nullable = NO`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260625000000_business_type.sql
git commit -m "feat(profile): profiles.business_type column (LOO-92)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `onboardingTasks` pure helper + unit tests

**Files:**
- Create: `src/lib/onboarding.js`
- Test: `src/lib/__tests__/onboarding.test.js`

**Interfaces:**
- Consumes: `hasFeature`, `FEATURES` from `@/lib/tier`.
- Produces: `onboardingTasks(tier, counts, profile) -> Array<{ key: string, label: string, to: string, done: boolean }>`, ordered business-first. `counts` is `{ clients, projects, invoices }` (extra keys ignored); `profile` has `business_name` and `logo_url`. The branding task (`key: 'logo'`) is present only when `hasFeature(tier, FEATURES.CUSTOM_BRANDING)`. Missing `counts`/`profile` → all `done: false`. Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/onboarding.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { onboardingTasks } from '@/lib/onboarding'

const emptyCounts = { clients: 0, projects: 0, invoices: 0 }
const emptyProfile = { business_name: '', logo_url: null }

describe('onboardingTasks', () => {
  it('always leads with the business profile task, first in order', () => {
    const tasks = onboardingTasks('free', emptyCounts, emptyProfile)
    expect(tasks[0]).toMatchObject({ key: 'business', to: '/profile', done: false })
    expect(tasks[0].label).toBe('Set up your business profile')
  })

  it('omits the logo task for tiers without custom branding (free)', () => {
    const keys = onboardingTasks('free', emptyCounts, emptyProfile).map((t) => t.key)
    expect(keys).toEqual(['business', 'clients', 'projects', 'invoice'])
  })

  it('includes the logo task for branding tiers, before the invoice task', () => {
    const keys = onboardingTasks('tier_1', emptyCounts, emptyProfile).map((t) => t.key)
    expect(keys).toEqual(['business', 'clients', 'projects', 'logo', 'invoice'])
    const logo = onboardingTasks('tier_1', emptyCounts, emptyProfile).find((t) => t.key === 'logo')
    expect(logo).toMatchObject({ to: '/profile?tab=branding', done: false })
  })

  it('marks done from counts and profile', () => {
    const tasks = onboardingTasks(
      'tier_2',
      { clients: 2, projects: 1, invoices: 3 },
      { business_name: 'Acme LLC', logo_url: 'https://x/y.png' }
    )
    const done = Object.fromEntries(tasks.map((t) => [t.key, t.done]))
    expect(done).toEqual({ business: true, clients: true, projects: true, logo: true, invoice: true })
  })

  it('treats missing counts/profile as not-done (no throw)', () => {
    const tasks = onboardingTasks('free', undefined, undefined)
    expect(tasks.every((t) => t.done === false)).toBe(true)
    expect(tasks[0].key).toBe('business')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/onboarding.test.js`
Expected: FAIL — `onboardingTasks` is not exported / not defined.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/onboarding.js`:

```js
import { hasFeature, FEATURES } from '@/lib/tier'

// Ordered, business-first get-started tasks. Tier-aware: the logo task only appears for tiers
// that include custom branding. Pure — the component passes tier/counts/profile in.
export function onboardingTasks(tier, counts, profile) {
  const c = counts ?? {}
  const p = profile ?? {}
  const tasks = [
    { key: 'business', label: 'Set up your business profile', to: '/profile', done: !!p.business_name },
    { key: 'clients', label: 'Add your first client', to: '/clients', done: (c.clients ?? 0) > 0 },
    { key: 'projects', label: 'Create your first project', to: '/projects', done: (c.projects ?? 0) > 0 },
  ]
  if (hasFeature(tier, FEATURES.CUSTOM_BRANDING)) {
    tasks.push({ key: 'logo', label: 'Add your logo', to: '/profile?tab=branding', done: !!p.logo_url })
  }
  tasks.push({ key: 'invoice', label: 'Send your first invoice', to: '/invoices', done: (c.invoices ?? 0) > 0 })
  return tasks
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/onboarding.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding.js src/lib/__tests__/onboarding.test.js
git commit -m "feat(onboarding): onboardingTasks tier-aware business-first helper (LOO-92)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `BusinessTab` — business-type toggle + adaptive labels (Impeccable)

**Files:**
- Modify: `src/features/profile/BusinessTab.jsx`

**Interfaces:**
- Consumes: `profiles.business_type` (Task 1); existing `useProfile`/`useUpdateProfile`/`useAutosaveForm`.
- Produces: no exported API change — same `BusinessTab` component; now persists `business_type` alongside the existing fields.

- [ ] **Step 1: Run Impeccable for the toggle + adaptive labels**

Invoke `/impeccable` (craft) to design a two-option segmented toggle at the top of the form —
*"How do you work?"* with options **Registered business** / **Under my own name** — matching Slate Pro
tokens and the surrounding `Card` form. The toggle drives:
- `business` → `business_name` label **"Business name"**, placeholder `"Acme LLC"`; Tax ID labeled **"Tax ID"**.
- `individual` → `business_name` label **"Your name"**, placeholder `"Jane Smith"`; Tax ID labeled **"Tax ID (optional)"**, with `text-fg-muted` de-emphasis on its `Label`.

- [ ] **Step 2: Implement the change**

Replace the body of `src/features/profile/BusinessTab.jsx` with (Impeccable refines the toggle markup/classes, but keep this structure and the autosave wiring):

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useAutosaveForm } from '@/hooks/useAutosave'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

const schema = z.object({
  business_type: z.enum(['business', 'individual']),
  business_name: z.string().max(200).optional().or(z.literal('')),
  tax_id: z.string().max(60).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  default_currency: z.string().length(3),
})

const TYPE_OPTIONS = [
  { value: 'business', label: 'Registered business' },
  { value: 'individual', label: 'Under my own name' },
]

export function BusinessTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const {
    register,
    watch,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      business_type: profile?.business_type ?? 'business',
      business_name: profile?.business_name ?? '',
      tax_id: profile?.tax_id ?? '',
      address: profile?.address ?? '',
      default_currency: profile?.default_currency ?? 'USD',
    },
    // A post-save refetch must not clobber fields the user is still editing.
    resetOptions: { keepDirtyValues: true },
  })

  const { status, retry } = useAutosaveForm({
    watch,
    commit: async () => {
      if (!(await trigger())) return false
      await update.mutateAsync(getValues())
    },
  })

  const businessType = watch('business_type')
  const isIndividual = businessType === 'individual'

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="max-w-xl space-y-4">
      <div>
        <Label>How do you work?</Label>
        <div role="radiogroup" aria-label="How do you work?" className="mt-1 inline-flex rounded-md border border-border bg-bg-muted p-0.5">
          {TYPE_OPTIONS.map((opt) => {
            const active = businessType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setValue('business_type', opt.value, { shouldDirty: true })}
                className={
                  'rounded px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (active ? 'bg-bg text-fg shadow-sm' : 'text-fg-muted hover:text-fg')
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="business_name">{isIndividual ? 'Your name' : 'Business name'}</Label>
        <Input id="business_name" placeholder={isIndividual ? 'Jane Smith' : 'Acme LLC'} {...register('business_name')} />
        <FieldError>{errors.business_name?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="tax_id" className={isIndividual ? 'text-fg-muted' : undefined}>
          {isIndividual ? 'Tax ID (optional)' : 'Tax ID'}
        </Label>
        <Input id="tax_id" {...register('tax_id')} />
        <FieldError>{errors.tax_id?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={3} {...register('address')} />
        <FieldError>{errors.address?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="default_currency">Default currency</Label>
        <Select id="default_currency" {...register('default_currency')}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
        <FieldError>{errors.default_currency?.message}</FieldError>
      </div>
      <div className="flex h-5 justify-end">
        <SaveStatus status={status} onRetry={retry} />
      </div>
    </Card>
  )
}
```

Note: `Label` must accept an optional `className`. Verify `src/components/ui/Label.jsx` forwards `className`; if it doesn't, have Impeccable apply the de-emphasis via a wrapping element instead (do not change `Label`'s API unilaterally).

- [ ] **Step 3: Verify the form saves business_type and labels swap**

Run the dev server, open `/profile` (Business tab):
- Toggling **Under my own name** changes the first field label to "Your name" / placeholder "Jane Smith", and Tax ID to "Tax ID (optional)" + dimmed.
- Editing any field shows the SaveStatus cycle to saved; reload → `business_type` persists.

Run lint: `npm run lint` → no new errors in `BusinessTab.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/BusinessTab.jsx
git commit -m "feat(profile): business-type toggle + adaptive labels in BusinessTab (LOO-92)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `OnboardingChecklist` — render helper list + one-time welcome (Impeccable)

**Files:**
- Modify: `src/features/dashboard/OnboardingChecklist.jsx`

**Interfaces:**
- Consumes: `onboardingTasks` (Task 2); `useProfile`; existing `['dashboard','onboarding']` counts query.
- Produces: no call-site change — `DashboardPage` still renders `<OnboardingChecklist />` with no props.

- [ ] **Step 1: Run Impeccable for the welcome state**

Invoke `/impeccable` (polish) for a one-time, dismissible **welcome** banner at the top of the
checklist card on first login — *"Welcome to LoomLance 👋 Start by setting up your business profile."* —
with a small dismiss control. Slate Pro tokens; no blocking modal. Dismissal persists via
`localStorage` key `loomlance.onboardingWelcomeDismissed` (mirror the `TrialBootstrap` dismiss pattern).

- [ ] **Step 2: Implement the rewrite**

Replace `src/features/dashboard/OnboardingChecklist.jsx` with (Impeccable refines the welcome markup;
keep the helper wiring, the render guards, and the dismiss logic):

```jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { useProfile } from '@/hooks/useProfile'
import { onboardingTasks } from '@/lib/onboarding'

const WELCOME_KEY = 'loomlance.onboardingWelcomeDismissed'

async function fetchCounts() {
  const [clients, projects, invoices] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['sent', 'viewed', 'paid']),
  ])
  for (const r of [clients, projects, invoices]) if (r.error) throw mapPostgresError(r.error)
  return {
    clients: clients.count ?? 0,
    projects: projects.count ?? 0,
    invoices: invoices.count ?? 0,
  }
}

export function OnboardingChecklist() {
  const { data: counts } = useQuery({ queryKey: ['dashboard', 'onboarding'], queryFn: fetchCounts, staleTime: 60_000 })
  const { data: profile } = useProfile()
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(WELCOME_KEY) === 'true'
  )

  // Render nothing until both profile + counts have loaded (as before).
  if (!counts || !profile) return null

  const tier = profile.subscription_tier ?? 'free'
  const items = onboardingTasks(tier, counts, profile)
  if (items.every((i) => i.done)) return null

  const dismissWelcome = () => {
    window.localStorage.setItem(WELCOME_KEY, 'true')
    setWelcomeDismissed(true)
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      {!welcomeDismissed ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-fg">
            Welcome to LoomLance 👋 Start by setting up your business profile.
          </p>
          <button
            type="button"
            onClick={dismissWelcome}
            aria-label="Dismiss welcome message"
            className="shrink-0 rounded p-0.5 text-fg-muted hover:bg-primary/10 hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      <h3 className="mb-3 text-sm font-semibold">Get started with LoomLance</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key}>
            <Link to={i.to} className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-primary/10">
              {i.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <Circle className="size-4 shrink-0 text-fg-subtle" />
              )}
              <span className={i.done ? 'text-fg-muted line-through' : ''}>{i.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Note: the counts query no longer fetches `tasks` (the dropped "kanban board" item). The query key
stays `['dashboard','onboarding']`; the shape drops `tasks` — nothing else reads this query.

- [ ] **Step 3: Verify in the running app**

On the dashboard:
- First load → welcome banner shows; the list leads with **Set up your business profile**.
- `free` tier → no "Add your logo" item; `tier_1`/`tier_2` → logo item appears before "Send your first invoice".
- Dismiss the welcome → it stays gone after reload (localStorage).
- Completing all visible items → the whole card disappears.

Run lint: `npm run lint` → no new errors in `OnboardingChecklist.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/OnboardingChecklist.jsx
git commit -m "feat(onboarding): business-first tier-aware checklist + one-time welcome (LOO-92)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verify — lint, tests, build

**Files:** none (verification only).

- [ ] **Step 1: Full unit test run**

Run: `npx vitest run`
Expected: all suites pass, including the new `onboarding.test.js` (5 tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (no new errors).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (per spec "Testing")**

- Business tab: toggle business type → labels/placeholders/emphasis swap; reload persists `business_type`.
- Dashboard: business-first ordering; branding item only on branding tiers; welcome shows once then dismisses.

- [ ] **Step 5: Update Linear LOO-92 → In Review/Done + dual-home note**

Move LOO-92 to the appropriate state and add a comment listing the commits. Update local docs/memory
(progress note) per the dual-home rule.

---

## Self-Review

**Spec coverage:**
- Part 1 business_type column (default 'business') → Task 1 ✅
- BusinessTab toggle + adaptive labels/emphasis, stored field stays `business_name` → Task 3 ✅
- Part 2 `onboardingTasks(tier, counts, profile)` ordered helper, business-first, tier-aware branding omit, payments excluded → Task 2 ✅
- `OnboardingChecklist` renders helper + hide-when-all-done + one-time welcome (localStorage) → Task 4 ✅
- Data flow (BusinessTab reads/writes business_type+business_name; checklist fetches counts + reads profile/tier) → Tasks 3, 4 ✅
- Edge cases (existing accounts unchanged; render nothing until loaded; branding done from logo_url) → Tasks 1, 2, 4 ✅
- Testing (unit for helper; manual) → Tasks 2, 5 ✅

**Placeholder scan:** No TBD/"handle edge cases"/empty-test placeholders — all steps carry real code/commands.

**Type consistency:** Helper returns `{ key, label, to, done }`; Task 4 renders `i.key`/`i.to`/`i.done`/`i.label`. Counts shape `{ clients, projects, invoices }` matches `fetchCounts` (Task 4) and the helper's reads (Task 2). `business_type` enum `'business'|'individual'` consistent across migration (Task 1), schema (Task 3), helper tests (Task 2). Logo field `logo_url` consistent. Feature flag `FEATURES.CUSTOM_BRANDING` consistent.

**Note on deviation from spec wording:** spec said feature flag "BRANDING" and listed `tasks` count; actual flag is `FEATURES.CUSTOM_BRANDING` and the new checklist intentionally drops the kanban/`tasks` item. Captured in Global Constraints + Task 4 note.
