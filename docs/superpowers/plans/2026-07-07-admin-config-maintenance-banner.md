# Admin Phase 4 — Config & Maintenance Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `app_config` (single-row, world-readable, admin-writable, audit-logged) with one v1 switch: a maintenance banner across the Dashboard + login page, managed from `/admin/tools`.

**Architecture:** Direct RLS writes — no edge function. Migration creates the table + policies + audit trigger; a `useAppConfig` hook feeds a `MaintenanceBanner` component (AppShell + LoginPage) and a Tools-page card writes via supabase-js under the `public.is_admin()` policy.

**Tech Stack:** Postgres (hosted `zbipqfsqxnvrzhpdjvvy`), React 18 + TanStack Query v5 + sonner, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-admin-config-maintenance-banner-design.md` · **Linear:** "Admin Phase 4 — Config & Maintenance Banner"

## Global Constraints

- Repo: `C:\Users\mahmo\Desktop\LoomLance-Dashboard`. Commit after every task. Do NOT `git push`.
- Migration via `mcp__supabase__apply_migration`; committed filename must equal the recorded version in `supabase_migrations.schema_migrations` (check after applying).
- LIVE PRODUCTION DB: **never leave a banner set** — any audit-trigger probe runs inside `begin ... rollback`. No live-banner writes, no e2e for the write path.
- Banner must NOT appear on public invoice pages (`/i/:token` renders outside `AppShell`, so mounting only in `AppShell` + `LoginPage` satisfies this — verify no other mount).
- UI kit imports from `@/components/ui/*`; toasts via `sonner`; errors via `mapPostgresError` (`@/lib/errors`); Impeccable pass on every UI task.
- Tests: `npx vitest run`. Existing suites stay green (baseline 228).

---

### Task 1: Migration — rebuild `app_config`

**Files:**
- Create: `supabase/migrations/<applied-version>_app_config_rebuild.sql`

**Interfaces:**
- Produces: `public.app_config` single row (`id = true`), column `maintenance_banner text`, world-readable, `is_admin()`-updatable, audit-logged to `usage_events`. Tasks 2–4 read/write it via supabase-js.

- [ ] **Step 1: Write the migration**

```sql
-- app_config v2 (Phase 4): rebuilt after the original (mock_payments_enabled only) was
-- dropped at go-live (20260625130000). Single-row config: world-readable so the login page
-- and app shell can read pre/post-auth; updates gated on public.is_admin() (RLS is the
-- boundary — same pattern as the posts CMS). Changes are audit-logged to usage_events,
-- joining the Phase 3 admin_action stream.
create table public.app_config (
  id boolean primary key default true check (id),
  maintenance_banner text,
  updated_at timestamptz not null default now()
);

insert into public.app_config (id) values (true) on conflict do nothing;

alter table public.app_config enable row level security;

create policy app_config_read_all on public.app_config
  for select to anon, authenticated using (true);

create policy app_config_update_admin on public.app_config
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- no insert/delete policies: the PK check + seed enforce exactly one row.

create trigger app_config_set_updated_at
  before update on public.app_config
  for each row execute function public.set_updated_at();

-- Audit: SECURITY DEFINER so the insert isn't blocked by usage_events RLS. Logs only on
-- actual banner changes; auth.uid() is the acting admin (null if changed via SQL editor).
create or replace function public.log_app_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.maintenance_banner is distinct from old.maintenance_banner then
    insert into public.usage_events (user_id, kind, payload)
    values (
      auth.uid(),
      'admin_action',
      jsonb_build_object(
        'action', 'config',
        'field', 'maintenance_banner',
        'from', old.maintenance_banner,
        'to', new.maintenance_banner,
        'at', now()
      )
    );
  end if;
  return new;
end;
$$;

create trigger app_config_audit
  after update on public.app_config
  for each row execute function public.log_app_config_change();
```

Note: `usage_events.user_id` must be nullable for the SQL-editor case — check with `select is_nullable from information_schema.columns where table_name='usage_events' and column_name='user_id'`. If it is `NO`, change the trigger to `coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)` is NOT acceptable (fake user) — instead skip the insert when `auth.uid()` is null and note it in the migration comment.

- [ ] **Step 2: Apply via `mcp__supabase__apply_migration`** (name `app_config_rebuild`), then fetch the recorded version and save the file as `supabase/migrations/<version>_app_config_rebuild.sql`.

- [ ] **Step 3: Verify** via `mcp__supabase__execute_sql`:

```sql
select * from public.app_config;                          -- exactly one row, banner null
set role anon; select maintenance_banner from public.app_config; reset role;   -- works
set role authenticated;
update public.app_config set maintenance_banner = 'x' where id = true;
reset role;
-- expect: 0 rows updated (RLS filters the row for non-admin; policy check blocks)
```

Audit-trigger probe WITHOUT leaving a banner:
```sql
begin;
update public.app_config set maintenance_banner = 'probe' where id = true;
select payload from public.usage_events where kind = 'admin_action'
  and payload->>'field' = 'maintenance_banner' order by created_at desc limit 1;
rollback;
```
Expected: one payload row with `from: null, to: 'probe'` — then rolled back (verify `select maintenance_banner from public.app_config` is still null).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_app_config_rebuild.sql
git commit -m "feat(db): rebuild app_config — maintenance banner, is_admin writes, audit trigger"
```

---

### Task 2: API + hooks

**Files:**
- Create: `src/api/config.js`, `src/hooks/useAppConfig.js`

**Interfaces:**
- Produces: `fetchAppConfig(): Promise<{ id, maintenance_banner, updated_at }>`, `updateAppConfig(patch)`; hooks `useAppConfig()` (queryKey `['app-config']`, staleTime 60s) and `useUpdateAppConfig()` (invalidates `['app-config']`). Tasks 3–4 consume.

- [ ] **Step 1: `src/api/config.js`**

```javascript
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

// Single-row app config (id = true). World-readable; updates require is_admin() via RLS.
export async function fetchAppConfig() {
  const { data, error } = await supabase.from('app_config').select('*').eq('id', true).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateAppConfig(patch) {
  const { data, error } = await supabase.from('app_config').update(patch).eq('id', true).select().single()
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 2: `src/hooks/useAppConfig.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAppConfig, updateAppConfig } from '@/api/config'

export function useAppConfig() {
  return useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, staleTime: 60 * 1000 })
}

export function useUpdateAppConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAppConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-config'] }),
  })
}
```

- [ ] **Step 3: Verify + commit** — `npx vitest run` (all green, no new tests this task):

```bash
git add src/api/config.js src/hooks/useAppConfig.js
git commit -m "feat(config): app_config API + hooks"
```

---

### Task 3: `MaintenanceBanner` + mounts (TDD + Impeccable)

**Files:**
- Create: `src/components/layout/MaintenanceBanner.jsx`
- Modify: `src/components/layout/AppShell.jsx` (mount above `<Topbar />`), `src/pages/LoginPage.jsx` (mount at top)
- Test: `src/components/layout/__tests__/MaintenanceBanner.test.jsx`

**Interfaces:**
- Consumes: `useAppConfig()` (Task 2).
- Produces: `<MaintenanceBanner />` — self-contained; renders nothing unless `maintenance_banner` has non-whitespace content.

- [ ] **Step 1: Failing tests**

```jsx
// src/components/layout/__tests__/MaintenanceBanner.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MaintenanceBanner } from '../MaintenanceBanner'
import { useAppConfig } from '@/hooks/useAppConfig'

vi.mock('@/hooks/useAppConfig')

describe('MaintenanceBanner', () => {
  it('renders the banner text when set', () => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: 'Payments degraded — investigating.' } })
    render(<MaintenanceBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Payments degraded — investigating.')
  })
  it.each([[null], [''], ['   ']])('renders nothing for %j', (value) => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: value } })
    const { container } = render(<MaintenanceBanner />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders nothing while loading or on error', () => {
    useAppConfig.mockReturnValue({ data: undefined })
    const { container } = render(<MaintenanceBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run src/components/layout` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```jsx
import { TriangleAlert } from 'lucide-react'
import { useAppConfig } from '@/hooks/useAppConfig'

// Site-wide maintenance notice. Renders nothing unless app_config.maintenance_banner has
// content — including while loading or on read failure (the banner must never block the app).
export function MaintenanceBanner() {
  const { data } = useAppConfig()
  const text = data?.maintenance_banner?.trim()
  if (!text) return null
  return (
    <div role="status" className="flex items-center gap-2.5 border-b border-warning/30 bg-warning/15 px-4 py-2 text-sm">
      <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span className="text-fg">{text}</span>
    </div>
  )
}
```

Mounts: in `AppShell.jsx`, first child of the `flex flex-1 flex-col` div (above `<Topbar />`); in `LoginPage.jsx`, first element inside the page wrapper (above the logo block) — match the page's existing layout structure. Verify `/i/:token` (`PublicInvoicePage`) does NOT render `AppShell` (it doesn't — confirm via routes.jsx) so no banner leaks to clients.

- [ ] **Step 4: Run** — `npx vitest run` — all green (new 5 + baseline). **Impeccable pass** (banner tone/contrast in light + dark).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MaintenanceBanner.jsx src/components/layout/__tests__/MaintenanceBanner.test.jsx src/components/layout/AppShell.jsx src/pages/LoginPage.jsx
git commit -m "feat(config): maintenance banner across app shell + login"
```

---

### Task 4: Tools-page card (TDD + Impeccable) + full verification

**Files:**
- Modify: `src/pages/admin/AdminToolsPage.jsx`
- Test: `src/pages/admin/__tests__/AdminToolsPage.test.jsx` (new)

**Interfaces:**
- Consumes: `useAppConfig()` / `useUpdateAppConfig()` (Task 2), kit `Card/Input/Button`, sonner.

- [ ] **Step 1: Failing tests**

```jsx
// src/pages/admin/__tests__/AdminToolsPage.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminToolsPage from '../AdminToolsPage'
import { useAppConfig, useUpdateAppConfig } from '@/hooks/useAppConfig'

vi.mock('@/hooks/useAppConfig')

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/tools']}>
      <AdminToolsPage />
    </MemoryRouter>
  )
}

describe('AdminToolsPage — maintenance banner card', () => {
  beforeEach(() => {
    useUpdateAppConfig.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })
  it('saves the entered banner text', async () => {
    const mutate = vi.fn()
    useAppConfig.mockReturnValue({ data: { maintenance_banner: null } })
    useUpdateAppConfig.mockReturnValue({ mutate, isPending: false })
    renderPage()
    await userEvent.type(screen.getByLabelText('Maintenance banner'), 'Deploying 22:00 UTC')
    await userEvent.click(screen.getByRole('button', { name: /save banner/i }))
    expect(mutate).toHaveBeenCalledWith({ maintenance_banner: 'Deploying 22:00 UTC' }, expect.anything())
  })
  it('clears an active banner', async () => {
    const mutate = vi.fn()
    useAppConfig.mockReturnValue({ data: { maintenance_banner: 'Live now' } })
    useUpdateAppConfig.mockReturnValue({ mutate, isPending: false })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(mutate).toHaveBeenCalledWith({ maintenance_banner: null }, expect.anything())
  })
  it('hides Clear when no banner is set', () => {
    useAppConfig.mockReturnValue({ data: { maintenance_banner: null } })
    renderPage()
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })
})
```

Note: `AdminToolsPage` renders `resetDemoUser` imports — the test file may need `vi.mock('@/api/admin')` if module side-effects reach supabase; mirror how other admin page tests isolate (AdminUsersPage.test mocks only hooks — check whether Tools imports run clean under jsdom; add `vi.mock('@/api/admin')` if the import chain touches `supabase` env).

- [ ] **Step 2: Run** — Expected: FAIL (missing labels/buttons).

- [ ] **Step 3: Implement** — in `AdminToolsPage.jsx`, add ABOVE the demo-reset `Card`:

```jsx
<Card>
  <h3 className="font-semibold">Maintenance banner</h3>
  <p className="mt-1 text-sm text-fg-muted">
    Shown across the app and on the login page while set. Clear it to take it down.
  </p>
  <div className="mt-4 flex flex-wrap items-center gap-3">
    <Input
      id="maintenance-banner"
      aria-label="Maintenance banner"
      placeholder="e.g. Payments degraded — investigating"
      value={banner}
      onChange={(e) => setBanner(e.target.value)}
      className="max-w-md"
    />
    <Button onClick={onSave} loading={update.isPending} disabled={!dirty}>
      Save banner
    </Button>
    {hasActiveBanner && (
      <Button variant="secondary" onClick={onClear} loading={update.isPending}>
        Clear
      </Button>
    )}
  </div>
</Card>
```

With page logic:
```jsx
const { data: config } = useAppConfig()
const update = useUpdateAppConfig()
const [banner, setBanner] = useState('')
useEffect(() => { setBanner(config?.maintenance_banner ?? '') }, [config?.maintenance_banner])
const hasActiveBanner = !!config?.maintenance_banner?.trim()
const dirty = banner.trim() !== (config?.maintenance_banner ?? '').trim() && banner.trim() !== ''
const onSave = () => update.mutate({ maintenance_banner: banner.trim() }, {
  onSuccess: () => toast.success('Banner saved — it is live now'),
  onError: (e) => toast.error(e.userMessage || e.message),
})
const onClear = () => { setBanner(''); update.mutate({ maintenance_banner: null }, {
  onSuccess: () => toast.success('Banner cleared'),
  onError: (e) => toast.error(e.userMessage || e.message),
}) }
```
Add the imports (`useEffect`, `Input`, `useAppConfig`, `useUpdateAppConfig`). Keep the existing demo-reset card and its behavior untouched.

- [ ] **Step 4: Run all tests** — `npx vitest run` — Expected: all green. `npx vite build` succeeds. **Impeccable pass** on the Tools page.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminToolsPage.jsx src/pages/admin/__tests__/AdminToolsPage.test.jsx
git commit -m "feat(admin): maintenance banner card on Tools page"
```

---

## Self-review notes

- **Spec coverage:** table/RLS/audit trigger + rollback-probe verification (T1), API/hooks (T2), banner component + AppShell/Login mounts + not-on-public-invoice check (T3), Tools card with Save/Clear + toasts (T4). No live-banner writes anywhere.
- **Type consistency:** `['app-config']` key shared by hook + invalidation; mutation arg `{ maintenance_banner: string | null }` matches T4 tests; `role="status"` matches T3 tests.
- **Known unknowns:** `usage_events.user_id` nullability (T1 Step 1 note resolves), whether Tools page test needs `vi.mock('@/api/admin')` (T4 Step 1 note), exact LoginPage wrapper structure (T3 Step 3 adapts).
