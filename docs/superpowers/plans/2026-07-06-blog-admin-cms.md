# Blog + Admin CMS v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public static blog on the splash site (per-post pages, RSS) authored from a new owner-only `/admin` area in the Dashboard app, published via an Edge-Function-triggered GitHub Action, plus a one-click demo-account reset.

**Architecture:** Supabase `posts` table is the source of truth (RLS: anon reads published, admin full CRUD via `profiles.is_admin`). The Dashboard app gains an `/admin` route group (Posts CMS + Tools). Publishing calls Edge Function `trigger-blog-publish`, which fires `repository_dispatch` at the splash repo; a GitHub Action there runs `scripts/build-blog.mjs` to regenerate ALL blog HTML + RSS + sitemap from the DB (idempotent), rebuilds Tailwind, commits, and the host auto-deploys.

**Tech Stack:** React 18 + React Router v6 + TanStack Query v5 + sonner (Dashboard); Supabase (Postgres/RLS/Storage/Edge Functions, hosted project `zbipqfsqxnvrzhpdjvvy`); `marked` + `dompurify` (admin preview); Node 20 + `marked` + `sanitize-html` + `@tailwindcss/typography` (splash generator); GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-06-blog-admin-cms-design.md` · **Linear:** project "Blog & Admin CMS"

## Global Constraints

- Two repos: **Dashboard** `C:\Users\mahmo\Desktop\LoomLance-Dashboard` (Tasks 1–9), **Splash** `C:\Users\mahmo\Desktop\LoomLance-Splash` (Tasks 10–13).
- Migrations are applied to the **hosted dev project** via `mcp__supabase__apply_migration` (no local Docker — house rule). Migration files are ALSO committed to `supabase/migrations/` with matching names.
- Storage uploads: plain `.upload()` with a unique `Date.now()` path — **never `upsert: true`** (RLS denies the existence check).
- RLS is the security boundary; client-side admin guards are cosmetic only.
- UI uses the existing kit: `import { X } from '@/components/ui/X'` (`Button`, `Modal`, `Input`, `ConfirmDialog`, `Card`, `PageHeader`, `Table`, `Badge`, `Skeleton`, `EmptyState`), toasts via `import { toast } from 'sonner'`.
- Commit after every task. **Do NOT `git push` either repo** — the owner pushes manually.
- The owner uses the app live during sessions: never bulk-delete data; anything touching the hosted DB must be scoped exactly as written.
- Dashboard tests: `npx vitest run` (unit), `npx playwright test` (e2e). Splash tests: `npm test` (`node --test scripts/`).
- The demo user is `demo@loomlance.com`; `reset_demo_user()` must resolve its id **by email** and touch no other user's rows.
- Splash repo GitHub remote: `MahmoudSabbagh84/loomlance-splah` (note the historical typo "splah" — use it verbatim). Public site base URL: `https://loomlance.com`.

---

### Task 1: Migration — `is_admin`, `posts`, `blog-images` bucket

**Files:**
- Create: `supabase/migrations/20260706210000_blog_foundation.sql`

**Interfaces:**
- Produces: `public.posts` table, `public.is_admin()` SQL fn, `profiles.is_admin` column, public storage bucket `blog-images`. Later tasks rely on these exact names, and on posts columns: `id, slug, title, excerpt, body_md, cover_image_url, category, external_url, status, published_at, created_at, updated_at`.

- [ ] **Step 1: Check for an existing `updated_at` trigger helper**

Run: `grep -rn "updated_at" supabase/migrations/ | grep -i "function\|trigger" | head`
If a reusable trigger function (e.g. `set_updated_at()` / `moddatetime`) exists, use it in Step 2 instead of creating `set_posts_updated_at`; otherwise keep the block as written.

- [ ] **Step 2: Write the migration file**

```sql
-- Blog + admin foundation: profiles.is_admin, is_admin() helper, posts table, blog-images bucket.

alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 300),
  body_md text not null default '',
  cover_image_url text,
  category text not null check (category in ('release','update','press')),
  external_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "posts_select_published_or_admin"
  on public.posts for select
  using (status = 'published' or public.is_admin());

create policy "posts_insert_admin"
  on public.posts for insert
  with check (public.is_admin());

create policy "posts_update_admin"
  on public.posts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "posts_delete_admin"
  on public.posts for delete
  using (public.is_admin());

create index posts_published_idx on public.posts (published_at desc) where status = 'published';

create or replace function public.set_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_posts_updated_at();

-- Public bucket: covers must load on the anonymous blog pages.
insert into storage.buckets (id, name, public) values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "blog_images_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'blog-images' and public.is_admin());

create policy "blog_images_update_admin"
  on storage.objects for update
  using (bucket_id = 'blog-images' and public.is_admin());

create policy "blog_images_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'blog-images' and public.is_admin());
```

- [ ] **Step 3: Apply to the hosted dev project**

Use `mcp__supabase__apply_migration` with name `blog_foundation` and the SQL above.

- [ ] **Step 4: Verify**

Use `mcp__supabase__execute_sql`:
```sql
select public.is_admin();                              -- returns false (no auth context)
insert into public.posts (slug, title, category) values ('x', 'X', 'release'); -- as service role: succeeds
delete from public.posts where slug = 'x';
select id, public from storage.buckets where id = 'blog-images';  -- 1 row, public = true
```
Then set the owner + E2E test user as admins (owner will confirm emails):
```sql
update public.profiles set is_admin = true
where email in ('mahmoudsabbagh8@gmail.com');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260706210000_blog_foundation.sql
git commit -m "feat(db): posts table, is_admin flag/helper, blog-images bucket"
```

---

### Task 2: Migration — `reset_demo_user()`

**Files:**
- Create: `supabase/migrations/20260706211500_reset_demo_user.sql`

**Interfaces:**
- Produces: `public.reset_demo_user()` (no args, returns `void`), callable via `supabase.rpc('reset_demo_user')` by admins only.

- [ ] **Step 1: Bind the fixture to the real schema**

