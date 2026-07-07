# Admin Phase 2 — Business Pulse (Design)

**Status:** Approved 2026-07-07 · **Parent:** Admin roadmap in `2026-07-06-blog-admin-cms-design.md` (Phase 2)

## Summary

A read-only `/admin/pulse` page — the new admin landing page — showing the owner how the business is doing: signups, activity, tier mix, MRR and trial funnel (live from Stripe), plus a product-usage strip that answers "are signups actually using the app?". One new admin-gated edge function supplies every number in a single payload.

## Decisions (made during brainstorming)

- **MRR source: live Stripe API** (owner's choice over DB-derived). Exact figures including discounts/proration; reuses the existing `STRIPE_SECRET_KEY` secret already configured for the checkout/webhook functions.
- **Usage strip: included** — invoices/projects/hours/clients activity from existing tables.
- **Architecture: single edge function** (`admin-metrics`) rather than RPC-per-metric or client-side admin RLS. One privileged surface, one gate, one loading state.
- Trial conversions come from Stripe subscription history (the DB stores only current state; `usage_events` exists but is empty, `stripe_events` is a dedup log with no payload).
- **Demo-user exclusion applies to ALL metrics** (owner decision 2026-07-07, during execution): user counts, signups, tier breakdown, and the usage strip all exclude `d3a70000-…` — not just the usage strip as originally scoped. Keeps the tier mix consistent with Stripe reality.

## Context findings

- `app_config` **no longer exists** (dropped at go-live) — relevant to Phase 4 (kill switches), which must now rebuild that table.
- Tiers: `free | tier_1 | tier_2`. Statuses: `active | past_due | canceled | incomplete | trialing`.
- Posts ↔ Tools admin pages currently have no cross-navigation; this phase adds the shared tab strip.

## Data layer

### Edge function `admin-metrics`

- `verify_jwt` on. Gate identical to `trigger-blog-publish`: anon client + caller's `Authorization` header → `auth.getUser()` → `profiles.is_admin` → else 401/403.
- After the gate, a **service-role** client performs all reads.
- Sources:
  - **Users/signups:** new SQL function `admin_user_stats()` (see below).
  - **Tier breakdown:** `profiles` counts grouped by `subscription_tier` and `subscription_status` (counts only).
  - **MRR + trials:** Stripe subscriptions list (`status=all`, paginated, bounded at 1,000 subs with a logged warning if hit). Pure helpers compute: MRR = Σ active + past_due item prices normalized monthly (annual ÷ 12, × quantity); trials = currently trialing / converted (had trial, now active) / churned (had trial, ended unconverted).
  - **Usage strip:** 7-day and 30-day counts from `invoices` (created; sent), `projects`, `time_entries` (hours), `clients` — **excluding the demo user** (`d3a70000-0000-4000-8000-000000000001`).

### SQL function `admin_user_stats()`

`SECURITY DEFINER`, reads `auth.users`, returns **aggregates only** (no emails/PII): total users, active-7d, active-30d (from `last_sign_in_at`), and a 12-week signup series from `created_at`. Weeks are ISO (Monday start, UTC). `EXECUTE` revoked from `anon` and `authenticated`; granted to `service_role` only — callable exclusively through the gated edge function. Migration applied to the hosted project via MCP and committed to `supabase/migrations/`.

### Response contract

```json
{
  "generatedAt": "2026-07-07T12:00:00Z",
  "users": { "total": 25, "active7d": 9, "active30d": 21,
             "signupsByWeek": [{ "weekStart": "2026-04-20", "count": 3 }] },
  "tiers": { "free": 22, "tier_1": 2, "tier_2": 1, "trialing": 1, "pastDue": 0 },
  "stripe": { "mrr": 4800, "currency": "usd", "activeSubs": 3, "trialing": 1,
              "trialsConverted": 2, "trialsChurned": 1 },
  "usage": { "invoicesCreated": { "d7": 4, "d30": 12 }, "invoicesSent": { "d7": 2, "d30": 9 },
             "projectsCreated": { "d7": 1, "d30": 5 }, "hoursTracked": { "d7": 14.5, "d30": 61 },
             "clientsAdded": { "d7": 0, "d30": 3 } }
}
```

Money is integer cents (`money.js` convention). **Partial failure:** if Stripe errors/times out, the function still returns 200 with `"stripe": null, "stripeError": true` — DB metrics always render.

## UI

- **Route:** new `AdminPulsePage` at `/admin/pulse`; the `/admin` index redirect changes from `/admin/posts` to `/admin/pulse`.
- **`AdminTabs`** — small shared strip (Pulse · Posts · Tools) added to the top of all three admin pages (kit-styled `NavLink`s).
- **Layout, top to bottom:**
  1. `PageHeader` "Pulse" + "Updated N min ago" + Refresh button.
  2. Users tile row: Total users · Active (7d) · Active (30d) · Signups this week.
  3. Revenue tile row: MRR (headline) · Active subscriptions · Trialing now · Trial conversions (converted vs churned). When `stripe` is null this row alone becomes an inline "Stripe unavailable — showing database metrics only" card with retry; the rest of the page still renders.
  4. Signups chart: 12-week bar chart (Recharts, existing dependency).
  5. Tier breakdown: one horizontal segmented bar (free / tier_1 / tier_2) with counts + past-due badge when nonzero.
  6. Usage strip: five small tiles (invoices created · invoices sent · projects · hours tracked · clients added), 7-day headline with 30-day subtext.
- **Data plumbing:** `useAdminMetrics()` react-query hook wrapping `supabase.functions.invoke('admin-metrics')`; `staleTime` 5 min; no refetch-on-focus; Refresh = `refetch()`. Kit `Skeleton` while loading; hard (non-Stripe) failure → kit `EmptyState` with retry.
- UI kit imports per house style; visual pass via Impeccable at build time; chart styling per dataviz guidance.

## Security

- The edge function is the only new privileged surface; no RLS policy changes.
- `admin_user_stats()` unreachable from browser roles; returns aggregates only.
- Payload contains counts and cents only — no PII.

## Error handling

- 401 unauthenticated / 403 non-admin (cosmetically unreachable behind `AdminGate`).
- Stripe failure → 200 + `stripe: null` (degraded revenue row only).
- DB failure → 500 + message → page `EmptyState` with retry.
- Stripe pagination bound logged if hit — no silent truncation.
- Week bucketing defined once (ISO Monday, UTC) and shared between SQL and chart labels.

## Testing

- **Unit (vitest):** pure helpers in `supabase/functions/_shared/metrics.ts` — week bucketing edges, MRR normalization (monthly/annual/quantity/status filters), trial classification. Same pattern as the `money.ts` parity tests.
- **Component (vitest):** `AdminPulsePage` with mocked hook — happy path renders all tiles; `stripe: null` variant shows inline Stripe error with DB tiles intact.
- **E2E (Playwright):** admin login → `/admin` lands on Pulse → tiles show live numbers → tabs navigate to Posts.

## Out of scope (this phase)

Historical MRR trends, cohort retention, per-user drill-down (Phase 3), server-side caching, and any write operations.
