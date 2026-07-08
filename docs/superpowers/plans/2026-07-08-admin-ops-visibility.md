# Admin Phase 6 — Ops Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An `/admin/ops` page (cron health, Stripe webhook activity + failures, email failures, client errors) plus the failure writers that make those feeds non-empty when things break.

**Architecture:** `admin_cron_health()` SQL fn (service_role-only) + best-effort `error_logs` writers in `send-invoice` and both Stripe webhooks + one `admin-ops` edge function (house gate) + Ops tab/page.

**Tech Stack:** Postgres + pg_cron (hosted `zbipqfsqxnvrzhpdjvvy`), Deno edge functions, React 18 + TanStack Query v5, vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-admin-ops-visibility-design.md` · **Linear:** "Admin Phase 6 — Ops Visibility"

## Global Constraints

- Repo: `C:\Users\mahmo\Desktop\LoomLance-Dashboard`. Commit after every task. Do NOT `git push`.
- Migration via `mcp__supabase__apply_migration`; committed filename = recorded version.
- Edge deploys via `mcp__supabase__deploy_edge_function`, bundle layout `source/index.ts` + root `_shared/*.ts` (house pattern). **When redeploying an existing function, first fetch its CURRENT deployed files via `mcp__supabase__get_edge_function` and redeploy those exact files plus your edit — never reconstruct from repo memory alone.**
- **Money-path safety:** the three writer edits change ONLY failure paths. Response statuses/bodies stay byte-identical (one deliberate exception: stripe-webhook's previously-unhandled throw becomes an explicit 500 `handler error` — same status Stripe saw from the runtime). Never simulate Stripe events; the only permitted live probe is an unsigned POST (already a 400 today).
- Failure logging is fire-and-forget: wrapped so its own errors only `console.error`.
- Tests `npx vitest run` (baseline 248 green); e2e read-only.

---

### Task 1: Migration — `admin_cron_health()`

**Files:**
- Create: `supabase/migrations/<applied-version>_admin_cron_health.sql`

- [ ] **Step 1: Write + apply**

```sql
-- admin_cron_health(): per-job pg_cron status for the admin Ops page (Phase 6).
-- SECURITY DEFINER because the cron schema is not exposed to API roles; EXECUTE locked to
-- service_role (called only by the admin-ops edge function behind the admin gate).
create or replace function public.admin_cron_health()
returns table (
  jobname text,
  schedule text,
  last_run_at timestamptz,
  last_status text,
  last_message text,
  failures_7d bigint
)
language sql
security definer
set search_path = public
as $$
  select
    j.jobname::text,
    j.schedule::text,
    d.start_time,
    d.status::text,
    d.return_message::text,
    (select count(*) from cron.job_run_details f
      where f.jobid = j.jobid and f.status = 'failed'
        and f.start_time >= now() - interval '7 days') as failures_7d
  from cron.job j
  left join lateral (
    select start_time, status, return_message
    from cron.job_run_details r
    where r.jobid = j.jobid
    order by start_time desc
    limit 1
  ) d on true
  order by j.jobname;
$$;

revoke all on function public.admin_cron_health() from public;
revoke all on function public.admin_cron_health() from anon;
revoke all on function public.admin_cron_health() from authenticated;
grant execute on function public.admin_cron_health() to service_role;
```

- [ ] **Step 2: Fetch recorded version, save file with matching name.**
- [ ] **Step 3: Verify live** — `select * from public.admin_cron_health();` → 3 jobs, last_status `succeeded`, failures_7d 0. `set role authenticated; select * from public.admin_cron_health();` → permission denied.
- [ ] **Step 4: Commit** — `feat(db): admin_cron_health() pg_cron status function, service_role-only`

---

### Task 2: Failure writers in `send-invoice` + both Stripe webhooks

**Files:**
- Modify: `supabase/functions/send-invoice/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/stripe-subscription-webhook/index.ts`

**Shared helper (paste into each function — 3 copies is fine; a `_shared` module would force redeploying with new bundles anyway and the helper is 12 lines):**

```typescript
// Best-effort ops logging to public.error_logs — a logging failure must never change
// this function's response. user_id stays null for server-side rows.
async function logFailure(message: string, context: Record<string, unknown>) {
  try {
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    await svc.from('error_logs').insert({ message: message.slice(0, 500), context })
  } catch (e) {
    console.error('logFailure:', e instanceof Error ? e.message : String(e))
  }
}
```

(In the two webhooks `createClient` is already imported; in `send-invoice` too. Where a service client (`admin`) already exists in scope, still use the helper's own client — it keeps the call sites uniform and the helper self-contained.)

- [ ] **Step 1: `send-invoice`** — insert `await logFailure(...)` at exactly two places, changing nothing else:
  - the SES failure return (`return json({ error: 'Email send failed', ... }, 502)` at ~line 155): before the return, `await logFailure('Email send failed: SES ' + sesRes.status, { source: 'send-invoice', invoiceId, status: sesRes.status })` (use the actual invoice-id variable in scope — read the function).
  - the outer catch (~line 160): `await logFailure(e instanceof Error ? e.message : String(e), { source: 'send-invoice' })` before the existing return.

- [ ] **Step 2: `stripe-webhook`** — three insertions:
  - signature-verification catch (~line 28, currently bare `catch { return new Response('invalid signature', { status: 400 }) }`): log `('invalid webhook signature', { source: 'stripe-webhook' })` before the return.
  - the `ledger error` 500 return (~line 44): log `('webhook ledger error: ' + dupErr.message, { source: 'stripe-webhook', eventId: event.id, eventType: event.type })`.
  - wrap the event-processing body (everything AFTER the ledger insert through the final `return new Response('ok')`) in `try { ... } catch (e) { await logFailure(...m..., { source: 'stripe-webhook', eventId: event.id, eventType: event.type }); return new Response('handler error', { status: 500 }) }`. Read the whole function first; keep the existing early returns inside the try untouched.

- [ ] **Step 3: `stripe-subscription-webhook`** — same three patterns (`source: 'subscription-webhook'`), PLUS convert the two console-only anomalies (~lines 80-82: missing `metadata.tier` / missing price id) to ALSO call `logFailure` with the same message (keep the `console.error` lines).

- [ ] **Step 4: Redeploy all three** — for each: `mcp__supabase__get_edge_function` → take its current deployed files → apply the same edit you made to the repo file → deploy. The repo file and deployed file must end up identical (diff them).

- [ ] **Step 5: Verify, without simulating events:**
  - `curl -s -o /dev/null -w "%{http_code}" -X POST https://zbipqfsqxnvrzhpdjvvy.supabase.co/functions/v1/stripe-webhook` → still `400`/`401`-equivalent it returned before the change (check the BEFORE value first — verify_jwt=false so it reaches the function: expect `400 invalid signature`).
  - Then confirm exactly one new `error_logs` row appeared (`context->>'source' = 'stripe-webhook'`, message about signature) — this proves the writer works end-to-end. Delete that probe row (scoped: `delete from error_logs where context->>'source'='stripe-webhook' and message like '%signature%' and created_at > now() - interval '10 minutes'` — check count first, expect 1... actually leave it if you prefer; it is a REAL failure record of our probe. Owner call: delete it to keep feeds clean; note either way.
  - send-invoice: `curl` unauthenticated → 401 gateway (unchanged; verify_jwt=true).
  - `npx vitest run` still green (no frontend changes yet).

- [ ] **Step 6: Commit** — `feat(ops): best-effort failure logging in send-invoice + stripe webhooks`

---

### Task 3: `admin-ops` edge function + deploy

**Files:**
- Create: `supabase/functions/admin-ops/index.ts`
- Modify: `supabase/config.toml` (append `[functions.admin-ops] verify_jwt = true`)

- [ ] **Step 1: Write the function** — gate copied verbatim from `admin-metrics`, then service client and parallel reads:

```typescript
// admin-ops — authenticated, admin-only. "Is the machinery working?" feeds for /admin/ops:
// pg_cron health (admin_cron_health RPC), Stripe webhook activity + failures, email send
// failures, and client errors — all read-only. Deploy: supabase functions deploy admin-ops
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeadersFor, json as jsonBase } from '../_shared/cors.ts'

const OPS_SOURCES = ['send-invoice', 'stripe-webhook', 'subscription-webhook']

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

    const errCols = 'id, message, context, created_at, user_id'
    const [cronRes, lastByTypeRes, stripeFailRes, emailFailRes, clientErrRes] = await Promise.all([
      service.rpc('admin_cron_health'),
      // last event per type: stripe_events is small (dedup ledger) — fetch recent and reduce
      service.from('stripe_events').select('id, type, processed_at').order('processed_at', { ascending: false }).limit(200),
      service.from('error_logs').select(errCols)
        .in('context->>source', ['stripe-webhook', 'subscription-webhook'])
        .order('created_at', { ascending: false }).limit(20),
      service.from('error_logs').select(errCols)
        .eq('context->>source', 'send-invoice')
        .order('created_at', { ascending: false }).limit(20),
      service.from('error_logs').select(errCols)
        .not('context->>source', 'in', '("send-invoice","stripe-webhook","subscription-webhook")')
        .order('created_at', { ascending: false }).limit(20),
    ])
    for (const r of [cronRes, lastByTypeRes, stripeFailRes, emailFailRes]) if (r.error) throw r.error
    // clientErrRes: the not-in filter misses NULL sources under PostgREST semantics — verify
    // during implementation; if NULL-source rows are excluded, fetch last 40 unfiltered and
    // filter in TS instead (rows whose context.source is one of OPS_SOURCES drop out).
    if (clientErrRes.error) throw clientErrRes.error

    const lastByType: Record<string, string> = {}
    for (const e of lastByTypeRes.data ?? []) {
      if (!(e.type in lastByType)) lastByType[e.type] = e.processed_at
    }

    return json({
      generatedAt: new Date().toISOString(),
      cron: (cronRes.data ?? []).map((j: Record<string, unknown>) => ({
        jobname: j.jobname, schedule: j.schedule, lastRunAt: j.last_run_at,
        lastStatus: j.last_status, lastMessage: j.last_message, failures7d: Number(j.failures_7d ?? 0),
      })),
      stripe: {
        lastByType: Object.entries(lastByType).map(([type, processedAt]) => ({ type, processedAt })),
        failures: stripeFailRes.data ?? [],
      },
      emailFailures: emailFailRes.data ?? [],
      clientErrors: (clientErrRes.data ?? []).filter(
        (r: { context?: { source?: string } }) => !OPS_SOURCES.includes(r.context?.source ?? '')
      ),
    })
  } catch (e) {
    console.error('admin-ops:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Failed to load ops data' }, 500)
  }
})
```
(The JSON-path filters (`context->>source`) in PostgREST `.eq/.in/.not` need verifying — if the client rejects the syntax, fall back to fetching last 60 error_logs rows once and partitioning all four buckets in TS. Behavior over cleverness.)

- [ ] **Step 2: config.toml** append below `[functions.admin-users]`:

```toml
[functions.admin-ops]
verify_jwt = true
```

- [ ] **Step 3: Deploy** (bundle: `source/index.ts` + `_shared/cors.ts`) and verify gate: unauthenticated POST → 401.
- [ ] **Step 4: Commit** — `feat(admin): admin-ops edge function — cron, stripe, email, client-error feeds`

---

### Task 4: API + hook + Ops tab + page (TDD + Impeccable)

**Files:**
- Modify: `src/api/admin.js` (add `fetchAdminOps`), `src/features/admin/AdminTabs.jsx` (+ its test), `src/app/routes.jsx`
- Create: `src/hooks/useAdminOps.js`, `src/pages/admin/AdminOpsPage.jsx`
- Test: `src/pages/admin/__tests__/AdminOpsPage.test.jsx`

- [ ] **Step 1: API + hook**

```javascript
// in src/api/admin.js
// Admin-only: ops feeds (cron health, stripe/email/client failures). See supabase/functions/admin-ops.
export async function fetchAdminOps() {
  return invokeEdge('admin-ops')
}
```

```javascript
// src/hooks/useAdminOps.js
import { useQuery } from '@tanstack/react-query'
import { fetchAdminOps } from '@/api/admin'

export function useAdminOps() {
  return useQuery({
    queryKey: ['admin', 'ops'],
    queryFn: fetchAdminOps,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 2: Failing tests** — AdminTabs test gains the Users-style assertion for `Ops → /admin/ops`. `AdminOpsPage.test.jsx` (mock `@/hooks/useAdminOps`):

```jsx
// Cases:
// 1. happy path: cron table shows a job row with status badge text 'succeeded';
//    stripe lastByType row visible; an email failure message visible; a client error visible
// 2. all-empty: every list shows 'Nothing to report' (or the stripe 'No events recorded yet');
//    cron table still renders rows if provided
// 3. hard error: /Couldn't load ops data/ + Try again button
// Fixture mirrors the Task 3 contract exactly.
```

- [ ] **Step 3: Implement** — `AdminTabs` gains `{ to: '/admin/ops', label: 'Ops' }` after Tools; route `{ path: 'ops', element: <AdminOpsPage /> }`; page mirrors the Pulse's skeleton/error/refresh scaffolding with four `Card`s:
  1. Cron: kit `Table` (Job / Schedule / Last run `relativeTime` / Status `Badge variant={lastStatus === 'succeeded' ? 'success' : 'danger'}` / `failures7d > 0 && <Badge variant="danger">{n} failed · 7d</Badge>`).
  2. Stripe: two sub-lists — lastByType (`type` mono text + relative time; EmptyState "No events recorded yet") and failures (shared `ErrorList`).
  3. Email failures: `ErrorList`.
  4. Client errors: `ErrorList`.
  `ErrorList` = small local component: message (truncated), `context.source ?? context.type ?? '—'` subtle, relative time; renders `<p>Nothing to report.</p>` styled muted when empty.

- [ ] **Step 4: Green** — target tests, then full `npx vitest run`, `npx vite build`. **Impeccable pass** on the page.
- [ ] **Step 5: Commit** — `feat(admin): Ops page — cron health, stripe, email, client-error feeds`

---

### Task 5: E2E (read-only) + full verification

- [ ] **Step 1:** `tests/e2e/admin-ops.spec.js` — login (env creds), `/admin/ops`, expect the three cron job names visible (real data), tab navigation works. Read-only.
- [ ] **Step 2:** Full `npx vitest run` + `npx playwright test` (all 5 specs green).
- [ ] **Step 3: Commit** — `test(e2e): admin ops page renders live cron health`

---

## Self-review notes

- **Spec coverage:** cron fn + ACL (T1), all three writers with exact insertion points + no-response-change rule + the one sanctioned live probe (T2), admin-ops with disjoint feeds + NULL-source caveat (T3), tab/page/tests (T4), read-only e2e (T5).
- **Type consistency:** payload keys `cron[].failures7d` / `stripe.lastByType[].processedAt` / `emailFailures` / `clientErrors` match between T3 contract and T4 fixtures; `error_logs` row shape `{id,message,context,created_at,user_id}` everywhere.
- **Known unknowns:** PostgREST JSON-path filter syntax support (T3 fallback specified), exact variable names in the three functions' failure paths (T2 reads each file first), whether the unsigned-POST probe row should be kept or deleted (T2 Step 5 — owner-visible either way).
