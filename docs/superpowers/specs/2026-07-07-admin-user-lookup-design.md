# Admin Phase 3 — User Lookup & Support (Design)

**Status:** Approved 2026-07-07 · **Parent:** Admin roadmap in `2026-07-06-blog-admin-cms-design.md` (Phase 3) · **Follows:** Phase 2 Business Pulse (shipped 2026-07-07)

## Summary

A support surface inside `/admin`: a searchable **Users** list and a per-user detail page showing identity, subscription, and usage, with two write actions — **comp a tier** (non-subscribers only) and **ban/unban sign-in** — every write audit-logged to the existing `usage_events` table. One new admin-gated edge function (`admin-users`) carries all reads and writes.

## Decisions (made during brainstorming, 2026-07-07)

- **Deactivate = reversible auth ban** (GoTrue `ban_duration`), keeping all data and public invoice links live. Not deletion, not invoice-link disabling.
- **Comp only non-subscribers:** the Stripe subscription webhook overwrites `subscription_tier`/`status` for anyone with a `stripe_customer_id` on every event, so comping a paying user would silently revert. Server rejects (409); UI disables with a "manage in Stripe" note.
- **Audit log = `usage_events`** (exists, currently empty): one row per successful comp/ban/unban; reads not logged.
- **Architecture: one edge function** `admin-users` with an action switch, over function-per-op or direct SQL RPCs (bans need the GoTrue admin API, which SQL can't reach cleanly).
- List loads ALL users (25 today) and filters client-side by email/name — superset of the roadmap's "search by email". Pagination out of scope until a few hundred users.
- **Demo user is INCLUDED** in this surface (support tooling sees every account), visibly badged — unlike the pulse metrics, which exclude it.
- All UI work routes through the **Impeccable** skill (owner directive re-affirmed for this phase).

## Backend

### SQL function `admin_user_list()`

`SECURITY DEFINER`, `set search_path = public`, EXECUTE revoked from `public`/`anon`/`authenticated`, granted to `service_role` only (identical ACL pattern to `admin_user_stats()`, migration applied via MCP with matching filename/version). Returns one row per user — `auth.users` joined to `profiles`:

`id, email, display_name, created_at, last_sign_in_at, banned_until, subscription_tier, subscription_status, current_period_end, is_admin, has_stripe_subscription` (`stripe_subscription_id is not null`).

Sorted `created_at desc`. No password hashes, tokens, or any auth internals beyond the listed columns.

### Edge function `admin-users`

`verify_jwt = true`; gate identical to `admin-metrics`: anon client + caller JWT → `auth.getUser()` → `profiles.is_admin` → 401/403. Then a service-role client. `POST { action, ... }`:

| Action | Input | Behavior |
|---|---|---|
| `list` | — | `rpc('admin_user_list')`, returned as-is |
| `detail` | `userId` | list row for that user + parallel service-role counts (**all-time**, no windowing): clients, projects, invoices (count + total invoiced cents via existing money conventions), hours tracked (Σ `time_entries.duration_minutes`/60, 1-decimal) + last 20 `usage_events` rows with `kind='admin_action'` for that user |
| `comp` | `userId, tier` | Guards in order: user exists (404); `tier ∈ {free, tier_1, tier_2}` (400); target has NO `stripe_subscription_id` (409 "This user has a live Stripe subscription — manage it in Stripe"). Then `update profiles set subscription_tier = tier, subscription_status = 'active' where id = userId`. Service role bypasses `protect_billing_columns` — the pin's documented admin path. |
| `ban` | `userId` | Guards: not yourself (409 lockout guard), not the demo user `d3a70000-0000-4000-8000-000000000001` (409 — breaks screencasts/sale demos), not another admin (409). Then GoTrue admin API `auth.admin.updateUserById(userId, { ban_duration: '87600h' })`. |
| `unban` | `userId` | `auth.admin.updateUserById(userId, { ban_duration: 'none' })`. |

**Audit:** after each successful comp/ban/unban, insert into `usage_events`: `kind = 'admin_action'`, `user_id` = target, `payload = { action: 'comp'|'ban'|'unban', actor_id, actor_email, from, to, at }` (`from`/`to` = tier values for comp, ban state for ban/unban). An audit-insert failure is server-logged but does NOT fail the action (the action already happened; prefer an audit gap over a false error).

**Guard helpers are pure and shared:** `_shared/adminUserGuards.ts` exports `compGuard(target, tier)` and `banGuard(actor, target)` returning `{ ok: true } | { ok: false, status, message }` — unit-testable without a live function.

### Errors

401 unauthenticated / 403 non-admin / 400 unknown action or invalid tier / 404 unknown user / 409 guard violations — all with human-readable `error` strings the UI shows verbatim (existing `invokeEdge` mapping) / 500 otherwise with a generic message, details server-logged only. Never log secrets or full error objects.

## UI

- **`AdminTabs`** gains **Users**: Pulse · Posts · Users · Tools.
- **Routes:** `/admin/users` (list), `/admin/users/:id` (detail) — mirrors `posts`/`posts/:id`.
- **`AdminUsersPage`:** search `Input` ("Search by email or name…") filtering client-side; kit `Table` with columns email (link to detail), display name, tier `Badge`, status, last sign-in (relative), plus "Banned" (when `banned_until` is in the future), "Admin", "Demo" badges. Newest first. `Skeleton` rows loading; `EmptyState` when no match / hard error with retry.
- **`AdminUserDetailPage`** — four stacked cards:
  1. **Identity:** email, display name, business name/type, created, last sign-in, copyable user id; state badges.
  2. **Subscription:** tier, status, `current_period_end`, Stripe presence (customer/subscription ids when present).
  3. **Usage:** clients / projects / invoices (count + total invoiced, house money formatting) / hours — reusing the pulse `StatTile`.
  4. **Actions:** comp select (`free/tier_1/tier_2`) + Apply, disabled with the manage-in-Stripe note when `has_stripe_subscription`; Ban (danger) / Unban via `ConfirmDialog` stating exactly what a ban does ("blocks sign-in; data and public invoice links stay live; reversible"). Ban control hidden for self, demo user, and other admins (cosmetic — the server enforces regardless). Below: **Admin history** list from the audit rows.
- **Hooks:** `useAdminUsers()` (staleTime 2 min), `useAdminUserDetail(id)`, mutations `useCompTier` / `useBanUser` / `useUnbanUser` — each invalidates list + detail and toasts success/error (server `error` text verbatim). All via `invokeEdge('admin-users', { action, ... })`.
- Impeccable pass on both pages at build time.

## Security

- One new privileged surface (the edge function) + one `service_role`-only SQL function; no RLS changes; no direct `auth` schema writes (bans via GoTrue admin API only).
- Server-side guards are the boundary; UI hiding/disabling is cosmetic.
- Payload contains user emails/business fields the admin already owns; no auth secrets.

## Testing

- **Unit (vitest):** `_shared/adminUserGuards.test.ts` — every rejection branch (self-ban, demo-ban, admin-ban, comp-with-subscription, invalid tier) and the pass cases.
- **Component:** list page (rows render, search filters, badges) and detail page (action visibility: no ban control for self/demo/admin; comp disabled for subscriber; history renders) with mocked hooks.
- **E2E (read-only):** admin login → Users tab → search the demo user → open detail → identity + counts render. NO write actions in e2e (live accounts); writes are covered by unit guards + component tests.

## Out of scope (this phase)

Password resets, profile-field editing, impersonation/login-as, account deletion, refunds (Stripe dashboard), pagination, hiding public invoice links on ban.