Open these migrations and copy the exact column lists for the insert statements below: the clients migration, `20260616202137_projects_and_kanban.sql` (projects/tasks — note: inserting a project auto-seeds 4 kanban columns via the `seed_default_columns` trigger), the invoices migration (invoices + invoice_line_items + invoice_number_sequences), the time-tracking and expenses migrations. Use only columns that exist; give every `not null` column a value.

- [ ] **Step 2: Write the migration**

Skeleton (fill INSERT column lists from Step 1; keep the fixture data exactly as specified):

```sql
create or replace function public.reset_demo_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_client_globex uuid;
  v_client_initech uuid;
  v_project_site uuid;
  v_project_tools uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select id into v_uid from auth.users where email = 'demo@loomlance.com';
  if v_uid is null then
    raise exception 'demo user not found';
  end if;

  -- Wipe (children before parents; every table filtered by the demo user id)
  delete from public.github_issue_cards        where user_id = v_uid;
  delete from public.project_repos             where user_id = v_uid;
  delete from public.github_installations      where user_id = v_uid;
  delete from public.user_notifications        where user_id = v_uid;
  delete from public.usage_events              where user_id = v_uid;
  delete from public.error_logs                where user_id = v_uid;
  delete from public.invoice_payments          where user_id = v_uid;
  delete from public.invoice_line_items        where user_id = v_uid;
  delete from public.invoices                  where user_id = v_uid;
  delete from public.recurring_invoice_templates where user_id = v_uid;
  delete from public.time_entries              where user_id = v_uid;
  delete from public.expenses                  where user_id = v_uid;
  delete from public.project_budget_changes    where user_id = v_uid;
  delete from public.tasks                     where user_id = v_uid;
  delete from public.kanban_columns            where user_id = v_uid;
  delete from public.contracts                 where user_id = v_uid;
  delete from public.projects                  where user_id = v_uid;
  delete from public.client_contacts           where user_id = v_uid;
  delete from public.clients                   where user_id = v_uid;
  delete from public.invoice_number_sequences  where user_id = v_uid;

  -- Re-seed canonical screencast fixture
  -- Clients: "Globex Digital" <billing@globex.example>, "Initech Labs" <accounts@initech.example>
  insert into public.clients (...) values (...) returning id into v_client_globex;
  insert into public.clients (...) values (...) returning id into v_client_initech;

  -- Projects: "Marketing Site Rebuild" (Globex, active), "Internal Tools" (Initech, active)
  -- (kanban columns auto-seeded by trigger)
  insert into public.projects (...) values (...) returning id into v_project_site;
  insert into public.projects (...) values (...) returning id into v_project_tools;

  -- 4 tasks on "Marketing Site Rebuild", spread across its columns:
  --   'Design homepage hero' (To Do), 'Implement pricing page' (In Progress),
  --   'Set up CI' (Review), 'Kickoff call notes' (Done)
  insert into public.tasks (...)
  select ... from public.kanban_columns c
  where c.project_id = v_project_site and c.name = 'To Do';
  -- (repeat per column/task)

  -- Invoice sequence: next number 1003
  insert into public.invoice_number_sequences (...) values (...);

  -- Invoices: INV-1001 paid, total $4,800 (2 line items: 'Design sprint' 24h x $100, 'Build sprint' 24h x $100);
  --           INV-1002 sent, total $2,250 (1 line item: 'API integration' 15h x $150), due 14 days out
  insert into public.invoices (...) values (...);
  insert into public.invoice_line_items (...) values (...);

  -- 3 time entries on "Marketing Site Rebuild" (2h, 3.5h, 1.25h, recent dates), 2 expenses
  -- ('Plugin license' $49.00 non-billable, 'Stock photos' $32.00 billable, on the Globex project)
  insert into public.time_entries (...) values (...);
  insert into public.expenses (...) values (...);
end;
$$;

revoke execute on function public.reset_demo_user() from public, anon;
grant execute on function public.reset_demo_user() to authenticated;
```

Money columns follow the existing money model (cents vs decimal — copy whatever the invoices schema uses; `money.js` is the source of truth for representation).

- [ ] **Step 3: Apply via `mcp__supabase__apply_migration`** (name `reset_demo_user`)

- [ ] **Step 4: Verify against the hosted DB**

Using `mcp__supabase__execute_sql` (service role bypasses the admin check — expected):
```sql
select public.reset_demo_user();
select
  (select count(*) from public.clients  where user_id = (select id from auth.users where email='demo@loomlance.com'))  as clients,   -- 2
  (select count(*) from public.projects where user_id = (select id from auth.users where email='demo@loomlance.com'))  as projects,  -- 2
  (select count(*) from public.invoices where user_id = (select id from auth.users where email='demo@loomlance.com'))  as invoices;  -- 2
select public.reset_demo_user();  -- run twice: must be idempotent, same counts after
```
Confirm no other user's row counts changed (spot-check the owner's `clients` count before/after).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260706211500_reset_demo_user.sql
git commit -m "feat(db): reset_demo_user() admin function with canonical demo fixture"
```

---

### Task 3: Slug utility (Dashboard)

**Files:**
- Create: `src/lib/slug.js`
- Test: `src/lib/__tests__/slug.test.js`

**Interfaces:**
- Produces: `slugify(title: string): string` — lowercase, ASCII-ish kebab-case matching the DB check `^[a-z0-9]+(-[a-z0-9]+)*$`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest'
import { slugify } from '../slug'

describe('slugify', () => {
  it('lowercases and kebab-cases', () => {
    expect(slugify('GitHub Integration Is Here!')).toBe('github-integration-is-here')
  })
  it('collapses runs of separators and trims edge dashes', () => {
    expect(slugify('  Hello --- World_v2  ')).toBe('hello-world-v2')
  })
  it('strips diacritics and symbols', () => {
    expect(slugify('Café & Crème: 50% off')).toBe('cafe-creme-50-off')
  })
  it('returns empty string for no usable chars', () => {
    expect(slugify('!!!')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/slug.test.js`
Expected: FAIL — cannot resolve `../slug`.

- [ ] **Step 3: Implement**

```javascript
// src/lib/slug.js
export function slugify(title) {
  return String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/slug.test.js` — Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.js src/lib/__tests__/slug.test.js
