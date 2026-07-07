# Admin Phase 2 — Business Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only `/admin/pulse` landing page showing signups, activity, tier mix, live Stripe MRR + trial funnel, and a product-usage strip — all served by one admin-gated edge function.

**Architecture:** New `admin-metrics` edge function (gate copied from `trigger-blog-publish`) uses a service-role client for DB aggregates (incl. new `admin_user_stats()` SECURITY DEFINER function over `auth.users`) and the existing `STRIPE_SECRET_KEY` for MRR/trials, returning one JSON payload. Frontend is one react-query hook + one page + a shared `AdminTabs` strip.

**Tech Stack:** Deno edge functions (`jsr:@supabase/supabase-js@2`, `npm:stripe@^16` apiVersion `2024-06-20`), Postgres (hosted project `zbipqfsqxnvrzhpdjvvy`), React 18 + TanStack Query v5 + Recharts + sonner, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-07-admin-business-pulse-design.md` · **Linear:** project "Admin Phase 2 — Business Pulse"

## Global Constraints

- Repo: **Dashboard** `C:\Users\mahmo\Desktop\LoomLance-Dashboard` only. Commit after every task. **Do NOT `git push`** — the owner pushes manually.
- Migrations applied to the **hosted dev project** via `mcp__supabase__apply_migration` (no local Docker — house rule); the same SQL is committed to `supabase/migrations/` with a matching name.
- The owner uses the app live: everything here is read-only against the hosted DB; never bulk-modify data.
- Demo user `d3a70000-0000-4000-8000-000000000001` (demo@loomlance.com) is **excluded from ALL metrics** — user counts, signups, tiers, and usage (owner decision 2026-07-07; supersedes the original usage-only scope).
- Money values are integer cents (`money.js` convention). Weeks are ISO (Monday start, UTC) — `date_trunc('week', …)` gives exactly this.
- UI kit via `import { X } from '@/components/ui/X'`; toasts via `import { toast } from 'sonner'`.
- Tests: `npx vitest run` (unit/component — config already includes `supabase/functions/**/*.{test,spec}.{ts,js}`), `npx playwright test` (e2e).
- Edge function gate = the exact `trigger-blog-publish` pattern: anon client + caller JWT → `auth.getUser()` → `profiles.is_admin` → 401/403.
- Vitest runs in jsdom with globals on; component tests follow `src/features/admin/__tests__/AdminGate.test.jsx` conventions.

---

### Task 1: Migration — `admin_user_stats()`

**Files:**
- Create: `supabase/migrations/<timestamp>_admin_user_stats.sql` (timestamp = UTC `YYYYMMDDHHMMSS` at apply time; keep file name identical to the MCP migration name)

**Interfaces:**
- Produces: SQL function `public.admin_user_stats() returns jsonb` — shape `{"total": int, "active7d": int, "active30d": int, "signupsByWeek": [{"weekStart": "YYYY-MM-DD", "count": int}] }` (12 entries, oldest first, zero-filled). Callable by `service_role` ONLY. Task 3's edge function calls it via `service.rpc('admin_user_stats')`.

- [ ] **Step 1: Write the migration file**

```sql
-- admin_user_stats(): aggregate-only stats over auth.users for the admin Business Pulse.
-- SECURITY DEFINER because auth.users is not readable by app roles; execution is locked to
-- service_role (the admin-metrics edge function) so no browser client can ever call it.
-- Returns counts only — no emails, ids, or any per-user rows. Weeks are ISO (Monday, UTC).
create or replace function public.admin_user_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total',     (select count(*) from auth.users),
    'active7d',  (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
    'active30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'signupsByWeek', (
      select coalesce(
        jsonb_agg(jsonb_build_object('weekStart', to_char(w.week_start, 'YYYY-MM-DD'), 'count', coalesce(c.n, 0))
                  order by w.week_start),
        '[]'::jsonb)
      from (
        select generate_series(
          (date_trunc('week', now() at time zone 'utc') - interval '11 weeks')::date,
          date_trunc('week', now() at time zone 'utc')::date,
          interval '1 week'
        )::date as week_start
      ) w
      left join (
        select date_trunc('week', created_at at time zone 'utc')::date as week_start, count(*) as n
        from auth.users
        group by 1
      ) c using (week_start)
    )
  );
$$;

