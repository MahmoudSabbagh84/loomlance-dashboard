# Admin Phase 4 — Config & Maintenance Banner (Design)

**Status:** Approved 2026-07-07 · **Parent:** Admin roadmap in `2026-07-06-blog-admin-cms-design.md` (Phase 4) · **Follows:** Phase 3 User Lookup (shipped 2026-07-07)

## Summary

Rebuild the `app_config` infrastructure (dropped at go-live — it only ever held `mock_payments_enabled`) as a world-readable, admin-writable single-row table, with **one v1 switch: a maintenance banner** shown across the Dashboard app and login page while set. Owner decision: signups toggle, payments/GitHub kill switches deferred — future keys join the same row.

## Decisions (brainstorming, 2026-07-07)

- **V1 switch set: maintenance banner only** (owner choice from banner / signups toggle / payments kill / GitHub kill).
- **Architecture: direct RLS writes** (owner choice) — no edge function; `SELECT` for `anon`+`authenticated`, `UPDATE` gated on existing `public.is_admin()`, same pattern as the posts CMS. An `AFTER UPDATE` trigger audit-logs to `usage_events`, joining Phase 3's audit stream.
- Banner deliberately NOT shown on public invoice pages (`/i/:token`) — those are the freelancers' clients; internal ops notices don't belong there.
- No dismiss button; the banner persists until cleared.
- **No live-banner test during implementation** — any real write is visible to live users. Verification = component tests + SQL RLS checks; owner may live-test post-merge.

## Data

Migration recreates `public.app_config` (single-row pattern, as before):

```sql
id boolean primary key default true check (id),   -- forces exactly one row
maintenance_banner text,                          -- null/empty = banner off
updated_at timestamptz not null default now()
```

- Seed one row (`insert ... on conflict do nothing`).
- RLS enabled: `select` policy `using (true)` for `anon, authenticated` (login page reads pre-auth); `update` policy `using (public.is_admin()) with check (public.is_admin())` for `authenticated`; no insert/delete policies.
- `set_updated_at()` trigger (existing helper from `20260609185350_profiles.sql`).
- `AFTER UPDATE` audit trigger: when `maintenance_banner` changes, insert `usage_events` row — `user_id = auth.uid()`, `kind = 'admin_action'`, `payload = { action: 'config', field: 'maintenance_banner', from, to, at }`. SECURITY DEFINER so the insert isn't blocked by usage_events RLS.

## Consumption

- `src/api/config.js`: `fetchAppConfig()` (`select().eq('id', true).single()`), `updateAppConfig(patch)` (update + `mapPostgresError`).
- `src/hooks/useAppConfig.js`: `useAppConfig()` (staleTime 60s) + `useUpdateAppConfig()` (invalidates `['app-config']`).
- `MaintenanceBanner` component (`src/components/layout/MaintenanceBanner.jsx`): renders only when `maintenance_banner` is non-empty after trim — warning-toned bar (kit tokens: `bg-warning/15 text-warning` band with icon + `text-fg` message), `role="status"`. Mounted: (1) in `AppShell` inside the content column above `<Topbar />`; (2) at the top of `LoginPage`. Read failure → renders nothing (never blocks the app).

## Admin UI

The existing **Tools** page (`/admin/tools`) gains a "Maintenance banner" `Card` ABOVE the demo-reset card: `Input` bound to the current value, **Save** (disabled while unchanged/pending) and **Clear** (only when a banner is set) buttons, toasts on success/error (`e.userMessage || e.message`). Impeccable pass required.

## Error handling

- Banner read errors are swallowed (component renders nothing); Tools card uses the standard error/retry presentation on load failure.
- Non-admin update attempts are rejected by RLS (surfaced verbatim via `mapPostgresError` if ever seen).

## Testing

- **Component (vitest):** `MaintenanceBanner` — renders text when set, renders nothing when null/empty/whitespace; Tools card — Save calls `useUpdateAppConfig().mutate` with `{ maintenance_banner: <text> }`, Clear with `{ maintenance_banner: null }`.
- **Migration verification (hosted, read-only + role probes):** anon `select` works; `set role authenticated` update denied; single row exists; audit trigger fires on a postgres-role update ONLY if reverted in the same transaction (`begin ... rollback`) so no banner ever shows.
- **E2E:** none new (a live write would show real users a banner). Existing suites must stay green.

## Out of scope

Signups toggle, payments/GitHub kill switches, splash changes, per-user dismissal, banner scheduling/severity levels.