git commit -m "feat: slugify utility for post slugs"
```

---

### Task 4: Posts API + hooks (Dashboard)

**Files:**
- Create: `src/api/posts.js`
- Create: `src/api/blogImages.js`
- Create: `src/hooks/usePosts.js`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`; error mapping helper if present in `src/api/clients.js` (reuse `mapPostgresError` import path used there).
- Produces:
  - `listPosts(): Promise<Post[]>` (admin: all posts, newest first by `created_at`)
  - `getPost(id): Promise<Post>`
  - `createPost({ title, slug, category, excerpt, body_md, cover_image_url, external_url }): Promise<Post>`
  - `updatePost(id, patch): Promise<Post>`
  - `deletePost(id): Promise<void>`
  - `setPostStatus(id, status): Promise<Post>` — sets `published_at = new Date().toISOString()` on first publish (only if currently null)
  - `triggerBlogPublish(): Promise<{ ok: true }>` — invokes Edge Function
  - `uploadBlogImage(file): Promise<string>` (public URL)
  - Hooks: `usePosts()`, `usePost(id)`, `useCreatePost()`, `useUpdatePost()`, `useDeletePost()`, `useSetPostStatus()` — TanStack Query, key family `['posts', ...]`

- [ ] **Step 1: Write `src/api/posts.js`**

```javascript
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from './clients' // reuse the existing mapper; adjust import if it lives elsewhere

const COLS = 'id, slug, title, excerpt, body_md, cover_image_url, category, external_url, status, published_at, created_at, updated_at'

export async function listPosts() {
  const { data, error } = await supabase.from('posts').select(COLS).order('created_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data
}

export async function getPost(id) {
  const { data, error } = await supabase.from('posts').select(COLS).eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createPost(fields) {
  const { data, error } = await supabase.from('posts').insert(fields).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updatePost(id, patch) {
  const { data, error } = await supabase.from('posts').update(patch).eq('id', id).select(COLS).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deletePost(id) {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function setPostStatus(id, status) {
  const patch = { status }
  if (status === 'published') {
    const current = await getPost(id)
    if (!current.published_at) patch.published_at = new Date().toISOString()
  }
  return updatePost(id, patch)
}

export async function triggerBlogPublish() {
  const { data, error } = await supabase.functions.invoke('trigger-blog-publish', { body: {} })
  if (error) throw new Error(error.message || 'Publish trigger failed')
  return data
}
```

If `mapPostgresError` is not exported from `src/api/clients.js`, locate its actual module (grep `mapPostgresError` in `src/api/`) and import from there; do not duplicate it.

- [ ] **Step 2: Write `src/api/blogImages.js`** (mirrors `src/api/branding.js` — plain upload, unique path, no upsert)

```javascript
import { supabase } from '@/lib/supabase'

const BUCKET = 'blog-images'
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAX_BYTES = 4 * 1024 * 1024

export async function uploadBlogImage(file) {
  if (!EXT[file.type]) throw new Error('Use a PNG, JPG, or WebP image')
  if (file.size > MAX_BYTES) throw new Error('Image must be under 4 MB')
  const path = `covers/${Date.now()}.${EXT[file.type]}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw new Error(error.message || 'Upload failed')
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
```

- [ ] **Step 3: Write `src/hooks/usePosts.js`** (same shape as `src/hooks/useClients.js`)

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/posts'

export function usePosts() {
  return useQuery({ queryKey: ['posts', 'list'], queryFn: api.listPosts })
}

export function usePost(id) {
  return useQuery({ queryKey: ['posts', 'detail', id], queryFn: () => api.getPost(id), enabled: !!id })
}

function useInvalidatingMutation(mutationFn) {
  const qc = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] }) })
}

export function useCreatePost() { return useInvalidatingMutation(api.createPost) }
export function useUpdatePost() { return useInvalidatingMutation(({ id, patch }) => api.updatePost(id, patch)) }
export function useDeletePost() { return useInvalidatingMutation(api.deletePost) }
export function useSetPostStatus() { return useInvalidatingMutation(({ id, status }) => api.setPostStatus(id, status)) }
```

- [ ] **Step 4: Verify the app still builds**

