# Admin Phase 3 — User Lookup & Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A searchable admin Users list + per-user detail page with two audited write actions — comp a tier (non-subscribers only) and reversible sign-in ban.

**Architecture:** One new `admin-users` edge function (gate copied from `admin-metrics`) with an action switch (`list/detail/comp/ban/unban`): service-role reads via a new `service_role`-only `admin_user_list()` SQL function, writes via service-role profile updates + GoTrue admin API bans, every write audit-logged to `usage_events`. Frontend: Users tab, two pages, five hooks over the existing `invokeEdge` helper.

**Tech Stack:** Deno edge functions (`jsr:@supabase/supabase-js@2`), Postgres (hosted `zbipqfsqxnvrzhpdjvvy`), React 18 + TanStack Query v5 + sonner, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-07-admin-user-lookup-design.md` · **Linear:** project "Admin Phase 3 — User Lookup & Support"

## Global Constraints

- Repo: `C:\Users\mahmo\Desktop\LoomLance-Dashboard` only. Commit after every task. **Do NOT `git push`.**
- Migrations: applied to the hosted project via `mcp__supabase__apply_migration`; committed file name must equal the version recorded in `supabase_migrations.schema_migrations` (check after applying, rename if needed — this bit us in Phase 2).
- Edge function deploys via `mcp__supabase__deploy_edge_function`; the platform bundle layout is `source/index.ts` + root-level `_shared/*.ts` (match the existing `admin-metrics` v3 deploy; check with `mcp__supabase__get_edge_function` if unsure). This function's bundle needs `_shared/cors.ts`, `_shared/adminUserGuards.ts`, AND `_shared/money.ts`.
- The hosted DB is LIVE PRODUCTION. Reads are unrestricted; the ONLY writes ever executed during implementation/verification are the ones a test explicitly performs through guards (none — verification of write paths is unit/component only; do NOT comp or ban any real user while verifying).
- Demo user id: `d3a70000-0000-4000-8000-000000000001`. INCLUDED in list/detail (badged "Demo"); ban-protected server-side.
- Server-side guards are the security boundary; UI hiding/disabling is cosmetic.
- Money: invoice totals are decimal MAJOR units computed from line items via `_shared/money.ts` `invoiceTotals(lines).total` (NOT cents — do not divide by 100). Format client-side with `formatCurrency(amount, currency)` from `@/lib/currency`.
- UI kit via `import { X } from '@/components/ui/X'`; `cn` from `@/components/ui/cn`; toasts via `sonner`; relative dates via `relativeTime` from `@/lib/date`, absolute via `formatDate`.
- Every UI task runs the Impeccable skill pass before commit (owner directive).
- Tests: `npx vitest run` (unit/component), `npx playwright test` (e2e; `tests/e2e/happy-path.spec.js` is known-failing — pre-existing LOO-95, ignore it; the other three specs must pass).
- Gate pattern (copy from `supabase/functions/admin-metrics/index.ts`): anon client + caller JWT → `auth.getUser()` → 401 → `profiles.is_admin` → 403.

---

### Task 1: Migration — `admin_user_list()`

**Files:**
- Create: `supabase/migrations/<applied-version>_admin_user_list.sql`

**Interfaces:**
- Produces: `public.admin_user_list() returns setof record` — one row per user, columns exactly: `id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz, subscription_tier text, subscription_status text, current_period_end timestamptz, is_admin boolean, has_stripe_subscription boolean`. Ordered `created_at desc`. `service_role`-only. Task 3 calls it via `service.rpc('admin_user_list')`.

- [x] **Step 1: Write the migration**

```sql
-- admin_user_list(): per-user support roster for the admin Users page (Phase 3).
-- SECURITY DEFINER because auth.users is not readable by app roles; EXECUTE locked to
-- service_role (called only by the admin-users edge function behind the admin gate).
-- Returns account/subscription state only — no password hashes, tokens, or auth internals.
-- Unlike admin_user_stats(), the demo user IS included (support tooling sees every account).
create or replace function public.admin_user_list()
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  subscription_tier text,
  subscription_status text,
  current_period_end timestamptz,
  is_admin boolean,
  has_stripe_subscription boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    p.display_name,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    p.subscription_tier::text,
    p.subscription_status::text,
    p.current_period_end,
    p.is_admin,
    (p.stripe_subscription_id is not null) as has_stripe_subscription
  from auth.users u
  join public.profiles p on p.id = u.id
  order by u.created_at desc;
$$;

revoke all on function public.admin_user_list() from public;
revoke all on function public.admin_user_list() from anon;
revoke all on function public.admin_user_list() from authenticated;
grant execute on function public.admin_user_list() to service_role;
```

- [x] **Step 2: Apply via `mcp__supabase__apply_migration`** (name `admin_user_list`).

- [x] **Step 3: Fetch the recorded version and name the committed file to match**

```sql
select version from supabase_migrations.schema_migrations where name = 'admin_user_list';
```
Save the SQL to `supabase/migrations/<version>_admin_user_list.sql`.

- [x] **Step 4: Verify** via `mcp__supabase__execute_sql`:

```sql
select count(*), count(*) filter (where is_admin) as admins,
       count(*) filter (where has_stripe_subscription) as subs
from public.admin_user_list();
```
Expected: count ≈ 26 (demo INCLUDED), admins ≥ 2.

```sql
set role authenticated; select * from public.admin_user_list(); -- expect: permission denied
reset role;
```

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/*_admin_user_list.sql
git commit -m "feat(db): admin_user_list() support roster function, service_role-only"
```

---

### Task 2: Pure guard helpers (TDD)

**Files:**
- Create: `supabase/functions/_shared/adminUserGuards.ts`
- Test: `supabase/functions/_shared/adminUserGuards.test.ts`

**Interfaces:**
- Produces (pure, no I/O; Task 3 imports all three):
  - `VALID_TIERS: readonly ['free', 'tier_1', 'tier_2']`
  - `DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'`
  - `compGuard(target, tier): GuardResult` — `target` is the fetched profile row (`{ id, stripe_subscription_id }`) or `null`
  - `banGuard(actorId, target): GuardResult` — `target` is `{ id, is_admin }` or `null`
  - `GuardResult = { ok: true } | { ok: false, status: 400|404|409, message: string }`

- [x] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/adminUserGuards.test.ts
import { describe, it, expect } from 'vitest'
import { compGuard, banGuard, VALID_TIERS, DEMO_USER_ID } from './adminUserGuards.ts'

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'

describe('compGuard', () => {
  it('404s a missing user', () => {
    expect(compGuard(null, 'tier_1')).toEqual({ ok: false, status: 404, message: 'User not found' })
  })
  it('400s an invalid tier', () => {
    const r = compGuard({ id: OTHER, stripe_subscription_id: null }, 'gold')
    expect(r).toEqual({ ok: false, status: 400, message: 'Invalid tier' })
  })
  it('409s a user with a live Stripe subscription', () => {
    const r = compGuard({ id: OTHER, stripe_subscription_id: 'sub_123' }, 'tier_2')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(409)
      expect(r.message).toMatch(/Stripe/)
    }
  })
  it('passes a non-subscriber with a valid tier', () => {
    for (const tier of VALID_TIERS) {
      expect(compGuard({ id: OTHER, stripe_subscription_id: null }, tier)).toEqual({ ok: true })
    }
  })
})

describe('banGuard', () => {
  it('404s a missing user', () => {
    expect(banGuard(ME, null)).toEqual({ ok: false, status: 404, message: 'User not found' })
  })
  it('409s banning yourself', () => {
    const r = banGuard(ME, { id: ME, is_admin: true })
    expect(r).toEqual({ ok: false, status: 409, message: 'You cannot ban your own account' })
  })
  it('409s banning the demo user', () => {
    const r = banGuard(ME, { id: DEMO_USER_ID, is_admin: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/demo/i)
  })
  it('409s banning another admin', () => {
    const r = banGuard(ME, { id: OTHER, is_admin: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/admin/i)
  })
  it('passes a normal target', () => {
    expect(banGuard(ME, { id: OTHER, is_admin: false })).toEqual({ ok: true })
  })
})
```

- [x] **Step 2: Run** — `npx vitest run supabase/functions/_shared/adminUserGuards.test.ts` — Expected: FAIL (module not found).

- [x] **Step 3: Implement**

```typescript
// supabase/functions/_shared/adminUserGuards.ts — pure guard logic for admin-users writes.
// No I/O so every rejection branch is unit-testable. The edge function is the only caller;
// these guards are the security boundary (UI disabling is cosmetic).

export const VALID_TIERS = ['free', 'tier_1', 'tier_2'] as const
export const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'

export type GuardResult = { ok: true } | { ok: false; status: 400 | 404 | 409; message: string }

export function compGuard(
  target: { id: string; stripe_subscription_id: string | null } | null,
  tier: string,
): GuardResult {
  if (!target) return { ok: false, status: 404, message: 'User not found' }
  if (!(VALID_TIERS as readonly string[]).includes(tier)) return { ok: false, status: 400, message: 'Invalid tier' }
  if (target.stripe_subscription_id) {
    return { ok: false, status: 409, message: 'This user has a live Stripe subscription — manage it in Stripe' }
  }
  return { ok: true }
}

export function banGuard(
  actorId: string,
  target: { id: string; is_admin: boolean } | null,
): GuardResult {
  if (!target) return { ok: false, status: 404, message: 'User not found' }
  if (target.id === actorId) return { ok: false, status: 409, message: 'You cannot ban your own account' }
  if (target.id === DEMO_USER_ID) return { ok: false, status: 409, message: 'The demo account cannot be banned' }
  if (target.is_admin) return { ok: false, status: 409, message: 'Admins cannot be banned from here' }
  return { ok: true }
}
```

- [x] **Step 4: Run tests** — Expected: 9 passed.

- [x] **Step 5: Commit**

```bash
git add supabase/functions/_shared/adminUserGuards.ts supabase/functions/_shared/adminUserGuards.test.ts
git commit -m "feat(admin): pure comp/ban guard helpers with tests"
```

---

### Task 3: Edge function `admin-users` + deploy

**Files:**
- Create: `supabase/functions/admin-users/index.ts`
- Modify: `supabase/config.toml` (append after `[functions.admin-metrics]`)

**Interfaces:**
- Consumes: `admin_user_list()` (Task 1), guards (Task 2), `_shared/cors.ts`, `_shared/money.ts` `invoiceTotals`.
- Produces: `POST /functions/v1/admin-users` with `{ action, userId?, tier? }`:
  - `list` → `{ users: [...admin_user_list rows] }`
  - `detail` → `{ user: <row>, counts: { clients, projects, invoices, hoursTracked, invoiced: [{ currency, total }] }, history: [{ id, created_at, payload }] }`
  - `comp`/`ban`/`unban` → `{ ok: true }` or guard error
  - Errors: 400 unknown action/invalid tier · 401/403 gate · 404 unknown user · 409 guards · 500 generic.

- [x] **Step 1: Write the function**

```typescript
// admin-users — authenticated, admin-only. Support surface for the admin Users pages:
// list (roster via admin_user_list RPC), detail (per-user counts + audit history), and
// audited writes: comp (non-subscribers only) and reversible GoTrue bans.
// Guards live in _shared/adminUserGuards.ts (pure, unit-tested) — they are the boundary.
// Deploy: supabase functions deploy admin-users
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'
import { compGuard, banGuard, DEMO_USER_ID } from '../_shared/adminUserGuards.ts'
import { invoiceTotals } from '../_shared/money.ts'

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

    const { data: me } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return json({ error: 'Admin only' }, 403)

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const action = body?.action
    const userId = typeof body?.userId === 'string' ? body.userId : null

    // Audit trail: one row per successful write. Failure to audit never fails the action —
    // the action already happened; prefer an audit gap over a false error to the admin.
    const audit = async (targetId: string, payload: Record<string, unknown>) => {
      const { error } = await service.from('usage_events').insert({
        user_id: targetId,
        kind: 'admin_action',
        payload: { ...payload, actor_id: user.id, actor_email: user.email, at: new Date().toISOString() },
      })
      if (error) console.error('admin-users: audit insert failed', error.message)
    }

    if (action === 'list') {
      const { data, error } = await service.rpc('admin_user_list')
      if (error) throw error
      return json({ users: data })
    }

    if (action === 'detail') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { data: rows, error: listErr } = await service.rpc('admin_user_list')
      if (listErr) throw listErr
      const row = (rows ?? []).find((r: { id: string }) => r.id === userId)
      if (!row) return json({ error: 'User not found' }, 404)

      const count = async (table: string) => {
        const { count: n, error } = await service.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
        if (error) throw error
        return n ?? 0
      }
      const [clients, projects, invoicesRes, timeRes, historyRes] = await Promise.all([
        count('clients'),
        count('projects'),
        service.from('invoices').select('currency, invoice_line_items(quantity, unit_price, tax_rate, discount_rate)').eq('user_id', userId),
        service.from('time_entries').select('duration_minutes').eq('user_id', userId),
        service.from('usage_events').select('id, created_at, payload').eq('user_id', userId).eq('kind', 'admin_action')
          .order('created_at', { ascending: false }).limit(20),
      ])
      if (invoicesRes.error) throw invoicesRes.error
      if (timeRes.error) throw timeRes.error
      if (historyRes.error) throw historyRes.error

      const byCurrency: Record<string, number> = {}
      for (const inv of invoicesRes.data ?? []) {
        const cur = (inv.currency || 'USD').toUpperCase()
        byCurrency[cur] = Math.round(((byCurrency[cur] ?? 0) + invoiceTotals(inv.invoice_line_items ?? []).total) * 100) / 100
      }
      const hoursTracked = Math.round(((timeRes.data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / 60) * 10) / 10

      return json({
        user: row,
        counts: {
          clients,
          projects,
          invoices: (invoicesRes.data ?? []).length,
          hoursTracked,
          invoiced: Object.entries(byCurrency).map(([currency, total]) => ({ currency, total })),
        },
        history: historyRes.data ?? [],
      })
    }

    if (action === 'comp') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { data: target } = await service.from('profiles')
        .select('id, subscription_tier, stripe_subscription_id').eq('id', userId).maybeSingle()
      const guard = compGuard(target, body?.tier)
      if (!guard.ok) return json({ error: guard.message }, guard.status)
      const from = target!.subscription_tier
      const { error } = await service.from('profiles')
        .update({ subscription_tier: body.tier, subscription_status: 'active' }).eq('id', userId)
      if (error) throw error
      await audit(userId, { action: 'comp', from, to: body.tier })
      return json({ ok: true })
    }

    if (action === 'ban' || action === 'unban') {
      if (!userId) return json({ error: 'userId required' }, 400)
      const { data: target } = await service.from('profiles').select('id, is_admin').eq('id', userId).maybeSingle()
      if (action === 'ban') {
        const guard = banGuard(user.id, target)
        if (!guard.ok) return json({ error: guard.message }, guard.status)
      } else if (!target) {
        return json({ error: 'User not found' }, 404)
      }
      const { error } = await service.auth.admin.updateUserById(userId, {
        ban_duration: action === 'ban' ? '87600h' : 'none',
      })
      if (error) throw error
      await audit(userId, { action, from: action === 'ban' ? 'active' : 'banned', to: action === 'ban' ? 'banned' : 'active' })
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('admin-users:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Request failed' }, 500)
  }
})
```

Note: `DEMO_USER_ID` is imported for clarity of the bundle graph even though only `banGuard` uses it internally — if your linter flags the unused import, drop it from the import list.

- [x] **Step 2: Register in `supabase/config.toml`** — append below `[functions.admin-metrics]`:

```toml
[functions.admin-users]
verify_jwt = true
```

- [x] **Step 3: Deploy** via `mcp__supabase__deploy_edge_function` — name `admin-users`, entrypoint `index.ts`, bundle: `admin-users/index.ts` as `source/index.ts` + root-level `_shared/cors.ts`, `_shared/adminUserGuards.ts`, `_shared/money.ts` (match the admin-metrics v3 layout).

- [x] **Step 4: Verify the gate**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://zbipqfsqxnvrzhpdjvvy.supabase.co/functions/v1/admin-users
```
Expected: `401`. Do NOT exercise write actions against the live function.

- [x] **Step 5: Confirm guard tests still pass** — `npx vitest run supabase/functions/_shared/adminUserGuards.test.ts` — 9 passed.

- [x] **Step 6: Commit**

```bash
git add supabase/functions/admin-users/index.ts supabase/config.toml
git commit -m "feat(admin): admin-users edge function — roster, detail, audited comp/ban"
```

---

### Task 4: API + hooks

**Files:**
- Modify: `src/api/admin.js`
- Create: `src/hooks/useAdminUsers.js`

**Interfaces:**
- Consumes: `invokeEdge` (existing import already present in `admin.js` since Phase 2).
- Produces: `adminUsersAction(body)` API fn; hooks `useAdminUsers()`, `useAdminUserDetail(id)`, `useCompTier()`, `useBanUser()`, `useUnbanUser()`. Mutations take `{ userId, tier? }`, invalidate `['admin','users']` and `['admin','users', userId]`, and surface server errors via the thrown `AppError` (toasting happens in the page).

- [x] **Step 1: Extend `src/api/admin.js`** — append:

```javascript
// Admin-only: user lookup & support actions (list/detail/comp/ban/unban).
// Server enforces all guards; see supabase/functions/admin-users.
export async function adminUsersAction(body) {
  return invokeEdge('admin-users', body)
}
```

- [x] **Step 2: Create `src/hooks/useAdminUsers.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsersAction } from '@/api/admin'

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminUsersAction({ action: 'list' }).then((r) => r.users),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminUserDetail(id) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => adminUsersAction({ action: 'detail', userId: id }),
    enabled: !!id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

function useUserAction(action) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, tier }) => adminUsersAction({ action, userId, tier }),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId] })
    },
  })
}

export function useCompTier() {
  return useUserAction('comp')
}
export function useBanUser() {
  return useUserAction('ban')
}
export function useUnbanUser() {
  return useUserAction('unban')
}
```

(Note: `['admin', 'users']` invalidation already covers the detail key by prefix; the explicit second invalidate is harmless and self-documenting — keep it.)

- [x] **Step 3: Verify** — `npx vitest run` — all existing tests pass (hooks are exercised by Task 5/6 component tests).

- [x] **Step 4: Commit**

```bash
git add src/api/admin.js src/hooks/useAdminUsers.js
git commit -m "feat(admin): adminUsersAction API + user lookup hooks"
```

---

### Task 5: Users tab + routes + `AdminUsersPage` (TDD + Impeccable)

**Files:**
- Modify: `src/features/admin/AdminTabs.jsx` (add Users), `src/app/routes.jsx`
- Create: `src/pages/admin/AdminUsersPage.jsx`
- Test: `src/pages/admin/__tests__/AdminUsersPage.test.jsx`; also update `src/features/admin/__tests__/AdminTabs.test.jsx`

**Interfaces:**
- Consumes: `useAdminUsers()` (Task 4), kit `Table/THead/TR/TH/TD`, `Badge`, `Input`, `Skeleton`, `EmptyState`, `relativeTime` from `@/lib/date`.
- Produces: `/admin/users` list page; rows link to `/admin/users/:id` (page created in Task 6 — register both routes NOW with Task 6's page as a placeholder file, see Step 5).

- [x] **Step 1: Update the AdminTabs test** — in `AdminTabs.test.jsx`, extend the existing assertions:

```jsx
expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users')
```

- [x] **Step 2: Write the failing page test**

```jsx
// src/pages/admin/__tests__/AdminUsersPage.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminUsersPage from '../AdminUsersPage'
import { useAdminUsers } from '@/hooks/useAdminUsers'

vi.mock('@/hooks/useAdminUsers')

const users = [
  { id: 'u1', email: 'alice@example.com', display_name: 'Alice', created_at: '2026-07-01T00:00:00Z',
    last_sign_in_at: '2026-07-06T00:00:00Z', banned_until: null, subscription_tier: 'tier_2',
    subscription_status: 'active', current_period_end: null, is_admin: false, has_stripe_subscription: true },
  { id: 'u2', email: 'bob@example.com', display_name: 'Bob', created_at: '2026-06-01T00:00:00Z',
    last_sign_in_at: null, banned_until: '2099-01-01T00:00:00Z', subscription_tier: 'free',
    subscription_status: 'active', current_period_end: null, is_admin: false, has_stripe_subscription: false },
  { id: 'd3a70000-0000-4000-8000-000000000001', email: 'demo@loomlance.com', display_name: 'LoomLance User',
    created_at: '2026-02-27T00:00:00Z', last_sign_in_at: '2026-06-30T00:00:00Z', banned_until: null,
    subscription_tier: 'tier_2', subscription_status: 'active', current_period_end: null,
    is_admin: false, has_stripe_subscription: false },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AdminUsersPage />
    </MemoryRouter>
  )
}

describe('AdminUsersPage', () => {
  it('renders rows with badges and detail links', () => {
    useAdminUsers.mockReturnValue({ data: users, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('link', { name: 'alice@example.com' })).toHaveAttribute('href', '/admin/users/u1')
    expect(screen.getByText('Banned')).toBeInTheDocument()   // bob
    expect(screen.getByText('Demo')).toBeInTheDocument()      // demo user
  })
  it('search filters by email or name', async () => {
    useAdminUsers.mockReturnValue({ data: users, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'alice')
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument()
  })
  it('shows an error state with retry on failure', () => {
    useAdminUsers.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText(/Couldn.t load users/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
```

- [x] **Step 3: Run** — `npx vitest run src/pages/admin src/features/admin` — Expected: new tests FAIL, existing pass.

- [x] **Step 4: Implement**

`AdminTabs.jsx` — insert into the `tabs` array between Posts and Tools:
```jsx
  { to: '/admin/users', label: 'Users' },
```

`AdminUsersPage.jsx`:
```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import { relativeTime } from '@/lib/date'

const TIER_LABEL = { free: 'Free', tier_1: 'Tier 1', tier_2: 'Tier 2' }

export function isBanned(u) {
  return !!u.banned_until && new Date(u.banned_until) > new Date()
}

export default function AdminUsersPage() {
  const { data: users, isLoading, isError, refetch } = useAdminUsers()
  const [q, setQ] = useState('')

  const filtered = (users ?? []).filter((u) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return u.email.toLowerCase().includes(needle) || (u.display_name ?? '').toLowerCase().includes(needle)
  })

  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="Users" />
      <Input
        placeholder="Search by email or name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
        aria-label="Search users"
      />
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : isError ? (
        <EmptyState
          title="Couldn’t load users"
          description="The user service didn’t respond. Your data is unaffected."
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No users match" description={`Nothing found for “${q}”.`} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Name</TH>
              <TH>Tier</TH>
              <TH>Status</TH>
              <TH>Last sign-in</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Link to={`/admin/users/${u.id}`} className="font-medium text-fg hover:text-primary">
                    {u.email}
                  </Link>
                </TD>
                <TD className="text-fg-muted">{u.display_name || '—'}</TD>
                <TD><Badge>{TIER_LABEL[u.subscription_tier] ?? u.subscription_tier}</Badge></TD>
                <TD className="text-fg-muted">{u.subscription_status}</TD>
                <TD className="text-fg-muted">{u.last_sign_in_at ? relativeTime(u.last_sign_in_at) : 'never'}</TD>
                <TD>
                  <span className="flex gap-1.5">
                    {isBanned(u) && <Badge variant="danger">Banned</Badge>}
                    {u.is_admin && <Badge variant="primary">Admin</Badge>}
                    {u.id === 'd3a70000-0000-4000-8000-000000000001' && <Badge>Demo</Badge>}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
```
(Reconcile `Badge` variants, `Input` props, and the `Table` body pattern against `AdminPostsPage.jsx` — mirror it exactly; do not change tested texts/roles.)

- [x] **Step 5: Routes** — in `src/app/routes.jsx`, inside the admin children, after the `posts/:id` entry:

```jsx
  { path: 'users', element: <AdminUsersPage /> },
  { path: 'users/:id', element: <AdminUserDetailPage /> },
```
Add both imports. Create `src/pages/admin/AdminUserDetailPage.jsx` as a compiling placeholder (Task 6 replaces it):

```jsx
import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'

export default function AdminUserDetailPage() {
  return (
    <div className="space-y-5">
      <AdminTabs />
      <PageHeader title="User" />
    </div>
  )
}
```

- [x] **Step 6: Run tests** — `npx vitest run` — all green. Run the **Impeccable pass** on the list page.

- [x] **Step 7: Commit**

```bash
git add src/features/admin/AdminTabs.jsx src/features/admin/__tests__/AdminTabs.test.jsx src/pages/admin/AdminUsersPage.jsx src/pages/admin/AdminUserDetailPage.jsx src/pages/admin/__tests__/AdminUsersPage.test.jsx src/app/routes.jsx
git commit -m "feat(admin): Users tab + searchable roster page"
```

---

### Task 6: `AdminUserDetailPage` (TDD + Impeccable)

**Files:**
- Modify: `src/pages/admin/AdminUserDetailPage.jsx` (replace placeholder)
- Test: `src/pages/admin/__tests__/AdminUserDetailPage.test.jsx`

**Interfaces:**
- Consumes: `useAdminUserDetail(id)`, `useCompTier/useBanUser/useUnbanUser` (Task 4), `useProfile` from `@/hooks/useProfile` (for "is this me" — same hook AdminGate uses), `StatTile` from `@/features/admin/pulse/StatTile`, `ConfirmDialog`, `formatCurrency`, `formatDate`/`relativeTime`, `isBanned` exported from `AdminUsersPage`.

- [x] **Step 1: Write the failing tests**

```jsx
// src/pages/admin/__tests__/AdminUserDetailPage.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUserDetailPage from '../AdminUserDetailPage'
import { useAdminUserDetail, useCompTier, useBanUser, useUnbanUser } from '@/hooks/useAdminUsers'
import { useProfile } from '@/hooks/useProfile'

vi.mock('@/hooks/useAdminUsers')
vi.mock('@/hooks/useProfile')

const ME = 'me-0000'
const baseUser = {
  id: 'u1', email: 'alice@example.com', display_name: 'Alice', created_at: '2026-07-01T00:00:00Z',
  last_sign_in_at: '2026-07-06T00:00:00Z', banned_until: null, subscription_tier: 'free',
  subscription_status: 'active', current_period_end: null, is_admin: false, has_stripe_subscription: false,
}
const baseDetail = {
  user: baseUser,
  counts: { clients: 2, projects: 3, invoices: 4, hoursTracked: 12.5, invoiced: [{ currency: 'USD', total: 1234.5 }] },
  history: [{ id: 'e1', created_at: '2026-07-07T00:00:00Z', payload: { action: 'comp', from: 'free', to: 'tier_1', actor_email: 'admin@loomlance.com' } }],
}
const idle = { mutate: vi.fn(), isPending: false }

function renderPage(id = 'u1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useProfile.mockReturnValue({ data: { id: ME, is_admin: true } })
  useCompTier.mockReturnValue(idle)
  useBanUser.mockReturnValue(idle)
  useUnbanUser.mockReturnValue(idle)
})

describe('AdminUserDetailPage', () => {
  it('renders identity, counts, and history', () => {
    useAdminUserDetail.mockReturnValue({ data: baseDetail, isLoading: false, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('$1,234.50')).toBeInTheDocument()
    expect(screen.getByText(/Comped/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ban/i })).toBeInTheDocument()
  })
  it('disables comp for a user with a live Stripe subscription', () => {
    useAdminUserDetail.mockReturnValue({
      data: { ...baseDetail, user: { ...baseUser, has_stripe_subscription: true } },
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByText(/manage it in Stripe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled()
  })
  it('hides the ban control for self, demo, and admins', () => {
    for (const user of [
      { ...baseUser, id: ME },
      { ...baseUser, id: 'd3a70000-0000-4000-8000-000000000001' },
      { ...baseUser, is_admin: true },
    ]) {
      useAdminUserDetail.mockReturnValue({ data: { ...baseDetail, user }, isLoading: false, isError: false, refetch: vi.fn() })
      const { unmount } = renderPage(user.id)
      expect(screen.queryByRole('button', { name: /^ban/i })).not.toBeInTheDocument()
      unmount()
    }
  })
  it('shows Unban for a banned user', () => {
    useAdminUserDetail.mockReturnValue({
      data: { ...baseDetail, user: { ...baseUser, banned_until: '2099-01-01T00:00:00Z' } },
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('button', { name: /unban/i })).toBeInTheDocument()
  })
})
```

- [x] **Step 2: Run** — `npx vitest run src/pages/admin` — Expected: new tests FAIL against the placeholder.

- [x] **Step 3: Implement the page**

Structure (four cards under `AdminTabs` + `PageHeader` with the user's email as title; loading = Skeletons; error = EmptyState with retry; toasts on mutation success/error using the thrown error's `userMessage || message`):

```jsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatTile } from '@/features/admin/pulse/StatTile'
import { useAdminUserDetail, useCompTier, useBanUser, useUnbanUser } from '@/hooks/useAdminUsers'
import { useProfile } from '@/hooks/useProfile'
import { formatCurrency } from '@/lib/currency'
import { formatDate, relativeTime } from '@/lib/date'
import { isBanned } from './AdminUsersPage'

const DEMO_USER_ID = 'd3a70000-0000-4000-8000-000000000001'
const TIERS = ['free', 'tier_1', 'tier_2']
const TIER_LABEL = { free: 'Free', tier_1: 'Tier 1', tier_2: 'Tier 2' }

function historyLine(evt) {
  const p = evt.payload ?? {}
  if (p.action === 'comp') return `Comped ${TIER_LABEL[p.from] ?? p.from} → ${TIER_LABEL[p.to] ?? p.to} by ${p.actor_email}`
  if (p.action === 'ban') return `Banned by ${p.actor_email}`
  if (p.action === 'unban') return `Unbanned by ${p.actor_email}`
  return `${p.action} by ${p.actor_email}`
}

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const { data, isLoading, isError, refetch } = useAdminUserDetail(id)
  const { data: myProfile } = useProfile()
  const comp = useCompTier()
  const ban = useBanUser()
  const unban = useUnbanUser()
  const [tier, setTier] = useState('')
  const [confirmingBan, setConfirmingBan] = useState(false)

  // …loading / error early returns (Skeleton stack; EmptyState "Couldn’t load user" + Try again)…

  const u = data.user
  const banned = isBanned(u)
  const canBan = !banned && u.id !== myProfile?.id && u.id !== DEMO_USER_ID && !u.is_admin

  const onComp = () =>
    comp.mutate({ userId: u.id, tier }, {
      onSuccess: () => toast.success(`Comped to ${TIER_LABEL[tier]}`),
      onError: (e) => toast.error(e.userMessage || e.message),
    })
  const onBan = () =>
    ban.mutate({ userId: u.id }, {
      onSuccess: () => { toast.success('User banned'); setConfirmingBan(false) },
      onError: (e) => { toast.error(e.userMessage || e.message); setConfirmingBan(false) },
    })
  const onUnban = () =>
    unban.mutate({ userId: u.id }, {
      onSuccess: () => toast.success('User unbanned'),
      onError: (e) => toast.error(e.userMessage || e.message),
    })

  // Render: PageHeader title = u.email with state badges (Banned/Admin/Demo);
  // Card 1 Identity: display name, business_name/business_type omitted if absent from row — show
  //   created (formatDate), last sign-in (relativeTime or 'never'), copyable id (small mono + copy button);
  // Card 2 Subscription: tier badge, status, current_period_end (formatDate or '—'),
  //   "Stripe subscription: yes/no";
  // Card 3 Usage: grid of StatTile — Clients, Projects, Invoices (sub = invoiced totals
  //   .map(i => formatCurrency(i.total, i.currency)).join(' · ')), Hours tracked;
  // Card 4 Actions: comp select (TIERS options, value=tier) + Apply button
  //   (disabled when !tier || comp.isPending || u.has_stripe_subscription; when
  //   has_stripe_subscription show the note "This user has a live Stripe subscription — manage it in Stripe");
  //   Ban (danger, only when canBan) opening ConfirmDialog
  //   (title "Ban this user?", body "Blocks sign-in. Their data and public invoice links stay
  //   live. Reversible.", confirm = onBan); Unban button when banned;
  //   Admin history list from data.history via historyLine(), '—' when empty.
}
```

Write the full JSX (the comments above are required content, not optional). Reconcile kit props against real components; keep tested texts/roles exactly as in Step 1.

- [x] **Step 4: Run** — `npx vitest run src/pages/admin` — Expected: all pass (fix kit-prop mismatches, not test assertions).

- [x] **Step 5: Full suite + build** — `npx vitest run` all green; `npx vite build` succeeds. Run the **Impeccable pass** on the detail page.

- [x] **Step 6: Commit**

```bash
git add src/pages/admin/AdminUserDetailPage.jsx src/pages/admin/__tests__/AdminUserDetailPage.test.jsx
git commit -m "feat(admin): user detail page — identity, subscription, usage, audited actions"
```

---

### Task 7: E2E (read-only) + full suite

**Files:**
- Create: `tests/e2e/admin-users.spec.js`

**Interfaces:**
- Consumes: same `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` env creds as the other admin specs (must be an admin).

- [x] **Step 1: Write the spec** — READ-ONLY: no comp, no ban, no clicks on action buttons.

```javascript
import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('admin can search the roster and open a user detail (read-only)', async ({ page }) => {
  await page.goto('/login')
  await page.locator('#email').fill(EMAIL)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/admin/users')
  await expect(page.getByLabel('Search users')).toBeVisible()
  await page.getByLabel('Search users').fill('demo@loomlance.com')
  const demoLink = page.getByRole('link', { name: 'demo@loomlance.com' })
  await expect(demoLink).toBeVisible()

  await demoLink.click()
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]+/)
  await expect(page.getByText('demo@loomlance.com').first()).toBeVisible()
  await expect(page.getByText('Clients')).toBeVisible()
  // Demo user must NOT offer a ban control (server-guarded, UI-hidden)
  await expect(page.getByRole('button', { name: /^ban/i })).toHaveCount(0)
})
```

- [x] **Step 2: Run** — `npx playwright test tests/e2e/admin-users.spec.js` with the env creds — Expected: PASS. Adjust selectors against the real DOM if needed, keeping intent (search → detail → counts render → no ban control on demo).

- [x] **Step 3: Run everything** — `npx vitest run` and `npx playwright test`. Expected: vitest all green; e2e — admin-users, admin-pulse, admin-posts PASS (`happy-path` known-failing per LOO-95, ignore).

- [x] **Step 4: Commit**

```bash
git add tests/e2e/admin-users.spec.js
git commit -m "test(e2e): admin users roster + detail (read-only)"
```

---

## Self-review notes

- **Spec coverage:** `admin_user_list()` + ACL (T1), pure guards incl. every rejection branch (T2), edge fn actions list/detail/comp/ban/unban + audit + error codes (T3), API/hooks with invalidation (T4), Users tab + searchable list + badges (T5), detail page with four cards, action visibility rules, history (T6), read-only e2e incl. demo-has-no-ban-control (T7). Demo included+badged; audit failures logged-not-fatal; money major-units via shared invoiceTotals.
- **Type consistency:** guard signatures in T2 match T3 call sites (`compGuard(target, body.tier)`, `banGuard(user.id, target)`); detail contract keys in T3 match T6's test fixture (`user/counts/history`, `counts.invoiced[{currency,total}]`); hooks' mutate args `{ userId, tier }` match T6 usage; `isBanned` exported from T5 and imported in T6.
- **Known unknowns for the implementer:** exact `Input`/`Badge`/`Table` prop details (T5/T6 reconcile against `AdminPostsPage.jsx`); whether `usage_events` insert needs explicit defaults (T3 — if the insert errors on a missing column default, check `usage_events` column defaults via information_schema and adjust the insert, never the table); copy-id button implementation free-form (T6).
- **Write-safety:** no plan step ever comps/bans a real user; write paths verified by unit guards (T2) + component tests (T6) only.