revoke all on function public.admin_user_stats() from public;
revoke all on function public.admin_user_stats() from anon;
revoke all on function public.admin_user_stats() from authenticated;
grant execute on function public.admin_user_stats() to service_role;
```

- [ ] **Step 2: Apply via `mcp__supabase__apply_migration`** (name `admin_user_stats`, query = the SQL above).

- [ ] **Step 3: Verify against the hosted DB** via `mcp__supabase__execute_sql`:

```sql
select public.admin_user_stats();
```
Expected: jsonb with plausible `total` (≈26+), `signupsByWeek` of exactly 12 entries, oldest first.

```sql
set role authenticated;
select public.admin_user_stats();
```
Expected: `permission denied for function admin_user_stats`. (Run `reset role;` after.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_admin_user_stats.sql
git commit -m "feat(db): admin_user_stats() aggregate function, service_role-only"
```

---

### Task 2: Pure Stripe metrics helpers (TDD)

**Files:**
- Create: `supabase/functions/_shared/metrics.ts`
- Test: `supabase/functions/_shared/metrics.test.ts`

**Interfaces:**
- Produces (both pure, no I/O — Task 3 imports them):
  - `monthlyAmountCents(item): number` — one Stripe subscription item → its monthly cents (0 if not computable).
  - `computeStripeMetrics(subs): { mrr: number, currency: string, activeSubs: number, trialing: number, trialsConverted: number, trialsChurned: number }` — array of Stripe subscription objects → the spec's `stripe` payload block.

Definitions (from the spec): MRR = Σ over `active` + `past_due` subs of item price normalized monthly (`year` ÷ 12, × quantity, ÷ `interval_count`). `trialing` = current status. `trialsConverted` = had a trial (`trial_end != null`) AND now `active`/`past_due`. `trialsChurned` = had a trial AND `canceled`/`incomplete_expired` AND `ended_at <= trial_end` (ended without ever converting). A sub that converted and canceled later counts in neither.

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/metrics.test.ts
import { describe, it, expect } from 'vitest'
import { monthlyAmountCents, computeStripeMetrics } from './metrics.ts'

const item = (unit_amount: number, interval: string, quantity = 1, interval_count = 1, currency = 'usd') => ({
  quantity,
  price: { unit_amount, currency, recurring: { interval, interval_count } },
})
const sub = (status: string, items: unknown[], extra: Record<string, unknown> = {}) => ({
  status,
  items: { data: items },
  trial_end: null,
  ended_at: null,
  ...extra,
})

describe('monthlyAmountCents', () => {
  it('passes monthly prices through', () => {
    expect(monthlyAmountCents(item(900, 'month'))).toBe(900)
  })
  it('divides annual by 12 and multiplies quantity', () => {
    expect(monthlyAmountCents(item(12000, 'year', 2))).toBe(2000)
  })
  it('divides by interval_count (e.g. every 3 months)', () => {
    expect(monthlyAmountCents(item(3000, 'month', 1, 3))).toBe(1000)
  })
  it('returns 0 for one-time or malformed items', () => {
    expect(monthlyAmountCents({ price: { unit_amount: 500 } })).toBe(0)
    expect(monthlyAmountCents(undefined)).toBe(0)
  })
})