Run: `npx vitest run` — Expected: all existing tests pass (new files have no tests yet; API layer is exercised through Task 9's e2e).

- [ ] **Step 5: Commit**

```bash
git add src/api/posts.js src/api/blogImages.js src/hooks/usePosts.js
git commit -m "feat: posts API, blog image upload, react-query hooks"
```

---

### Task 5: AdminGate + routes + nav (Dashboard)

**Files:**
- Create: `src/features/admin/AdminGate.jsx`
- Test: `src/features/admin/__tests__/AdminGate.test.jsx`
- Modify: `src/app/routes.jsx` (add admin child routes inside the authenticated layout route's `children`)
- Modify: `src/components/layout/SidebarNav.jsx` (conditional Admin item)

**Interfaces:**
- Consumes: `useProfile()` from `@/hooks/useProfile` (profile row includes `is_admin` — it selects `*`).
- Produces: `<AdminGate>{children}</AdminGate>` — renders children only for admins; `Skeleton` while loading; `<Navigate to="/" replace />` otherwise. Routes: `/admin` → redirect `/admin/posts`; `/admin/posts`; `/admin/posts/new`; `/admin/posts/:id`; `/admin/tools`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminGate } from '../AdminGate'
import { useProfile } from '@/hooks/useProfile'

vi.mock('@/hooks/useProfile')

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/admin" element={<AdminGate><p>admin area</p></AdminGate>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminGate', () => {
  it('renders children for admins', () => {
    useProfile.mockReturnValue({ data: { is_admin: true }, isLoading: false })
    renderGate()
    expect(screen.getByText('admin area')).toBeInTheDocument()
  })
  it('redirects non-admins home', () => {
    useProfile.mockReturnValue({ data: { is_admin: false }, isLoading: false })
    renderGate()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
    expect(screen.getByText('home')).toBeInTheDocument()
  })
  it('shows nothing conclusive while loading', () => {
    useProfile.mockReturnValue({ data: undefined, isLoading: true })
    renderGate()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
    expect(screen.queryByText('home')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it** — `npx vitest run src/features/admin` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `AdminGate.jsx`**

```jsx
import { Navigate } from 'react-router-dom'
import { useProfile } from '@/hooks/useProfile'
import { Skeleton } from '@/components/ui/Skeleton'

export function AdminGate({ children }) {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-48" /></div>
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return children
}
```

- [ ] **Step 4: Run the test** — Expected: 3 passed.

- [ ] **Step 5: Register routes**

In `src/app/routes.jsx`, inside the authenticated layout route's `children` array, add (imports at top; pages arrive in Tasks 6–8 — create placeholder pages exporting `<PageHeader title="…" />` now so the app compiles, they are replaced next tasks):

```jsx
{
  path: 'admin',
  element: <AdminGate><Outlet /></AdminGate>,
  children: [
    { index: true, element: <Navigate to="/admin/posts" replace /> },
    { path: 'posts', element: <AdminPostsPage /> },
    { path: 'posts/new', element: <AdminPostEditorPage /> },
    { path: 'posts/:id', element: <AdminPostEditorPage /> },
    { path: 'tools', element: <AdminToolsPage /> },
  ],
},
```

- [ ] **Step 6: Nav item**

In `src/components/layout/SidebarNav.jsx`: the component already reads the profile for tier gating (`profile?.subscription_tier`). After the tier-gated items render, add an admin-only block (do NOT put it in the `NAV` array — it is not tier-gated):

```jsx
{profile?.is_admin && (
  <NavLink to="/admin" className={/* same classes as other items */}>
    <ShieldCheck className="..." /> Admin
  </NavLink>
)}
```

Match the exact classNames/structure of existing items (copy from an existing `NavLink` in the file); `ShieldCheck` from `lucide-react`.

- [ ] **Step 7: Verify & commit**

Run: `npx vitest run` (all pass) and `npm run dev` — log in as the owner (is_admin=true from Task 1) → "Admin" appears in sidebar → `/admin` redirects to `/admin/posts` placeholder. A non-admin (demo user) must NOT see the item and `/admin` bounces home.

```bash
git add src/features/admin src/app/routes.jsx src/components/layout/SidebarNav.jsx src/pages/admin
git commit -m "feat(admin): AdminGate, /admin routes, sidebar entry"
```

---

### Task 6: Admin Posts list page (Dashboard)

**Files:**
- Create: `src/pages/admin/AdminPostsPage.jsx` (replaces Task 5 placeholder)

**Interfaces:**
- Consumes: `usePosts()`, `useDeletePost()` from `@/hooks/usePosts`; UI kit; `toast`.
- Produces: list at `/admin/posts` linking to `/admin/posts/:id` and `/admin/posts/new`.

- [ ] **Step 1: Implement**

```jsx
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Plus, ExternalLink } from 'lucide-react'
import { usePosts, useDeletePost } from '@/hooks/usePosts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'

const CATEGORY_LABEL = { release: 'Feature release', update: 'Product update', press: 'Press' }

export default function AdminPostsPage() {
  const { data: posts, isLoading } = usePosts()
  const del = useDeletePost()
  const navigate = useNavigate()
  const [toDelete, setToDelete] = useState(null)

  return (
    <div>
      <PageHeader
        title="Blog posts"
        actions={<Button onClick={() => navigate('/admin/posts/new')}><Plus className="size-4" /> New post</Button>}
      />
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !posts?.length ? (
        <EmptyState title="No posts yet" body="Write your first release note or press mention." />
      ) : (
        <Table>
          <THead>
            <TR><TH>Title</TH><TH>Category</TH><TH>Status</TH><TH>Published</TH><TH /></TR>
          </THead>
          <tbody>
            {posts.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link to={`/admin/posts/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                  {p.external_url && <ExternalLink className="ml-1 inline size-3.5 text-fg-subtle" aria-label="Link-out post" />}
                </TD>
                <TD>{CATEGORY_LABEL[p.category]}</TD>
                <TD><Badge variant={p.status === 'published' ? 'success' : 'default'}>{p.status}</Badge></TD>
                <TD>{p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}</TD>
                <TD>
                  <Button variant="ghost" size="sm" onClick={() => setToDelete(p)}>Delete</Button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete post?"
        body={`"${toDelete?.title}" will be removed. If it was published, it disappears from the blog on the next publish run.`}
        variant="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          del.mutate(toDelete.id, {
            onSuccess: () => { toast.success('Post deleted'); setToDelete(null) },
            onError: (e) => toast.error(e.userMessage || e.message || 'Could not delete post'),
          })
        }}
      />
    </div>
  )
}
```

Adjust `Badge` variant prop / `PageHeader` `actions` prop names to the actual component APIs (open the component files; if `Badge` uses e.g. `tone`, use that).

- [ ] **Step 2: Verify manually** — `npm run dev`, insert a seed row via SQL if needed, list renders, delete works.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminPostsPage.jsx
git commit -m "feat(admin): posts list with delete"
```

---

### Task 7: Post editor page (Dashboard)

**Files:**
- Create: `src/pages/admin/AdminPostEditorPage.jsx` (replaces placeholder)
- Modify: `package.json` (add deps)

**Interfaces:**
- Consumes: `usePost`, `useCreatePost`, `useUpdatePost`, `useSetPostStatus`; `uploadBlogImage` from `@/api/blogImages`; `triggerBlogPublish` from `@/api/posts`; `slugify` from `@/lib/slug`.
- Produces: editor at `/admin/posts/new` and `/admin/posts/:id`. Publish = save → `setPostStatus('published')` → `triggerBlogPublish()`.

- [ ] **Step 1: Add markdown deps**

Run: `npm install marked dompurify`

- [ ] **Step 2: Implement the page**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import { usePost, useCreatePost, useUpdatePost, useSetPostStatus } from '@/hooks/usePosts'
import { uploadBlogImage } from '@/api/blogImages'
import { triggerBlogPublish } from '@/api/posts'
import { slugify } from '@/lib/slug'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

const ACTIONS_URL = 'https://github.com/MahmoudSabbagh84/loomlance-splah/actions'
const EXCERPT_TARGET = 155

const EMPTY = { title: '', slug: '', category: 'update', excerpt: '', body_md: '', cover_image_url: null, external_url: '' }

