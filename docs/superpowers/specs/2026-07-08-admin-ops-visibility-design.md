# Admin Phase 6 — Ops Visibility (Design)

**Status:** Approved 2026-07-08 · **Parent:** Admin roadmap in `2026-07-06-blog-admin-cms-design.md` (Phase 6, final) · **Follows:** Phase 5 Announcements (shipped 2026-07-08)

## Summary

An **Ops** tab in the admin area answering "is the machinery working?": cron job health, Stripe webhook activity + failures, email send failures, and client errors — one `admin-ops` edge function, plus small best-effort failure writers added to `send-invoice` and the two Stripe webhooks (which currently persist no failure trail at all).

## Decisions (brainstorming, 2026-07-08)

- **V1 feeds: all four** (owner choice): cron health, client error log, email send failures, Stripe webhook activity + failures.
- **Context finding:** failures aren't persisted anywhere today — email errors go only to the caller's toast, webhook errors only to console. Hence the writers.
- **Architecture: one `admin-ops` edge function** (house gate pattern) + `service_role`-only `admin_cron_health()` SQL fn (the `cron` schema isn't API-exposed). Rejected: per-feed RPCs, client-side admin RLS on infra tables.
- **Writer safety rule:** failure logging is fire-and-forget — a logging error never changes any function's response; **webhook response codes / Stripe retry semantics stay byte-identical**. No live Stripe events are simulated during implementation.

## Backend

### `admin_cron_health()` (migration)

`SECURITY DEFINER`, `set search_path = public`, EXECUTE revoked from `public`/`anon`/`authenticated`, granted to `service_role` (house ACL pattern, replay-safe grants). Per `cron.job` row: `jobname, schedule, last_run_at, last_status, last_message, failures_7d` (from `cron.job_run_details`).

### Failure writers (all: best-effort insert into `public.error_logs`, wrapped so failures only `console.error`)

- **`send-invoice`**: a lazy `logFailure(message, context)` helper creating a service-role client on first use; called on the SES-502 path and the outer catch. `context: { source: 'send-invoice', invoiceId, status }`. Response payloads unchanged.
- **`stripe-webhook`**: log at (1) signature-verification failure (`400 invalid signature` — a misconfigured secret means every event 400s, exactly the incident to surface), (2) the `ledger error` 500 path, (3) a new outer try/catch around event processing that logs then returns 500 `handler error` (previously an unhandled throw → runtime 500; Stripe retries identically). `context: { source: 'stripe-webhook', eventId?, eventType? }`.
- **`stripe-subscription-webhook`**: same three patterns, plus `error_logs` rows for the existing "missing metadata.tier / no price id — leaving tier unchanged" console-only anomalies. `context.source: 'subscription-webhook'`.
- `error_logs.user_id` stays null for server-side rows.

### `admin-ops` edge function

`verify_jwt`; gate identical to `admin-metrics`. `POST` (no args) → parallel service-role reads:

```json
{
  "generatedAt": "…",
  "cron": [{ "jobname", "schedule", "lastRunAt", "lastStatus", "lastMessage", "failures7d" }],
  "stripe": {
    "lastByType": [{ "type", "processedAt" }],
    "failures": [last 20 error_logs where context->>'source' in ('stripe-webhook','subscription-webhook')]
  },
  "emailFailures": [last 20 error_logs where context->>'source' = 'send-invoice'],
  "clientErrors": [last 20 error_logs where context->>'source' is null or not in the above]
}
```
Error-log rows carry `id, message, context, created_at, user_id`. Feeds are disjoint (no double-reporting). DB failure → 500 generic (house pattern).

## UI

**Ops** tab appended to AdminTabs (Pulse · Posts · Users · Tools · Ops); `/admin/ops` page, `useAdminOps()` hook (`invokeEdge('admin-ops')`, staleTime 60s, refetch button + updated-ago like the Pulse). Four cards:
1. **Cron jobs** — table: job, schedule, last run (relative), status `Badge` (success/danger), failures-7d count (danger badge when > 0).
2. **Stripe webhooks** — last event per type (type + relative time; EmptyState "No events recorded yet"), failures list below.
3. **Email failures** — list (message, invoice id from context, relative time).
4. **Client errors** — list (message, source/type from context, relative time).
Lists show EmptyState "Nothing to report" (the good outcome). Skeletons loading; EmptyState + retry on hard failure. Impeccable pass.

## Testing

- Migration verified live read-only (function returns 3 jobs, succeeded statuses; ACL probes).
- Writers verified by code review + unchanged-response reasoning only — **no simulated Stripe events, no forced email failures against prod**; the send-invoice catch path may be exercised in dev if trivially possible, otherwise reviewed.
- Component tests: Ops page happy path (all four cards render fixture data), all-empty state, hard-error state.
- E2E read-only: admin → Ops tab → cron table shows 3 jobs (real data exists).

## Out of scope

Alerting/push on failure (pull dashboard only), log retention/pruning, Resend email path, Supabase function-log ingestion, retrying failed operations from the UI.