describe('computeStripeMetrics', () => {
  it('sums MRR over active + past_due only, in integer cents', () => {
    const subs = [
      sub('active', [item(900, 'month')]),
      sub('past_due', [item(12000, 'year')]),
      sub('trialing', [item(900, 'month')]),
      sub('canceled', [item(900, 'month')]),
    ]
    const m = computeStripeMetrics(subs)
    expect(m.mrr).toBe(1900)
    expect(m.activeSubs).toBe(2)
    expect(m.trialing).toBe(1)
    expect(m.currency).toBe('usd')
  })
  it('classifies trials: converted vs churned vs neither', () => {
    const subs = [
      sub('active', [item(900, 'month')], { trial_end: 100 }),                        // converted
      sub('canceled', [item(900, 'month')], { trial_end: 200, ended_at: 150 }),       // churned in trial
      sub('canceled', [item(900, 'month')], { trial_end: 200, ended_at: 999 }),       // converted then canceled → neither
      sub('trialing', [item(900, 'month')], { trial_end: 999 }),                      // still trialing
    ]
    const m = computeStripeMetrics(subs)
    expect(m.trialsConverted).toBe(1)
    expect(m.trialsChurned).toBe(1)
    expect(m.trialing).toBe(1)
  })
  it('handles empty input', () => {
    expect(computeStripeMetrics([])).toEqual({
      mrr: 0, currency: 'usd', activeSubs: 0, trialing: 0, trialsConverted: 0, trialsChurned: 0,
    })
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run supabase/functions/_shared/metrics.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `metrics.ts`**

```typescript
// supabase/functions/_shared/metrics.ts — pure Stripe metric math for admin-metrics.
// No I/O so it is unit-testable from vitest. Definitions pinned by the Business Pulse spec:
// MRR counts active + past_due; trials churn only when they end without ever converting.

type StripeItem = {
  quantity?: number
  price?: { unit_amount?: number | null; currency?: string; recurring?: { interval?: string; interval_count?: number } | null }
}
type StripeSub = {
  status?: string
  items?: { data?: StripeItem[] }
  trial_end?: number | null
  ended_at?: number | null
}

export function monthlyAmountCents(item?: StripeItem): number {
  const price = item?.price
  if (!price?.unit_amount || !price.recurring?.interval) return 0
  const per = (price.unit_amount * (item?.quantity ?? 1)) / (price.recurring.interval_count || 1)
  switch (price.recurring.interval) {
    case 'month': return per
    case 'year': return per / 12
    case 'week': return (per * 52) / 12
    case 'day': return (per * 365) / 12
    default: return 0
  }
}

export function computeStripeMetrics(subs: StripeSub[]) {
  let mrr = 0
  let activeSubs = 0
  let trialing = 0
  let trialsConverted = 0
  let trialsChurned = 0
  let currency = 'usd'
  for (const s of subs) {
    const items = s.items?.data ?? []
    const c = items[0]?.price?.currency
    if (c) currency = c
    const hadTrial = s.trial_end != null
    if (s.status === 'active' || s.status === 'past_due') {
      activeSubs++
      for (const it of items) mrr += monthlyAmountCents(it)
      if (hadTrial) trialsConverted++
    } else if (s.status === 'trialing') {
      trialing++
    } else if (hadTrial && (s.status === 'canceled' || s.status === 'incomplete_expired')) {
      if (s.ended_at != null && s.trial_end != null && s.ended_at <= s.trial_end) trialsChurned++
    }
  }
  return { mrr: Math.round(mrr), currency, activeSubs, trialing, trialsConverted, trialsChurned }
}
```

- [ ] **Step 4: Run tests** — `npx vitest run supabase/functions/_shared/metrics.test.ts` — Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/metrics.ts supabase/functions/_shared/metrics.test.ts
git commit -m "feat(admin): pure Stripe MRR/trial metric helpers with tests"
```

---

### Task 3: Edge function `admin-metrics` + deploy

**Files:**
- Create: `supabase/functions/admin-metrics/index.ts`
- Modify: `supabase/config.toml` (append after `[functions.trigger-blog-publish]` block)

**Interfaces:**
- Consumes: `admin_user_stats()` (Task 1), `computeStripeMetrics` (Task 2), `_shared/cors.ts`.
- Produces: `POST /functions/v1/admin-metrics` → 200 JSON exactly matching the spec contract: `{ generatedAt, users: { total, active7d, active30d, signupsByWeek }, tiers: { free, tier_1, tier_2, trialing, pastDue }, stripe: {...} | null, stripeError?: true, usage: { invoicesCreated|invoicesSent|projectsCreated|hoursTracked|clientsAdded: { d7, d30 } } }`. 401 unauthenticated, 403 non-admin, 500 on DB failure. Task 4's hook calls it via `invokeEdge('admin-metrics')`.

- [ ] **Step 1: Write the function**

```typescript
// admin-metrics — authenticated, admin-only. Returns every Business Pulse number in one
// payload: user/signup aggregates (admin_user_stats RPC), tier mix from profiles, live
// Stripe MRR + trial funnel, and 7d/30d product-usage counts (demo user excluded).
// Stripe failure degrades to { stripe: null, stripeError: true } — DB metrics still render.
// Secrets: STRIPE_SECRET_KEY (already set for checkout/webhooks).
// Deploy: supabase functions deploy admin-metrics
import Stripe from 'npm:stripe@^16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { computeStripeMetrics } from '../_shared/metrics.ts'

const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' })
const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'
const SUB_CAP = 1000

Deno.serve(async (req) => {
  const json = (obj: unknown, status = 200) => jsonBase(obj, status, req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)

    const { data: profile } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return json({ error: 'Admin only' }, 403)

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const now = Date.now()
    const d7 = new Date(now - 7 * 86400_000).toISOString()
    const d30 = new Date(now - 30 * 86400_000).toISOString()

    // Windowed count on a table, excluding the demo user's rows.
    const countSince = async (table: string, col: string, since: string) => {
      const { count, error } = await service
        .from(table).select('id', { count: 'exact', head: true })
        .gte(col, since).neq('user_id', DEMO_USER_ID)
      if (error) throw error
      return count ?? 0
    }
    const window = async (table: string, col: string) => ({
      d7: await countSince(table, col, d7),
      d30: await countSince(table, col, d30),
    })

    const [userStatsRes, profilesRes, invCreated, invSent, projects, clients, timeRes] = await Promise.all([
      service.rpc('admin_user_stats'),
      service.from('profiles').select('subscription_tier, subscription_status'),
      window('invoices', 'created_at'),
      window('invoices', 'sent_at'),
      window('projects', 'created_at'),
      window('clients', 'created_at'),
      service.from('time_entries').select('duration_minutes, started_at').gte('started_at', d30).neq('user_id', DEMO_USER_ID),
    ])
    if (userStatsRes.error) throw userStatsRes.error
    if (profilesRes.error) throw profilesRes.error
    if (timeRes.error) throw timeRes.error

    const tiers = { free: 0, tier_1: 0, tier_2: 0, trialing: 0, pastDue: 0 }
    for (const p of profilesRes.data ?? []) {
      if (p.subscription_tier in tiers) tiers[p.subscription_tier as 'free' | 'tier_1' | 'tier_2']++
      if (p.subscription_status === 'trialing') tiers.trialing++
      if (p.subscription_status === 'past_due') tiers.pastDue++
    }

    const toHours = (rows: { duration_minutes: number | null }[]) =>
      Math.round((rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / 60) * 10) / 10
    const teRows = timeRes.data ?? []
    const hoursTracked = { d7: toHours(teRows.filter((r) => r.started_at >= d7)), d30: toHours(teRows) }

    let stripe = null
    let stripeError = false
    try {
      const subs = []
      for await (const s of stripeClient.subscriptions.list({ status: 'all', limit: 100 })) {
        subs.push(s)
        if (subs.length >= SUB_CAP) { console.warn(`admin-metrics: subscription cap (${SUB_CAP}) hit — MRR may be partial`); break }
      }
      stripe = computeStripeMetrics(subs)
    } catch (e) {
      console.error('admin-metrics: stripe failed', e instanceof Error ? e.message : String(e))
      stripeError = true
    }

    return json({
      generatedAt: new Date(now).toISOString(),
      users: userStatsRes.data,
      tiers,
      stripe,
      ...(stripeError ? { stripeError: true } : {}),
      usage: { invoicesCreated: invCreated, invoicesSent: invSent, projectsCreated: projects, hoursTracked, clientsAdded: clients },
    })
  } catch (e) {
    console.error('admin-metrics:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Failed to load metrics' }, 500)
  }
})
```

Note: `invoices`, `projects`, `clients`, and `time_entries` all carry `user_id`. If any `countSince` errors with a missing-column hint (42703), check the table's owner column and adjust only that call.

- [ ] **Step 2: Register in `supabase/config.toml`** — append below the `[functions.trigger-blog-publish]` block:

```toml
[functions.admin-metrics]
verify_jwt = true
```

- [ ] **Step 3: Deploy** — `mcp__supabase__deploy_edge_function` (name `admin-metrics`, entrypoint `index.ts`, the file above). No new secrets — `STRIPE_SECRET_KEY` is already configured.

- [ ] **Step 4: Verify the gate** — from Bash:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://zbipqfsqxnvrzhpdjvvy.supabase.co/functions/v1/admin-metrics
```
Expected: `401` (gateway rejects: no JWT). Full 200-path verification happens in the component/e2e tasks.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-metrics/index.ts supabase/config.toml
git commit -m "feat(admin): admin-metrics edge function — pulse payload (DB + live Stripe)"
```

---

### Task 4: API + `useAdminMetrics` hook

**Files:**
- Modify: `src/api/admin.js`
- Create: `src/hooks/useAdminMetrics.js`

**Interfaces:**
- Consumes: `invokeEdge` from `src/api/edge.js` (existing).
- Produces: `fetchAdminMetrics(): Promise<payload>`; `useAdminMetrics()` react-query hook — `{ data, isLoading, isError, refetch, dataUpdatedAt }`. Task 6 consumes the hook.

- [ ] **Step 1: Extend `src/api/admin.js`** — append:

```javascript
// Admin-only: one payload with every Business Pulse number (users, tiers, Stripe, usage).
// Server enforces the admin gate; see supabase/functions/admin-metrics.
export async function fetchAdminMetrics() {
  return invokeEdge('admin-metrics')
}
```

and add the import at the top: `import { invokeEdge } from '@/api/edge'`.

- [ ] **Step 2: Create `src/hooks/useAdminMetrics.js`**

```javascript
import { useQuery } from '@tanstack/react-query'
import { fetchAdminMetrics } from '@/api/admin'

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: fetchAdminMetrics,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 3: Verify build** — `npx vitest run` — Expected: all existing tests still pass (no new tests in this task; the hook is exercised via Task 6's component tests).

- [ ] **Step 4: Commit**

```bash
git add src/api/admin.js src/hooks/useAdminMetrics.js
git commit -m "feat(admin): fetchAdminMetrics API + useAdminMetrics hook"
```

---

### Task 5: `AdminTabs` + routing (pulse becomes the admin index)

**Files:**
- Create: `src/features/admin/AdminTabs.jsx`
- Create: `src/pages/admin/AdminPulsePage.jsx` (placeholder this task; real page in Task 6)
- Modify: `src/app/routes.jsx` (admin children block)
- Modify: `src/pages/admin/AdminPostsPage.jsx`, `src/pages/admin/AdminToolsPage.jsx` (render `<AdminTabs />` at the top)
- Test: `src/features/admin/__tests__/AdminTabs.test.jsx`

**Interfaces:**
- Produces: `<AdminTabs />` — renders NavLinks Pulse (`/admin`, `end`), Posts (`/admin/posts`), Tools (`/admin/tools`). `/admin` index now renders `AdminPulsePage` directly (no redirect — keeps the tab's active state simple and the URL short).

- [ ] **Step 1: Write the failing test**

```jsx
// src/features/admin/__tests__/AdminTabs.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminTabs } from '../AdminTabs'

describe('AdminTabs', () => {
  it('renders the three admin section links', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminTabs />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Pulse' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Posts' })).toHaveAttribute('href', '/admin/posts')
    expect(screen.getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/admin/tools')
  })
})
```

- [ ] **Step 2: Run it** — `npx vitest run src/features/admin` — Expected: FAIL (module missing); the 3 AdminGate tests still pass.

- [ ] **Step 3: Implement `AdminTabs.jsx`**

```jsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

const tabs = [
  { to: '/admin', label: 'Pulse', end: true },
  { to: '/admin/posts', label: 'Posts' },
  { to: '/admin/tools', label: 'Tools' },
]

export function AdminTabs() {
  return (
    <nav aria-label="Admin sections" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              '-mb-px rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-b-2 border-primary text-primary'
                : 'text-fg-muted hover:text-fg'
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

(Check the actual `cn` helper path first — `SidebarNav.jsx` imports it; mirror that import. If border tokens differ, mirror the tokens used in `SidebarNav.jsx`.)

- [ ] **Step 4: Placeholder `AdminPulsePage.jsx`** (replaced in Task 6, keeps the route compiling):

```jsx
import { PageHeader } from '@/components/ui/PageHeader'
import { AdminTabs } from '@/features/admin/AdminTabs'

export default function AdminPulsePage() {
  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="Pulse" />
    </div>
  )
}
```

- [ ] **Step 5: Update routes** — in `src/app/routes.jsx`: add `import AdminPulsePage from '@/pages/admin/AdminPulsePage'` and change the admin children to:

```jsx
children: [
  { index: true, element: <AdminPulsePage /> },
  { path: 'posts', element: <AdminPostsPage /> },
  { path: 'posts/new', element: <AdminPostEditorPage /> },
  { path: 'posts/:id', element: <AdminPostEditorPage /> },
  { path: 'tools', element: <AdminToolsPage /> },
],
```

(The `Navigate`/`index` redirect import stays only if still used elsewhere in the file.)

- [ ] **Step 6: Add `<AdminTabs />`** as the first child of the top-level wrapper `div` in `AdminPostsPage.jsx` and `AdminToolsPage.jsx` (import `{ AdminTabs } from '@/features/admin/AdminTabs'`).

- [ ] **Step 7: Run tests + verify manually** — `npx vitest run` (all pass, incl. new AdminTabs test); `npm run dev` → `/admin` shows Pulse placeholder with tabs; Posts/Tools reachable via tabs and highlight correctly.

- [ ] **Step 8: Commit**

```bash
git add src/features/admin/AdminTabs.jsx src/features/admin/__tests__/AdminTabs.test.jsx src/pages/admin/AdminPulsePage.jsx src/app/routes.jsx src/pages/admin/AdminPostsPage.jsx src/pages/admin/AdminToolsPage.jsx
git commit -m "feat(admin): AdminTabs strip + /admin index becomes Pulse"
```

---

### Task 6: Pulse page (tiles, chart, tier bar, usage strip) + component tests

**Files:**
- Create: `src/features/admin/pulse/StatTile.jsx`, `src/features/admin/pulse/SignupsChart.jsx`, `src/features/admin/pulse/TierBar.jsx`
- Modify: `src/pages/admin/AdminPulsePage.jsx` (replace placeholder)
- Test: `src/pages/admin/__tests__/AdminPulsePage.test.jsx`

**Interfaces:**
- Consumes: `useAdminMetrics()` (Task 4), payload contract (Task 3), `formatCurrency(amount, currency)` from `@/lib/currency` (amount in major units → pass `mrr / 100`), kit components, Recharts.
- Produces: the final `/admin/pulse` page.

**Before writing UI code:** invoke the Impeccable skill for the visual pass (house rule) and follow dataviz guidance for the chart. The code below fixes structure and data-wiring; visual polish happens through those skills. Check `PageHeader`, `Card`, `Skeleton`, `EmptyState`, `Badge` prop names against the component files and mirror `AdminPostsPage.jsx` usage exactly.

- [ ] **Step 1: Write the failing component tests**

```jsx
// src/pages/admin/__tests__/AdminPulsePage.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPulsePage from '../AdminPulsePage'
import { useAdminMetrics } from '@/hooks/useAdminMetrics'

vi.mock('@/hooks/useAdminMetrics')
vi.mock('recharts', async (importOriginal) => {
  // jsdom has no layout; ResponsiveContainer renders nothing without dimensions.
  const mod = await importOriginal()
  return { ...mod, ResponsiveContainer: ({ children }) => <div data-testid="chart">{children}</div> }
})

const payload = {
  generatedAt: '2026-07-07T12:00:00Z',
  users: { total: 26, active7d: 9, active30d: 21, signupsByWeek: [{ weekStart: '2026-06-29', count: 3 }] },
  tiers: { free: 23, tier_1: 2, tier_2: 1, trialing: 1, pastDue: 0 },
  stripe: { mrr: 4800, currency: 'usd', activeSubs: 3, trialing: 1, trialsConverted: 2, trialsChurned: 1 },
  usage: {
    invoicesCreated: { d7: 4, d30: 12 }, invoicesSent: { d7: 2, d30: 9 },
    projectsCreated: { d7: 1, d30: 5 }, hoursTracked: { d7: 14.5, d30: 61 }, clientsAdded: { d7: 0, d30: 3 },
  },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminPulsePage />
    </MemoryRouter>
  )
}

describe('AdminPulsePage', () => {
  it('renders user, revenue, and usage numbers', () => {
    useAdminMetrics.mockReturnValue({ data: payload, isLoading: false, isError: false, refetch: vi.fn(), dataUpdatedAt: Date.now() })
    renderPage()
    expect(screen.getByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText('MRR')).toBeInTheDocument()
    expect(screen.getByText('$48.00')).toBeInTheDocument()
    expect(screen.getByText('Invoices created')).toBeInTheDocument()
  })
  it('degrades the revenue row when stripe is null, keeping DB tiles', () => {
    useAdminMetrics.mockReturnValue({
      data: { ...payload, stripe: null, stripeError: true },
      isLoading: false, isError: false, refetch: vi.fn(), dataUpdatedAt: Date.now(),
    })
    renderPage()
    expect(screen.getByText(/Stripe unavailable/)).toBeInTheDocument()
    expect(screen.queryByText('MRR')).not.toBeInTheDocument()
    expect(screen.getByText('Total users')).toBeInTheDocument()
  })
  it('shows an error state with retry on hard failure', () => {
    useAdminMetrics.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn(), dataUpdatedAt: 0 })
    renderPage()
    expect(screen.getByText(/Couldn.t load metrics/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run src/pages/admin` — Expected: FAIL (labels missing from placeholder).

- [ ] **Step 3: Implement the pulse components**

`StatTile.jsx`:
```jsx
import { Card } from '@/components/ui/Card'

export function StatTile({ label, value, sub }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-fg-muted">{sub}</p> : null}
    </Card>
  )
}
```

`SignupsChart.jsx` (mirrors `src/features/dashboard/RevenueChart.jsx` — same tokens, tooltip style, and axis config; dataKey `count`, X `label`, integer ticks `allowDecimals={false}`, aria-label "Bar chart of signups per week."). Data rows: `{ label: 'Jun 29', count: 3 }` — the page maps `weekStart` to a short `MMM D` label.

`TierBar.jsx`:
```jsx
import { Badge } from '@/components/ui/Badge'

const SEGMENTS = [
  { key: 'free', label: 'Free', className: 'bg-bg-muted' },
  { key: 'tier_1', label: 'Tier 1', className: 'bg-primary/40' },
  { key: 'tier_2', label: 'Tier 2', className: 'bg-primary' },
]

export function TierBar({ tiers }) {
  const total = SEGMENTS.reduce((s, seg) => s + (tiers[seg.key] || 0), 0) || 1
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full" role="img"
           aria-label={`Tier mix: ${SEGMENTS.map((s) => `${s.label} ${tiers[s.key] || 0}`).join(', ')}`}>
        {SEGMENTS.map((s) => (
          <div key={s.key} className={s.className} style={{ width: `${((tiers[s.key] || 0) / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="tabular-nums">{s.label} · {tiers[s.key] || 0}</span>
        ))}
        {tiers.pastDue > 0 && <Badge variant="danger">{tiers.pastDue} past due</Badge>}
      </div>
    </div>
  )
}
```
(Verify `Badge`'s variant prop name against the component; mirror `AdminPostsPage.jsx`.)

`AdminPulsePage.jsx` (replaces placeholder):
```jsx
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { StatTile } from '@/features/admin/pulse/StatTile'
import SignupsChart from '@/features/admin/pulse/SignupsChart'
import { TierBar } from '@/features/admin/pulse/TierBar'
import { useAdminMetrics } from '@/hooks/useAdminMetrics'
import { formatCurrency } from '@/lib/currency'

function agoLabel(ts) {
  if (!ts) return ''
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
  return mins === 0 ? 'Updated just now' : `Updated ${mins} min ago`
}

const USAGE = [
  ['invoicesCreated', 'Invoices created'],
  ['invoicesSent', 'Invoices sent'],
  ['projectsCreated', 'Projects created'],
  ['hoursTracked', 'Hours tracked'],
  ['clientsAdded', 'Clients added'],
]

export default function AdminPulsePage() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useAdminMetrics()

  if (isError) {
    return (
      <div className="space-y-5">
        <AdminTabs />
        <PageHeader title="Pulse" />
        <EmptyState
          title="Couldn’t load metrics"
          body="The metrics service didn’t respond. Your data is unaffected."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  const signupsThisWeek = data?.users?.signupsByWeek?.at(-1)?.count ?? 0
  const chartData = (data?.users?.signupsByWeek ?? []).map((w) => ({
    label: new Date(`${w.weekStart}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    count: w.count,
  }))

  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader
        title="Pulse"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-fg-subtle">{agoLabel(dataUpdatedAt)}</span>
            <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total users" value={data.users.total} />
            <StatTile label="Active (7d)" value={data.users.active7d} />
            <StatTile label="Active (30d)" value={data.users.active30d} />
            <StatTile label="Signups this week" value={signupsThisWeek} />
          </div>

          {data.stripe ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="MRR" value={formatCurrency(data.stripe.mrr / 100, data.stripe.currency.toUpperCase())} />
              <StatTile label="Active subscriptions" value={data.stripe.activeSubs} />
              <StatTile label="Trialing now" value={data.stripe.trialing} />
              <StatTile label="Trial conversions" value={data.stripe.trialsConverted} sub={`${data.stripe.trialsChurned} churned`} />
            </div>
          ) : (
            <Card>
              <p className="text-sm font-medium text-fg">Stripe unavailable — showing database metrics only.</p>
              <p className="mt-1 text-sm text-fg-muted">MRR and trial numbers will return on the next successful refresh.</p>
              <Button variant="secondary" className="mt-3" onClick={() => refetch()}>Retry</Button>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold">Signups per week</h3>
            <div className="mt-4">
              <SignupsChart data={chartData} />
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold">Tier breakdown</h3>
            <div className="mt-4">
              <TierBar tiers={data.tiers} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {USAGE.map(([key, label]) => (
              <StatTile key={key} label={label} value={data.usage[key].d7} sub={`${data.usage[key].d30} in 30d`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the component tests** — `npx vitest run src/pages/admin` — Expected: 3 passed. Fix prop mismatches against the real kit components (`PageHeader` `actions`, `EmptyState` `title/body/action`, `Button` `variant/loading`) rather than changing the tests' user-visible assertions.

- [ ] **Step 5: Verify live** — `npm run dev`, sign in as an admin, open `/admin`: tiles show real numbers, chart renders 12 bars, tier bar sums to total users, usage strip excludes demo data. Run the Impeccable pass on the page now (visual polish, spacing, dark mode).

- [ ] **Step 6: Run all tests** — `npx vitest run` — Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/pulse/ src/pages/admin/AdminPulsePage.jsx src/pages/admin/__tests__/AdminPulsePage.test.jsx
git commit -m "feat(admin): Business Pulse page — tiles, signups chart, tier bar, usage strip"
```

---

### Task 7: E2E + full suite

**Files:**
- Create: `tests/e2e/admin-pulse.spec.js`

**Interfaces:**
- Consumes: the same `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` env creds as `tests/e2e/admin-posts.spec.js` (that user must be an admin — already required by the existing admin spec).

- [ ] **Step 1: Write the spec**

```javascript
import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('admin pulse renders live metrics and tabs navigate', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin')
  await expect(page.getByText('Total users')).toBeVisible()
  // The tile value is a live number — assert it is a digit string, not a specific count.
  await expect(page.getByText('Total users').locator('xpath=following-sibling::p[1]')).toHaveText(/^\d+$/)
  await expect(page.getByText('Signups per week')).toBeVisible()

  await page.getByRole('link', { name: 'Posts' }).click()
  await expect(page).toHaveURL('/admin/posts')
})
```

- [ ] **Step 2: Run** — `npx playwright test tests/e2e/admin-pulse.spec.js` — Expected: PASS. If the sibling-xpath assertion is brittle against the real DOM, assert `page.getByText(/^\d+$/).first()` is visible within the tile instead — keep the "a live number rendered" intent.

- [ ] **Step 3: Run everything** — `npx vitest run && npx playwright test` — Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-pulse.spec.js
git commit -m "test(e2e): admin pulse renders live metrics"
```

---

## Self-review notes

- **Spec coverage:** `admin_user_stats()` aggregate + grants (T1), pure Stripe math incl. trial classification (T2), edge function with gate/parallel reads/demo exclusion/Stripe degradation/pagination cap/500 path (T3), API + hook with 5-min staleTime (T4), AdminTabs + pulse-as-index (T5), full page incl. tiles/chart/tier bar/usage strip/skeletons/EmptyState/inline Stripe error (T6), e2e (T7). ISO-Monday-UTC weeks pinned in both T1 SQL and T6 label mapping. Out-of-scope items untouched.
- **Deviation from spec:** `/admin` renders Pulse directly at the index route instead of redirecting to `/admin/pulse` — same landing behavior, simpler active-tab logic; noted in T5.
- **Type consistency:** payload keys used in T6 tests/page match T3's response literal (`users.total`, `tiers.pastDue`, `stripe.trialsConverted`, `usage.invoicesCreated.d7`); `computeStripeMetrics` return keys match T2 implementation and tests; hook return shape (`dataUpdatedAt`, `isFetching`) is standard TanStack v5.
- **Known unknowns for the implementer:** exact `PageHeader`/`EmptyState`/`Badge`/`Skeleton` prop names (T6 Step 4 resolves against the kit), `cn` helper import path (T5 Step 3), owner column on `invoices`/`projects`/`clients`/`time_entries` (T3 Step 1 note), e2e admin creds come from env exactly like the existing admin spec (T7).