export default function AdminPostEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: existing, isLoading } = usePost(id)
  const create = useCreatePost()
  const update = useUpdatePost()
  const setStatus = useSetPostStatus()

  const [form, setForm] = useState(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { if (existing) { setForm({ ...existing, external_url: existing.external_url ?? '' }); setSlugTouched(true) } }, [existing])

  const isPublished = existing?.status === 'published'
  const slugLocked = !!existing?.published_at // locked after first publish — URLs never break
  const preview = useMemo(
    () => ({ __html: DOMPurify.sanitize(marked.parse(form.body_md || '*Nothing to preview yet.*')) }),
    [form.body_md]
  )

  function set(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'title' && !slugTouched && !slugLocked) next.slug = slugify(value)
      return next
    })
  }

  function validate() {
    if (!form.title.trim()) return 'Title is required'
    if (!form.slug) return 'Slug is required'
    if (!form.excerpt.trim()) return 'Excerpt is required (it is the meta description)'
    if (form.external_url && !/^https:\/\//.test(form.external_url)) return 'External URL must start with https://'
    return null
  }

  async function save(extra = {}) {
    const err = validate()
    if (err) { toast.error(err); return null }
    const fields = {
      title: form.title.trim(), slug: form.slug, category: form.category,
      excerpt: form.excerpt.trim(), body_md: form.body_md,
      cover_image_url: form.cover_image_url, external_url: form.external_url || null, ...extra,
    }
    if (existing) return update.mutateAsync({ id: existing.id, patch: fields })
    const created = await create.mutateAsync(fields)
    navigate(`/admin/posts/${created.id}`, { replace: true })
    return created
  }

  async function handlePublish() {
    try {
      const saved = await save()
      if (!saved) return
      await setStatus.mutateAsync({ id: saved.id, status: 'published' })
      await triggerBlogPublish()
      toast.success('Publish triggered — live in ~2 minutes', {
        action: { label: 'View build', onClick: () => window.open(ACTIONS_URL, '_blank') },
      })
    } catch (e) {
      toast.error(e.userMessage || e.message || 'Publish failed — the post is saved; try Publish again')
    }
  }

  async function handleUnpublish() {
    try {
      await setStatus.mutateAsync({ id: existing.id, status: 'draft' })
      await triggerBlogPublish()
      toast.success('Unpublished — removal deploys in ~2 minutes')
    } catch (e) {
      toast.error(e.userMessage || e.message || 'Unpublish failed')
    }
  }

  async function handleCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { set('cover_image_url', await uploadBlogImage(file)) }
    catch (err) { toast.error(err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  if (id && isLoading) return null

  const excerptLen = form.excerpt.length
  const saving = create.isPending || update.isPending

  return (
    <div>
      <PageHeader
        title={existing ? 'Edit post' : 'New post'}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" loading={saving} onClick={() => save().then((s) => s && toast.success('Draft saved'))}>
              Save draft
            </Button>
            {isPublished
              ? <Button variant="danger" loading={setStatus.isPending} onClick={handleUnpublish}>Unpublish</Button>
              : <Button loading={setStatus.isPending} onClick={handlePublish}>Publish</Button>}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <label className="field-label" htmlFor="post-title">Title</label>
          <Input id="post-title" value={form.title} onChange={(e) => set('title', e.target.value)} />

          <label className="field-label mt-4" htmlFor="post-slug">Slug {slugLocked && <span className="text-fg-subtle">(locked — post is published)</span>}</label>
          <Input id="post-slug" value={form.slug} disabled={slugLocked}
            onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value) || e.target.value) }} />

          <label className="field-label mt-4" htmlFor="post-category">Category</label>
          <select id="post-category" className="field-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="release">Feature release</option>
            <option value="update">Product update</option>
            <option value="press">Press</option>
          </select>

          {form.category === 'press' && (
            <>
              <label className="field-label mt-4" htmlFor="post-external">External article URL (optional — makes this a link-out)</label>
              <Input id="post-external" placeholder="https://…" value={form.external_url} onChange={(e) => set('external_url', e.target.value)} />
            </>
          )}

          <label className="field-label mt-4" htmlFor="post-excerpt">
            Excerpt <span className={excerptLen > EXCERPT_TARGET ? 'text-warning' : 'text-fg-subtle'}>({excerptLen}/{EXCERPT_TARGET})</span>
          </label>
          <textarea id="post-excerpt" className="field-input" rows={2} maxLength={300}
            value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />

          <label className="field-label mt-4">Cover image</label>
          {form.cover_image_url && <img src={form.cover_image_url} alt="Cover preview" className="mb-2 max-h-40 rounded-lg border border-border" />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              {form.cover_image_url ? 'Replace image' : 'Upload image'}
            </Button>
            {form.cover_image_url && <Button variant="ghost" size="sm" onClick={() => set('cover_image_url', null)}>Remove</Button>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCover} />

          <label className="field-label mt-4" htmlFor="post-body">Body (Markdown)</label>
          <textarea id="post-body" className="field-input font-mono text-xs" rows={18}
            value={form.body_md} onChange={(e) => set('body_md', e.target.value)} />
        </Card>
        <Card>
          <p className="field-label">Preview</p>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={preview} />
        </Card>
      </div>
    </div>
  )
}
```

Notes: `field-label` / `field-input` — if the Dashboard doesn't have these utility classes (they exist in the splash), use the existing form classes from `ClientFormModal.jsx` instead; match whatever that file does. If the Dashboard lacks Tailwind typography, plain spacing on the preview div is fine — the authoritative rendering is the generator's.

- [ ] **Step 3: Verify manually** — create a draft with markdown (headings, list, link, an `<script>alert(1)</script>` — preview must strip it), upload a cover, save; reload page → values persist; slug edits lock after publish.

- [ ] **Step 4: Run all tests** — `npx vitest run` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/pages/admin/AdminPostEditorPage.jsx
git commit -m "feat(admin): post editor with markdown preview, cover upload, publish actions"
```

---

### Task 8: Edge Function `trigger-blog-publish` + Tools page (Dashboard)

**Files:**
- Create: `supabase/functions/trigger-blog-publish/index.ts`
- Modify: `supabase/config.toml` (add function block)
- Create: `src/pages/admin/AdminToolsPage.jsx` (replaces placeholder)

**Interfaces:**
- Consumes: `_shared/cors.ts` helpers (`corsHeadersFor`, `json`); secret `GITHUB_BLOG_DISPATCH_TOKEN`.
- Produces: POST-only function; 401 non-auth, 403 non-admin, 502 GitHub failure, `{ ok: true }` on success. Tools page calls `supabase.rpc('reset_demo_user')`.

- [ ] **Step 1: Write the Edge Function**

```typescript
// Deploy: supabase functions deploy trigger-blog-publish
// Secrets: GITHUB_BLOG_DISPATCH_TOKEN (fine-grained PAT, loomlance-splah repo, Contents: read/write)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeadersFor, json } from '../_shared/cors.ts'

const REPO = 'MahmoudSabbagh84/loomlance-splah'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'Not authenticated' }, 401, req)

  const { data: profile } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return json({ error: 'Admin only' }, 403, req)

  const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('GITHUB_BLOG_DISPATCH_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'blog_publish' }),
  })
  if (res.status !== 204) {
    const detail = await res.text()
    console.error('dispatch failed', res.status, detail)
    return json({ error: `GitHub dispatch failed (${res.status})` }, 502, req)
  }
  return json({ ok: true }, 200, req)
})
```

- [ ] **Step 2: Register in `supabase/config.toml`**

```toml
[functions.trigger-blog-publish]
verify_jwt = true
```

- [ ] **Step 3: Deploy** — `supabase functions deploy trigger-blog-publish` (or `mcp__supabase__deploy_edge_function`). Setting the `GITHUB_BLOG_DISPATCH_TOKEN` secret is an **owner step** (Task 13 checklist); until then the function returns 502 — expected.

- [ ] **Step 4: Tools page**

```jsx
import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export default function AdminToolsPage() {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)

  async function resetDemo() {
    setRunning(true)
    try {
      const { error } = await supabase.rpc('reset_demo_user')
      if (error) throw error
      toast.success('Demo account reset to the canonical fixture')
    } catch (e) {
      toast.error(e.message || 'Reset failed')
    } finally {
      setRunning(false)
      setConfirming(false)
    }
  }

  return (
    <div>
      <PageHeader title="Tools" />
      <Card>
        <h3 className="font-semibold">Reset demo account</h3>
        <p className="mt-1 text-sm text-fg-muted">
          Wipes demo@loomlance.com and re-seeds the screencast fixture (2 clients, 2 projects, 2 invoices, time & expenses). Only touches the demo account.
        </p>
        <Button variant="danger" className="mt-4" loading={running} onClick={() => setConfirming(true)}>
          Reset demo account
        </Button>
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Reset demo account?"
        body="All current demo data is replaced with the canonical fixture. This cannot be undone."
        variant="danger"
        onCancel={() => setConfirming(false)}
        onConfirm={resetDemo}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify** — as owner, `/admin/tools` → Reset → success toast; log in as demo user → fixture data present. Run twice (idempotent).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/trigger-blog-publish supabase/config.toml src/pages/admin/AdminToolsPage.jsx
git commit -m "feat(admin): trigger-blog-publish edge function + demo reset tools page"
```

---

### Task 9: Admin e2e (Dashboard)

**Files:**
- Create: `tests/e2e/admin-posts.spec.js`

**Interfaces:**
- Consumes: existing e2e login pattern from `tests/e2e/happy-path.spec.js` (env `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`). **Precondition:** the E2E user's profile has `is_admin = true` on the TEST project (one-time SQL, mirror of Task 1 Step 4 — run against the test project, not dev).

- [ ] **Step 1: Write the spec** (copy the login helper style from `happy-path.spec.js` verbatim, then):

```javascript
// tests/e2e/admin-posts.spec.js
import { test, expect } from '@playwright/test'
// ...reuse the same login helper as happy-path.spec.js

test('admin can create, edit, and delete a draft post', async ({ page }) => {
  await login(page)
  await page.goto('/admin/posts')
  await page.getByRole('button', { name: 'New post' }).click()

  const title = `ZZ E2E Post ${Date.now()}` // ZZ marker per cleanup convention
  await page.getByLabel('Title').fill(title)
  await page.getByLabel(/Excerpt/).fill('E2E excerpt for meta description purposes.')
  await page.getByLabel(/Body/).fill('# Hello\n\nSome **markdown**.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved')).toBeVisible()

  await page.goto('/admin/posts')
  await expect(page.getByRole('link', { name: title })).toBeVisible()

  await page.getByRole('row', { name: new RegExp(title) }).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: /Delete|Confirm/ }).click()
  await expect(page.getByRole('link', { name: title })).not.toBeVisible()
})
```

Publish is NOT exercised in e2e (it would fire a real GitHub dispatch).

- [ ] **Step 2: Run** — `npx playwright test tests/e2e/admin-posts.spec.js` — Expected: PASS. Fix selectors against the real DOM if the kit renders differently.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-posts.spec.js
git commit -m "test(e2e): admin post draft CRUD"
```

---

### Task 10: Splash — deps, typography, template library with tests

**Files (splash repo):**
- Modify: `package.json`, `tailwind.config.js`
- Create: `scripts/blog-lib.mjs`
- Test: `scripts/blog-lib.test.mjs`

**Interfaces:**
- Produces (from `blog-lib.mjs`, all pure, exported):
  - `renderMarkdown(md: string): string` — marked + sanitize-html
  - `escapeHtml(s)`, `escapeXml(s)`
  - `postHref(post): string` — `https://loomlance.com/blog/<slug>` or `post.external_url` when set
  - `renderIndexPage(posts): string` — full HTML doc for `/blog`
  - `renderPostPage(post): string` — full HTML doc for one post
  - `renderRss(posts): string`, `renderSitemap(posts): string`
  - `SITE_URL = 'https://loomlance.com'`, `CATEGORY_LABEL = { release: 'Feature release', update: 'Product update', press: 'Press' }`

- [ ] **Step 1: Install deps + wire scripts**

```bash
cd C:\Users\mahmo\Desktop\LoomLance-Splash
npm install -D marked sanitize-html @tailwindcss/typography
```

`package.json` scripts additions:
```json
"build:blog": "node scripts/build-blog.mjs",
"test": "node --test scripts/"
```

`tailwind.config.js`: `content: ['./*.html', './blog/**/*.html']` and `plugins: [require('@tailwindcss/typography')]`.

- [ ] **Step 2: Write failing tests**

```javascript
// scripts/blog-lib.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown, postHref, renderIndexPage, renderPostPage, renderRss, escapeXml } from './blog-lib.mjs'

const post = {
  slug: 'github-integration', title: 'GitHub Integration Is Here', excerpt: 'Link repos to projects.',
  body_md: '# Hi\n\n**bold** and <script>alert(1)</script>', cover_image_url: null,
  category: 'release', external_url: null, published_at: '2026-07-06T12:00:00Z',
}
const pressPost = { ...post, slug: 'krispitech', title: 'KrispiTech on LoomLance', category: 'press', external_url: 'https://krispitech.com/x' }

test('renderMarkdown strips scripts, keeps formatting', () => {
  const html = renderMarkdown(post.body_md)
  assert.match(html, /<strong>bold<\/strong>/)
  assert.doesNotMatch(html, /<script/)
})

test('postHref: internal vs link-out', () => {
  assert.equal(postHref(post), 'https://loomlance.com/blog/github-integration')
  assert.equal(postHref(pressPost), 'https://krispitech.com/x')
})

test('index lists posts; press link-outs open externally', () => {
  const html = renderIndexPage([post, pressPost])
  assert.match(html, /GitHub Integration Is Here/)
  assert.match(html, /href="https:\/\/krispitech\.com\/x"[^>]*target="_blank"/)
})

test('post page has SEO tags', () => {
  const html = renderPostPage(post)
  assert.match(html, /<title>GitHub Integration Is Here — LoomLance<\/title>/)
  assert.match(html, /<meta name="description" content="Link repos to projects\."/)
  assert.match(html, /property="og:title"/)
  assert.match(html, /rel="canonical" href="https:\/\/loomlance\.com\/blog\/github-integration"/)
})

test('rss is valid-ish and escapes', () => {
  const xml = renderRss([{ ...post, title: 'A & B' }])
  assert.match(xml, /<rss version="2.0"/)
  assert.match(xml, /A &amp; B/)
})

test('escapeXml', () => {
  assert.equal(escapeXml('<a>&"\''), '&lt;a&gt;&amp;&quot;&apos;')
})
```

- [ ] **Step 3: Run** — `npm test` — Expected: FAIL (module missing).

- [ ] **Step 4: Implement `scripts/blog-lib.mjs`**

Full implementation. The page templates MUST reuse the splash's existing head block (fonts, `app.css`, gtag), header/nav (with Blog added and marked active via `text-fg`), and footer — copy them from `index.html` into template-literal functions `pageShell({ title, description, canonical, og, bodyHtml })`. Key excerpts (write the complete file):

```javascript
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export const SITE_URL = 'https://loomlance.com'
export const CATEGORY_LABEL = { release: 'Feature release', update: 'Product update', press: 'Press' }

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
export function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function renderMarkdown(md) {
  return sanitizeHtml(marked.parse(md ?? ''), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'], a: ['href', 'rel', 'target'] },
  })
}

export function postHref(post) {
  return post.external_url || `${SITE_URL}/blog/${post.slug}`
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

// pageShell(...) — full HTML skeleton copied from index.html's head/header/footer,
// with <title>, meta description, canonical, og:title/og:description/og:image/og:type,
// nav "Blog" item, and ${bodyHtml} in <main>. og:image falls back to `${SITE_URL}/logo-1024.png`.

// renderIndexPage(posts): hero-less light page: PageHeader-style H1 "Blog",
// list of article rows (category chip, formatted date, title link via postHref —
// external ones get target="_blank" rel="noopener" and the ↗ affordance, internal ones plain),
// excerpt, optional cover thumbnail. Uses only Tailwind classes that exist on current pages
// plus prose classes (build:css is re-run after generation).

// renderPostPage(post): article page: category chip + date, H1 title, cover image (if any),
// <div class="prose">${renderMarkdown(post.body_md)}</div>, "← All posts" link to /blog.

// renderRss(posts): RSS 2.0, channel title "LoomLance Blog", link SITE_URL + /blog,
// item per post (title, link postHref, pubDate toUTCString, description = escaped excerpt, guid).

// renderSitemap(posts): urlset with static pages
// ['/', '/pricing', '/contact', '/signin', '/signup', '/terms', '/privacy', '/blog']
// + one <url> per internal (non-external_url) post.
```

(The four render functions must be fully written out in the file — the comments above describe required content, not optional behavior. Test-drive them with Step 2's assertions.)

- [ ] **Step 5: Run tests until green** — `npm test` — Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tailwind.config.js scripts/blog-lib.mjs scripts/blog-lib.test.mjs
git commit -m "feat(blog): template library with markdown sanitization, RSS, sitemap + tests"
```

---

### Task 11: Splash — generator script + local run

**Files (splash repo):**
- Create: `scripts/build-blog.mjs`

**Interfaces:**
- Consumes: `blog-lib.mjs` exports; env `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- Produces: writes `blog.html`, `blog/<slug>.html` (internal posts only), `blog/feed.xml`, `sitemap.xml`. Deletes stale `blog/*.html` not in the current published set (full regeneration).

- [ ] **Step 1: Implement**

```javascript
// scripts/build-blog.mjs — regenerates ALL blog output from the DB. Idempotent.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/build-blog.mjs
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises'
import { renderIndexPage, renderPostPage, renderRss, renderSitemap } from './blog-lib.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY'); process.exit(1) }

const res = await fetch(
  `${url}/rest/v1/posts?select=slug,title,excerpt,body_md,cover_image_url,category,external_url,published_at&status=eq.published&order=published_at.desc`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
)
if (!res.ok) { console.error(`Fetch failed: ${res.status} ${await res.text()}`); process.exit(1) }
const posts = await res.json()

await mkdir('blog', { recursive: true })

// Remove stale post pages (unpublished/deleted posts disappear on the next run)
const internal = posts.filter((p) => !p.external_url)
const keep = new Set(internal.map((p) => `${p.slug}.html`))
for (const f of await readdir('blog')) {
  if (f.endsWith('.html') && !keep.has(f)) await unlink(`blog/${f}`)
}

await writeFile('blog.html', renderIndexPage(posts))
for (const p of internal) await writeFile(`blog/${p.slug}.html`, renderPostPage(p))
await writeFile('blog/feed.xml', renderRss(posts))
await writeFile('sitemap.xml', renderSitemap(posts))

console.log(`Generated: blog.html, ${internal.length} post page(s), blog/feed.xml, sitemap.xml (${posts.length} published post(s))`)
```

- [ ] **Step 2: Local end-to-end run**

Insert one published test post in the dev DB (via admin UI from Task 7, or SQL), then:
```bash
SUPABASE_URL=https://zbipqfsqxnvrzhpdjvvy.supabase.co SUPABASE_ANON_KEY=<anon key> node scripts/build-blog.mjs
npm run build:css
```
Expected: files written; open `blog.html` via a local server (or headless-Edge screenshot, `--force-device-scale-factor=1`) — index and post page render in splash styling, prose styles apply, no unstyled markdown.

- [ ] **Step 3: Verify idempotency** — run the script twice; `git status` shows no diff after the second run.

- [ ] **Step 4: Commit** (commit the generated files too — they are the deployed site)

```bash
git add scripts/build-blog.mjs blog.html blog/ sitemap.xml app.css
git commit -m "feat(blog): generator script + first generated output"
```

---

### Task 12: Splash — Blog links in nav/footer of existing pages

**Files (splash repo):**
- Modify: `index.html`, `pricing.html`, `contact.html`, `signin.html`, `signup.html`, `terms.html`, `privacy.html`

- [ ] **Step 1: Add the link** — in each file: desktop nav (after "Pricing"), mobile menu (same position), and footer "Product" column:

```html
<a href="/blog" class="hidden rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:text-fg sm:block">Blog</a>
<!-- mobile menu variant: -->
<a href="/blog" class="rounded-md px-3 py-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg">Blog</a>
<!-- footer Product column: -->
<li><a href="/blog" class="hover:text-white">Blog</a></li>
```

Match each page's existing nav markup exactly (auth pages may have a reduced header — add Blog only where Features/Pricing already appear).

- [ ] **Step 2: Rebuild CSS + verify** — `npm run build:css`; screenshot `index.html` desktop + mobile; nav shows Blog, nothing wraps/overflows at 1440 and small widths.

- [ ] **Step 3: Commit**

```bash
git add *.html app.css
git commit -m "feat(blog): nav + footer links on all pages"
```

---

### Task 13: Splash — GitHub Action + owner setup + end-to-end verification

**Files (splash repo):**
- Create: `.github/workflows/blog.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Publish blog
on:
  repository_dispatch:
    types: [blog_publish]
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: blog-publish
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: node scripts/build-blog.mjs
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      - run: npm run build:css
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add blog.html blog/ sitemap.xml app.css
          git diff --cached --quiet && echo "No changes" && exit 0
          git commit -m "chore(blog): regenerate from CMS"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/blog.yml
git commit -m "ci: blog publish workflow (repository_dispatch)"
```

- [ ] **Step 3: OWNER checklist (cannot be done by the agent — present these to the owner)**

1. Create a **fine-grained GitHub PAT**: repo `MahmoudSabbagh84/loomlance-splah`, permissions **Contents: Read and write** (covers `repository_dispatch`), 1-year expiry.
2. `supabase secrets set GITHUB_BLOG_DISPATCH_TOKEN=<pat>` (dev project; repeat on prod at go-live).
3. Splash repo → Settings → Secrets and variables → Actions: add `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
4. Push both repos (Dashboard commits + splash commits).
5. Confirm `is_admin` is set on your profile in every environment you use.

- [ ] **Step 4: End-to-end verification (after owner completes Step 3)**

1. Admin → New post → category `release`, real markdown, cover image → **Publish**.
2. Toast appears; Actions run at `github.com/MahmoudSabbagh84/loomlance-splah/actions` goes green in ~1–2 min.
3. `https://loomlance.com/blog` shows the post; `https://loomlance.com/blog/<slug>` renders styled with correct `<title>`; `blog/feed.xml` parses; share the URL in a Slack/Discord DM → preview card shows title + excerpt (+ cover).
4. **If `/blog/<slug>` 404s but `/blog/<slug>.html` works:** the host's clean-URL rewrite doesn't cover subdirectories — add a rewrite rule in the hosting console (`/blog/<*> → /blog/<*>.html`, 200) — owner step; note it loudly in the handoff summary.
5. Unpublish the test post → run completes → post gone from `/blog`.

---

## Self-review notes

- **Spec coverage:** posts table + RLS (T1), is_admin (T1), blog-images (T1), reset_demo_user (T2), admin shell/gate/nav (T5), CMS list/editor/publish/unpublish/slug-lock/excerpt counter/cover upload/autosave-as-explicit-save (T6–T7; spec's "autosave" is implemented as explicit Save draft — acceptable v1 simplification, noted), Edge Function + JWT/admin check (T8), demo reset UI (T8), generator + RSS + sitemap + link-outs + SEO/OG (T10–T11), nav links (T12), workflow + failure behavior + owner secrets (T13), tests (T3, T5, T9, T10). Non-goals respected.
- **Deviation from spec:** "autosave to draft" → explicit "Save draft" button in v1 (silent background saves + slug generation interact badly; revisit if drafting feels lossy).
- **Type consistency:** `setPostStatus(id, status)` used by hook `useSetPostStatus({ id, status })`; generator consumes exact `posts` REST columns from T1; `postHref` used by index/RSS templates.
- **Known unknowns for the implementer:** exact `Badge`/`PageHeader` prop names (check the component files), `mapPostgresError` location, whether a shared `updated_at` trigger fn exists (T1 Step 1), fixture column lists (T2 Step 1). Each has an explicit in-task resolution step.
