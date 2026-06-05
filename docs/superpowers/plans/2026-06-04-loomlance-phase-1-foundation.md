# LoomLance Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of the LoomLance SaaS dashboard — auth, full data model on Supabase with RLS + tier-limit triggers, design system primitives, and CRUD-complete features for Clients, Projects (with kanban), Contracts, basic Invoices, basic Dashboard, and Profile. End state: a logged-in user can manage clients, run kanban boards, write invoices with line items and tax, and upload contract PDFs. No invoice PDF rendering, email sending, or Stripe Connect yet — those land in Phases 2–3.

**Architecture:** Greenfield rewrite in the same repo. `src/` is wiped and replaced with a layered structure (`app/` → `pages/` → `features/` → `hooks/` → `api/` → `lib/`). The `api/` layer is the only place that imports the Supabase client; `hooks/` wraps each API function in TanStack Query; UI consumes hooks only. RLS + Postgres triggers are the security boundary — frontend tier-gating is UX only.

**Tech Stack:** React 18, Vite, Tailwind (with CSS custom properties for theming), Supabase (Postgres + Auth + Storage + Edge Functions + `pg_cron`), TanStack Query v5, react-hook-form + zod, dnd-kit, sonner, react-router-dom v6, lucide-react, date-fns. Tests: Vitest + @testing-library/react, `supabase test db` for SQL, Playwright for E2E.

**Spec reference:** `docs/superpowers/specs/2026-06-04-loomlance-rebuild-design.md` (commit `0129d90`).

---

## Prerequisites (manual, one-time)

Before Task 1:

1. **Create a Supabase project** at https://supabase.com → "New Project". Note: project URL, `anon` public key, `service_role` key. Region: pick closest to your users.
2. **Install Supabase CLI** locally: `npm install -g supabase` (or use scoop on Windows). Verify with `supabase --version`.
3. **Install Docker Desktop** — required for `supabase start` (local dev DB) and `supabase test db`. Verify Docker is running before any Supabase CLI work.
4. **Vercel account** linked to the GitHub repo — only needed for Task 68 (deploy). Skip until then.

Environment variables used throughout (placed in `.env.local`, never committed):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_PUBLIC_SITE_URL=http://localhost:5173
VITE_SPLASH_URL=https://splash.loomlance.com   # for upgrade CTAs; placeholder is fine in dev
```

Add `.env.local` to `.gitignore` in Task 1.

---

## File Structure (after Phase 1)

```
src/
├── app/
│   ├── App.jsx
│   ├── main.jsx
│   ├── routes.jsx
│   └── providers.jsx
├── lib/
│   ├── supabase.js
│   ├── queryClient.js
│   ├── tier.js
│   ├── errors.js
│   ├── currency.js
│   ├── money.js
│   └── date.js
├── api/
│   ├── auth.js
│   ├── clients.js
│   ├── client-contacts.js
│   ├── projects.js
│   ├── kanban-columns.js
│   ├── tasks.js
│   ├── contracts.js
│   ├── invoices.js
│   ├── invoice-line-items.js
│   ├── invoice-payments.js
│   ├── notifications.js
│   ├── usage-events.js
│   └── schemas/
│       ├── clients.js
│       ├── client-contacts.js
│       ├── projects.js
│       ├── tasks.js
│       ├── kanban-columns.js
│       ├── contracts.js
│       ├── invoices.js
│       ├── invoice-line-items.js
│       └── invoice-payments.js
├── hooks/
│   ├── useAuth.js
│   ├── useProfile.js
│   ├── useClients.js
│   ├── useClientContacts.js
│   ├── useProjects.js
│   ├── useKanbanColumns.js
│   ├── useTasks.js
│   ├── useContracts.js
│   ├── useInvoices.js
│   ├── useInvoiceLineItems.js
│   ├── useInvoicePayments.js
│   └── useNotifications.js
├── features/
│   ├── auth/
│   ├── clients/
│   ├── projects/
│   ├── kanban/
│   ├── contracts/
│   ├── invoices/
│   ├── dashboard/
│   └── profile/
├── components/
│   ├── ui/
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Textarea.jsx
│   │   ├── Select.jsx
│   │   ├── Modal.jsx
│   │   ├── Drawer.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Table.jsx
│   │   ├── Tabs.jsx
│   │   ├── Badge.jsx
│   │   ├── Skeleton.jsx
│   │   └── Pagination.jsx
│   ├── layout/
│   │   ├── AppShell.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Topbar.jsx
│   │   └── NotificationBell.jsx
│   └── gates/
│       ├── TierGate.jsx
│       ├── UpgradeCard.jsx
│       └── UpgradeDialog.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── ForgotPasswordPage.jsx
│   ├── ResetPasswordPage.jsx
│   ├── DashboardPage.jsx
│   ├── ClientsPage.jsx
│   ├── ClientDetailPage.jsx
│   ├── ProjectsPage.jsx
│   ├── ProjectDetailPage.jsx
│   ├── ContractsPage.jsx
│   ├── ContractDetailPage.jsx
│   ├── InvoicesPage.jsx
│   ├── InvoiceDetailPage.jsx
│   ├── ProfilePage.jsx
│   └── NotFoundPage.jsx
└── styles/
    ├── tokens.css
    └── tailwind.css

supabase/
├── config.toml
├── migrations/
│   └── (timestamped .sql files)
└── tests/
    └── (timestamped .sql test files)

tests/
└── e2e/
    └── happy-path.spec.js   (Playwright)
```

---

## Milestones

- **M1 (Tasks 1–20):** App boots locally, login works against Supabase, schema is deployed, empty shell renders. End state: you can sign in to an empty app.
- **M2 (Tasks 21–30):** Full Clients CRUD with contacts and tags. End state: you can manage clients end-to-end.
- **M3 (Tasks 31–43):** Projects + full Kanban. End state: tier-gated project creation, drag-drop board with custom columns.
- **M4 (Tasks 44–54):** Contracts + basic Invoices (no PDF yet). End state: write invoices with line items / tax / multi-currency, upload signed contract PDFs.
- **M5 (Tasks 55–64):** Dashboard + Profile + Notifications + E2E + Deploy. End state: deployed to Vercel, one Playwright scenario passing.

Commit after every task. Push to main after every milestone.

---

## Common patterns (referenced throughout)

**API file shape** (`src/api/<entity>.js`):

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function list<Entities>({ search, sort, page, pageSize, ...filters } = {}) {
  let q = supabase.from('<table>').select('*', { count: 'exact' })
  if (search) q = q.ilike('name', `%${search}%`)
  // ...filters
  if (sort) q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  if (page != null) q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data, total: count }
}

export async function get<Entity>(id) {
  const { data, error } = await supabase.from('<table>').select('*').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function create<Entity>(input) {
  const { data, error } = await supabase.from('<table>').insert(input).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function update<Entity>(id, patch) {
  const { data, error } = await supabase.from('<table>').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function delete<Entity>(id) {
  const { error } = await supabase.from('<table>').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
```

**Hook file shape** (`src/hooks/use<Entities>.js`):

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/<entity>'

export function use<Entities>(params) {
  return useQuery({
    queryKey: ['<entity>', 'list', params],
    queryFn: () => api.list<Entities>(params),
  })
}

export function use<Entity>(id) {
  return useQuery({
    queryKey: ['<entity>', 'detail', id],
    queryFn: () => api.get<Entity>(id),
    enabled: !!id,
  })
}

export function useCreate<Entity>() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.create<Entity>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['<entity>'] }),
  })
}

export function useUpdate<Entity>() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.update<Entity>(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['<entity>', 'list'] })
      qc.invalidateQueries({ queryKey: ['<entity>', 'detail', id] })
    },
  })
}

export function useDelete<Entity>() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.delete<Entity>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['<entity>'] }),
  })
}
```

**Migration file naming:** `supabase/migrations/<UTC_TIMESTAMP>__<snake_case_description>.sql` (use `supabase migration new <description>` to scaffold).

**SQL test naming:** `supabase/tests/<UTC_TIMESTAMP>__test_<thing>.sql`. Tests use the `pgTAP`-style format that `supabase test db` runs.

**Commit messages:** Conventional Commits. `feat:`, `fix:`, `chore:`, `test:`, `db:`. Each commit ends with the `Co-Authored-By` line.

---

## Milestone 1 — Empty app boots with auth (Tasks 1–20)

### Task 1: Wipe existing src/, scaffold new folder structure, update .gitignore

**Files:**
- Delete: everything inside `src/` (current files from the prototype)
- Create: empty folders per File Structure above (so `git add` picks them up via `.gitkeep`)
- Modify: `.gitignore`

- [ ] **Step 1: Delete the existing src/ contents**

```bash
rm -rf src/
mkdir -p src/app src/lib src/api/schemas src/hooks src/features src/components/ui src/components/layout src/components/gates src/pages src/styles
```

- [ ] **Step 2: Add .gitkeep files so empty folders are tracked**

```bash
touch src/app/.gitkeep src/lib/.gitkeep src/api/.gitkeep src/api/schemas/.gitkeep src/hooks/.gitkeep src/features/.gitkeep src/components/ui/.gitkeep src/components/layout/.gitkeep src/components/gates/.gitkeep src/pages/.gitkeep src/styles/.gitkeep
```

- [ ] **Step 3: Update .gitignore to include .env.local and supabase local-state**

Append to `.gitignore`:

```
.env.local
.env.*.local
supabase/.branches
supabase/.temp
test-results/
playwright-report/
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: wipe src/ and scaffold new folder structure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Install dependencies and configure Vite/Tailwind/PostCSS

**Files:**
- Modify: `package.json`
- Replace: `tailwind.config.js`, `postcss.config.js`, `vite.config.js`
- Create: `src/styles/tailwind.css`, `index.html` (rewrite)

- [ ] **Step 1: Update package.json dependencies**

Replace the `dependencies` and `devDependencies` blocks with:

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@hookform/resolvers": "^3.3.4",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.51.0",
    "@tanstack/react-query-devtools": "^5.51.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.408.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.52.0",
    "react-router-dom": "^6.25.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^9.6.0",
    "eslint-plugin-react": "^7.34.3",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-plugin-react-refresh": "^0.4.7",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.3",
    "vitest": "^1.6.0"
  }
}
```

Also update `scripts`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext js,jsx --max-warnings 0",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "db:migrate:new": "supabase migration new"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 3: Replace vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
})
```

- [ ] **Step 4: Replace tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'bg-muted': 'var(--color-bg-muted)',
        fg: 'var(--color-fg)',
        'fg-muted': 'var(--color-fg-muted)',
        'fg-subtle': 'var(--color-fg-subtle)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          fg: 'var(--color-primary-fg)',
          hover: 'var(--color-primary-hover)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          fg: 'var(--color-accent-fg)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 5: Replace postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create src/styles/tailwind.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import './tokens.css';

@layer base {
  :root {
    color-scheme: light;
  }
  :root[data-theme='dark'] {
    color-scheme: dark;
  }
  body {
    @apply bg-bg text-fg antialiased;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  *:focus-visible {
    @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-bg;
  }
}
```

- [ ] **Step 7: Replace index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LoomLance</title>
    <meta name="description" content="LoomLance — all-in-one freelancer hub for clients, projects, contracts, and invoices." />
    <script>
      (() => {
        try {
          const saved = localStorage.getItem('loomlance-theme')
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          const theme = saved || (prefersDark ? 'dark' : 'light')
          document.documentElement.dataset.theme = theme
        } catch {}
      })()
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.jsx"></script>
  </body>
</html>
```

Note: the inline script sets `data-theme` before React mounts → eliminates FOUC.

- [ ] **Step 8: Verify dev server boots (will show blank page; that's fine)**

```bash
npm run dev
```

Expected: server starts at `http://localhost:5173`. Page is blank (no main.jsx yet). Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: install Phase 1 dependencies and base configs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Configure Vitest + create test-setup file

**Files:**
- Create: `src/test-setup.js`
- Create: `src/lib/__tests__/.gitkeep`

- [ ] **Step 1: Create src/test-setup.js**

```js
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 2: Add a sanity test at src/lib/__tests__/sanity.test.js**

```js
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 3: Run it**

```bash
npm run test:run
```

Expected: 1 test passing.

- [ ] **Step 4: Delete the sanity test**

```bash
rm src/lib/__tests__/sanity.test.js
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: configure Vitest and testing-library

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create src/lib/supabase.js and .env handling

**Files:**
- Create: `src/lib/supabase.js`
- Create: `.env.example`
- Create: `.env.local` (NOT committed — user fills in real values)

- [ ] **Step 1: Create .env.example**

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PUBLIC_SITE_URL=http://localhost:5173
VITE_SPLASH_URL=https://splash.loomlance.com
```

- [ ] **Step 2: Create .env.local with the real Supabase project values (from Prerequisites step 1)**

Same shape as `.env.example` but with real values. Do NOT commit.

- [ ] **Step 3: Create src/lib/supabase.js**

```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add .env.example src/lib/supabase.js .gitignore
git commit -m "feat: add Supabase client and env handling

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Initialize Supabase CLI in repo + link to remote project

**Files:**
- Create: `supabase/config.toml` (generated)
- Modify: `.gitignore` (already done)

- [ ] **Step 1: Initialize Supabase in the repo**

```bash
supabase init
```

Expected: creates `supabase/` folder with `config.toml` and `seed.sql`.

- [ ] **Step 2: Link to the remote Supabase project**

```bash
supabase link --project-ref <your-project-ref>
```

You'll be prompted for the database password (from the Supabase dashboard).

- [ ] **Step 3: Start local Supabase (Docker required)**

```bash
supabase start
```

Expected: prints local URLs (API, Studio, etc.) and an `anon key` for local dev. Note these — you may want a `.env.test.local` later for local-DB testing.

- [ ] **Step 4: Verify it's running**

```bash
supabase status
```

- [ ] **Step 5: Commit the config**

```bash
git add supabase/config.toml supabase/seed.sql
git commit -m "chore: initialize Supabase CLI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migration — profiles table + auth.users trigger + RLS

**Files:**
- Create: `supabase/migrations/<ts>__profiles.sql`

- [ ] **Step 1: Scaffold the migration**

```bash
supabase migration new profiles
```

- [ ] **Step 2: Fill in the migration file**

```sql
-- profiles: one row per auth user, written on signup via trigger
create type subscription_tier as enum ('free', 'tier_1', 'tier_2');
create type subscription_status as enum ('active', 'past_due', 'canceled', 'incomplete', 'trialing');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  business_name text,
  email text not null,
  default_currency text not null default 'USD',
  tax_id text,
  address text,
  logo_url text,
  invoice_accent_color text default '#2D3E50',
  invoice_footer text,
  stripe_connect_account_id text,
  subscription_tier subscription_tier not null default 'free',
  subscription_status subscription_status not null default 'active',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT or DELETE policies: profiles are managed by the trigger and webhook only.
-- subscription_tier and subscription_status are writeable by service_role only (no policy = denied for auth.uid()).
```

- [ ] **Step 3: Apply locally**

```bash
supabase db reset
```

Expected: reapplies all migrations against the local DB. Should succeed with no errors.

- [ ] **Step 4: Push to remote**

```bash
supabase db push
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "db: add profiles table with auth trigger and RLS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: SQL test for profiles RLS

**Files:**
- Create: `supabase/tests/profiles.sql`

- [ ] **Step 1: Create the test file**

```sql
begin;

select plan(5);

-- Create two test users
select tests.create_supabase_user('alice@test.com');
select tests.create_supabase_user('bob@test.com');

select tests.authenticate_as('alice@test.com');

-- Test 1: alice has a profile row auto-created
select isnt_empty(
  'select 1 from public.profiles where email = ''alice@test.com''',
  'alice profile auto-created by trigger'
);

-- Test 2: alice can read her own profile
select isnt_empty(
  'select 1 from public.profiles where id = auth.uid()',
  'alice can select her own profile'
);

-- Test 3: alice cannot read bob's profile
select is_empty(
  'select 1 from public.profiles where email = ''bob@test.com''',
  'alice cannot select bob profile'
);

-- Test 4: alice can update her own profile
select lives_ok(
  $$update public.profiles set business_name = 'Alice Co' where id = auth.uid()$$,
  'alice can update her own profile'
);

-- Test 5: alice cannot update subscription_tier (no policy allows it for end users)
update public.profiles set subscription_tier = 'tier_2' where id = auth.uid();
select is(
  (select subscription_tier::text from public.profiles where id = auth.uid()),
  'free',
  'alice cannot upgrade her own subscription_tier (write silently denied or unchanged)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it**

```bash
npm run db:test
```

Expected: 5 passing tests.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests
git commit -m "test(db): RLS coverage for profiles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Create src/lib/tier.js — feature matrix

**Files:**
- Create: `src/lib/tier.js`
- Create: `src/lib/__tests__/tier.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/tier.test.js
import { describe, it, expect } from 'vitest'
import { TIER_LIMITS, canCreateProject, hasFeature, FEATURES } from '@/lib/tier'

describe('TIER_LIMITS', () => {
  it('free allows 1 active project', () => {
    expect(TIER_LIMITS.free.maxActiveProjects).toBe(1)
  })
  it('tier_1 allows 5', () => {
    expect(TIER_LIMITS.tier_1.maxActiveProjects).toBe(5)
  })
  it('tier_2 is unlimited (Infinity)', () => {
    expect(TIER_LIMITS.tier_2.maxActiveProjects).toBe(Infinity)
  })
})

describe('canCreateProject', () => {
  it('free with 0 active → true', () => {
    expect(canCreateProject('free', 0)).toBe(true)
  })
  it('free with 1 active → false', () => {
    expect(canCreateProject('free', 1)).toBe(false)
  })
  it('tier_1 with 5 active → false', () => {
    expect(canCreateProject('tier_1', 5)).toBe(false)
  })
  it('tier_2 with 999 active → true', () => {
    expect(canCreateProject('tier_2', 999)).toBe(true)
  })
})

describe('hasFeature', () => {
  it('free cannot use recurring_invoices', () => {
    expect(hasFeature('free', FEATURES.RECURRING_INVOICES)).toBe(false)
  })
  it('tier_1 can use recurring_invoices', () => {
    expect(hasFeature('tier_1', FEATURES.RECURRING_INVOICES)).toBe(true)
  })
  it('tier_2 can use expenses', () => {
    expect(hasFeature('tier_2', FEATURES.EXPENSES)).toBe(true)
  })
  it('tier_1 cannot use expenses', () => {
    expect(hasFeature('tier_1', FEATURES.EXPENSES)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
npm run test:run -- tier
```

Expected: import error.

- [ ] **Step 3: Implement src/lib/tier.js**

```js
export const FEATURES = Object.freeze({
  CUSTOM_BRANDING: 'custom_branding',
  RECURRING_INVOICES: 'recurring_invoices',
  TIME_TRACKING: 'time_tracking',
  EXPENSES: 'expenses',
  REPORTS: 'reports',
})

export const TIER_LIMITS = Object.freeze({
  free: {
    maxActiveProjects: 1,
    features: new Set([]),
  },
  tier_1: {
    maxActiveProjects: 5,
    features: new Set([FEATURES.CUSTOM_BRANDING, FEATURES.RECURRING_INVOICES, FEATURES.TIME_TRACKING]),
  },
  tier_2: {
    maxActiveProjects: Infinity,
    features: new Set([
      FEATURES.CUSTOM_BRANDING,
      FEATURES.RECURRING_INVOICES,
      FEATURES.TIME_TRACKING,
      FEATURES.EXPENSES,
      FEATURES.REPORTS,
    ]),
  },
})

export function canCreateProject(tier, currentActiveCount) {
  const limit = TIER_LIMITS[tier]?.maxActiveProjects ?? 0
  return currentActiveCount < limit
}

export function hasFeature(tier, feature) {
  return TIER_LIMITS[tier]?.features.has(feature) ?? false
}

export const UPGRADE_COPY = Object.freeze({
  active_projects: {
    title: 'You’ve hit your project limit',
    body: (tier) =>
      tier === 'free'
        ? 'Free includes 1 active project. Upgrade to Tier 1 for 5, or Tier 2 for unlimited.'
        : 'Tier 1 includes 5 active projects. Upgrade to Tier 2 for unlimited.',
  },
  [FEATURES.CUSTOM_BRANDING]: {
    title: 'Brand your invoices',
    body: () => 'Add your logo, accent color, and custom footer. Available on Tier 1 and Tier 2.',
  },
  [FEATURES.RECURRING_INVOICES]: {
    title: 'Automate monthly billing',
    body: () => 'Set up recurring invoices that send themselves. Available on Tier 1 and Tier 2.',
  },
  [FEATURES.TIME_TRACKING]: {
    title: 'Track billable hours',
    body: () => 'Built-in timer and manual entries; generate invoices from tracked time. Tier 1 and Tier 2.',
  },
  [FEATURES.EXPENSES]: {
    title: 'Track expenses with receipts',
    body: () => 'Log expenses by category and project; upload receipts. Available on Tier 2.',
  },
  [FEATURES.REPORTS]: {
    title: 'Run revenue and P&L reports',
    body: () => 'Detailed reporting on revenue, profit & loss, aging, and time. Available on Tier 2.',
  },
})

export function getSplashUpgradeUrl(target) {
  const base = import.meta.env.VITE_SPLASH_URL || 'https://splash.loomlance.com'
  return `${base}/pricing?upgrade=${encodeURIComponent(target ?? 'tier_1')}`
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm run test:run -- tier
```

Expected: 11 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tier.js src/lib/__tests__/tier.test.js
git commit -m "feat: add tier feature matrix and gate helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Create src/lib/errors.js — Postgres error mapping

**Files:**
- Create: `src/lib/errors.js`
- Create: `src/lib/__tests__/errors.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/errors.test.js
import { describe, it, expect } from 'vitest'
import { mapPostgresError, AppError } from '@/lib/errors'

describe('mapPostgresError', () => {
  it('maps PROJECT_LIMIT_EXCEEDED raised by trigger to friendly message', () => {
    const supabaseError = { code: 'P0001', message: 'PROJECT_LIMIT_EXCEEDED' }
    const e = mapPostgresError(supabaseError)
    expect(e).toBeInstanceOf(AppError)
    expect(e.code).toBe('PROJECT_LIMIT_EXCEEDED')
    expect(e.userMessage).toMatch(/limit/i)
  })

  it('maps unique violation (23505) on invoices.invoice_number to INVOICE_NUMBER_TAKEN', () => {
    const supabaseError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "invoices_user_id_invoice_number_key"',
    }
    const e = mapPostgresError(supabaseError)
    expect(e.code).toBe('INVOICE_NUMBER_TAKEN')
  })

  it('falls back to UNKNOWN for unhandled errors', () => {
    const e = mapPostgresError({ code: '99999', message: 'weird' })
    expect(e.code).toBe('UNKNOWN')
    expect(e.userMessage).toMatch(/something went wrong/i)
  })

  it('passes through AppError instances unchanged', () => {
    const original = new AppError('STRIPE_NOT_CONNECTED', 'Connect Stripe first')
    expect(mapPostgresError(original)).toBe(original)
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
npm run test:run -- errors
```

- [ ] **Step 3: Implement src/lib/errors.js**

```js
export class AppError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage)
    this.code = code
    this.userMessage = userMessage
    this.cause = cause
  }
}

const CODE_MESSAGES = {
  PROJECT_LIMIT_EXCEEDED: 'You’ve hit your project limit. Upgrade to add more.',
  INVOICE_NUMBER_TAKEN: 'That invoice number is already in use. Pick a different one.',
  INVOICE_LIMIT_EXCEEDED: 'You’ve hit your invoice limit for this period.',
  STRIPE_NOT_CONNECTED: 'Connect your Stripe account in Profile → Payments first.',
  TIER_FEATURE_LOCKED: 'This feature is on a higher tier. Upgrade to use it.',
  UNAUTHORIZED: 'You don’t have permission to do that.',
  NOT_FOUND: 'Couldn’t find what you were looking for.',
  UNKNOWN: 'Something went wrong. Please try again.',
}

function detectCode(supabaseError) {
  // pgRST raises P0001 for raise exception; the trigger sets message = code keyword
  if (supabaseError.code === 'P0001' && supabaseError.message) {
    const code = supabaseError.message.trim().split(/\s+/)[0]
    if (CODE_MESSAGES[code]) return code
  }
  if (supabaseError.code === '23505') {
    const m = supabaseError.message || ''
    if (m.includes('invoices_user_id_invoice_number_key')) return 'INVOICE_NUMBER_TAKEN'
  }
  if (supabaseError.code === '42501' || supabaseError.code === 'PGRST301') return 'UNAUTHORIZED'
  if (supabaseError.code === 'PGRST116') return 'NOT_FOUND'
  return 'UNKNOWN'
}

export function mapPostgresError(err) {
  if (err instanceof AppError) return err
  const code = detectCode(err || {})
  return new AppError(code, CODE_MESSAGES[code], err)
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm run test:run -- errors
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.js src/lib/__tests__/errors.test.js
git commit -m "feat: add Postgres-error to user-message mapping

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Create lib/queryClient.js + currency.js + money.js + date.js

**Files:**
- Create: `src/lib/queryClient.js`
- Create: `src/lib/currency.js`
- Create: `src/lib/money.js`
- Create: `src/lib/date.js`
- Create tests for currency/money/date

- [ ] **Step 1: Write failing tests**

```js
// src/lib/__tests__/money.test.js
import { describe, it, expect } from 'vitest'
import { lineTotal, invoiceTotals } from '@/lib/money'

describe('lineTotal', () => {
  it('quantity * unit_price with no tax or discount', () => {
    expect(lineTotal({ quantity: 2, unit_price: 50, tax_rate: 0, discount_rate: 0 })).toEqual({
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
    })
  })
  it('applies discount before tax', () => {
    expect(
      lineTotal({ quantity: 1, unit_price: 100, tax_rate: 20, discount_rate: 10 })
    ).toEqual({ subtotal: 100, discount: 10, tax: 18, total: 108 })
  })
})

describe('invoiceTotals', () => {
  it('sums lines and groups tax by rate', () => {
    const r = invoiceTotals([
      { quantity: 1, unit_price: 100, tax_rate: 20, discount_rate: 0 },
      { quantity: 2, unit_price: 50, tax_rate: 20, discount_rate: 0 },
      { quantity: 1, unit_price: 50, tax_rate: 5, discount_rate: 0 },
    ])
    expect(r.subtotal).toBe(250)
    expect(r.discount).toBe(0)
    expect(r.taxByRate).toEqual({ 20: 40, 5: 2.5 })
    expect(r.totalTax).toBe(42.5)
    expect(r.total).toBe(292.5)
  })
})
```

```js
// src/lib/__tests__/currency.test.js
import { describe, it, expect } from 'vitest'
import { formatCurrency, SUPPORTED_CURRENCIES } from '@/lib/currency'

describe('SUPPORTED_CURRENCIES', () => {
  it('includes major currencies', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code)
    expect(codes).toEqual(expect.arrayContaining(['USD', 'EUR', 'GBP', 'CAD', 'AUD']))
  })
})

describe('formatCurrency', () => {
  it('formats USD with $', () => {
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toMatch(/\$1,234\.50/)
  })
  it('formats EUR with €', () => {
    expect(formatCurrency(1234.5, 'EUR', 'en-GB')).toMatch(/€1,234\.50/)
  })
})
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement src/lib/money.js**

```js
function round2(n) {
  return Math.round(n * 100) / 100
}

export function lineTotal({ quantity = 0, unit_price = 0, tax_rate = 0, discount_rate = 0 }) {
  const gross = quantity * unit_price
  const discount = round2(gross * (discount_rate / 100))
  const net = gross - discount
  const tax = round2(net * (tax_rate / 100))
  return {
    subtotal: round2(gross),
    discount,
    tax,
    total: round2(net + tax),
  }
}

export function invoiceTotals(lines) {
  let subtotal = 0
  let discount = 0
  const taxByRate = {}

  for (const line of lines) {
    const r = lineTotal(line)
    subtotal += r.subtotal
    discount += r.discount
    const rate = line.tax_rate ?? 0
    if (rate > 0) taxByRate[rate] = round2((taxByRate[rate] ?? 0) + r.tax)
  }

  const totalTax = round2(Object.values(taxByRate).reduce((a, b) => a + b, 0))
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxByRate,
    totalTax,
    total: round2(subtotal - discount + totalTax),
  }
}
```

- [ ] **Step 4: Implement src/lib/currency.js**

```js
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Pound Sterling' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
]

export function formatCurrency(amount, currency, locale) {
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
```

- [ ] **Step 5: Implement src/lib/date.js**

```js
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns'

export function formatDate(d, fmt = 'MMM d, yyyy') {
  if (!d) return ''
  return format(typeof d === 'string' ? parseISO(d) : d, fmt)
}

export function relativeTime(d) {
  if (!d) return ''
  return formatDistanceToNow(typeof d === 'string' ? parseISO(d) : d, { addSuffix: true })
}

export function isOverdue(dueDate, status) {
  if (!dueDate || status === 'paid' || status === 'void' || status === 'draft') return false
  return isPast(typeof dueDate === 'string' ? parseISO(dueDate) : dueDate)
}

export function daysUntil(d) {
  if (!d) return null
  const target = typeof d === 'string' ? parseISO(d) : d
  const ms = target.getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}
```

- [ ] **Step 6: Implement src/lib/queryClient.js**

```js
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error?.code === 'UNAUTHORIZED' || error?.code === 'NOT_FOUND') return false
        return failureCount < 3
      },
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
```

- [ ] **Step 7: Run tests, expect pass**

```bash
npm run test:run -- lib
```

- [ ] **Step 8: Commit**

```bash
git add src/lib
git commit -m "feat: add money, currency, date, and queryClient helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Create src/app/providers.jsx, main.jsx, and the entrypoint

**Files:**
- Create: `src/app/providers.jsx`
- Create: `src/app/main.jsx`
- Create: `src/app/App.jsx` (placeholder)

- [ ] **Step 1: Create src/app/providers.jsx**

```jsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Create src/app/App.jsx (placeholder for now)**

```jsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-fg-muted">LoomLance — placeholder. Routing wired in Task 12.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create src/app/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Providers } from './providers'
import App from './App'
import '@/styles/tailwind.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)
```

- [ ] **Step 4: Create src/styles/tokens.css (placeholder values — will refine in Task 14)**

```css
:root {
  --color-bg: #ffffff;
  --color-bg-elevated: #f8f9fa;
  --color-bg-muted: #eaecee;
  --color-fg: #1a242f;
  --color-fg-muted: #4b5456;
  --color-fg-subtle: #7f8c8d;
  --color-border: #e1e4e8;
  --color-border-strong: #c0c5cb;
  --color-primary: #2d3e50;
  --color-primary-fg: #ffffff;
  --color-primary-hover: #243342;
  --color-accent: #f39c12;
  --color-accent-fg: #1a242f;
  --color-success: #2ecc71;
  --color-warning: #f1c40f;
  --color-danger: #e74c3c;
  --color-info: #3498db;
}

:root[data-theme='dark'] {
  --color-bg: #1a242f;
  --color-bg-elevated: #2d3e50;
  --color-bg-muted: #243342;
  --color-fg: #eaecee;
  --color-fg-muted: #bdc3c7;
  --color-fg-subtle: #97a1a7;
  --color-border: #41576d;
  --color-border-strong: #5a7088;
  --color-primary: #4a7baf;
  --color-primary-fg: #ffffff;
  --color-primary-hover: #5d8cc0;
  --color-accent: #f5b342;
  --color-accent-fg: #1a242f;
  --color-success: #4ade80;
  --color-warning: #fcd34d;
  --color-danger: #f87171;
  --color-info: #60a5fa;
}
```

- [ ] **Step 5: Run dev server, verify it boots**

```bash
npm run dev
```

Expected: page shows "LoomLance — placeholder. Routing wired in Task 12."

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: bootstrap React entry with providers and theme tokens

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Create routes.jsx + AuthGate

**Files:**
- Create: `src/app/routes.jsx`
- Create: `src/features/auth/AuthGate.jsx`
- Create: `src/hooks/useAuth.js`
- Create: `src/api/auth.js`
- Create: `src/pages/NotFoundPage.jsx`
- Modify: `src/app/App.jsx`

- [ ] **Step 1: Create src/api/auth.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw mapPostgresError(error)
  return data.session
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw mapPostgresError(error)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw mapPostgresError(error)
}

export async function requestPasswordReset(email) {
  const redirectTo = `${import.meta.env.VITE_PUBLIC_SITE_URL}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw mapPostgresError(error)
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw mapPostgresError(error)
}

export function onAuthStateChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => handler(event, session))
  return () => data.subscription.unsubscribe()
}
```

- [ ] **Step 2: Create src/hooks/useAuth.js**

```js
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as auth from '@/api/auth'

export function useSession() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['session'], queryFn: auth.getSession, staleTime: 60_000 })

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChange((_event, session) => {
      qc.setQueryData(['session'], session)
      qc.invalidateQueries({ queryKey: ['profile'] })
    })
    return unsubscribe
  }, [qc])

  return q
}

export function useUser() {
  const { data: session, isLoading } = useSession()
  return { user: session?.user ?? null, isLoading }
}
```

- [ ] **Step 3: Create src/features/auth/AuthGate.jsx**

```jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '@/hooks/useAuth'

export function AuthGate({ children }) {
  const { user, isLoading } = useUser()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg-muted">
        Loading...
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
```

- [ ] **Step 4: Create src/pages/NotFoundPage.jsx**

```jsx
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-primary underline">
        Back to dashboard
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Create src/app/routes.jsx**

```jsx
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthGate } from '@/features/auth/AuthGate'
import LoginPage from '@/pages/LoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import ClientsPage from '@/pages/ClientsPage'
import ClientDetailPage from '@/pages/ClientDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import ContractsPage from '@/pages/ContractsPage'
import ContractDetailPage from '@/pages/ContractDetailPage'
import InvoicesPage from '@/pages/InvoicesPage'
import InvoiceDetailPage from '@/pages/InvoiceDetailPage'
import ProfilePage from '@/pages/ProfilePage'
import NotFoundPage from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Protected
  {
    path: '/',
    element: (
      <AuthGate>
        <Outlet />
      </AuthGate>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/:id', element: <ClientDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'contracts', element: <ContractsPage /> },
      { path: 'contracts/:id', element: <ContractDetailPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
```

- [ ] **Step 6: Create placeholder page files (one per route, minimal body)**

For each of `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `DashboardPage`, `ClientsPage`, `ClientDetailPage`, `ProjectsPage`, `ProjectDetailPage`, `ContractsPage`, `ContractDetailPage`, `InvoicesPage`, `InvoiceDetailPage`, `ProfilePage`, create a file like:

```jsx
// src/pages/<Name>Page.jsx
export default function <Name>Page() {
  return <div className="p-6"><h1 className="text-xl font-semibold">&lt;Name&gt;</h1></div>
}
```

The login/forgot/reset pages will be implemented properly in Tasks 18–19; everything else will be wired in later milestones.

- [ ] **Step 7: Replace src/app/App.jsx to use the router**

```jsx
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'

export default function App() {
  return <RouterProvider router={router} />
}
```

- [ ] **Step 8: Verify it boots — / redirects to /login (since not authed)**

```bash
npm run dev
```

Expected: navigating to `/` redirects to `/login`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: wire react-router with AuthGate and placeholder pages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Add useProfile hook (reads profiles table)

**Files:**
- Create: `src/api/profiles.js`
- Create: `src/hooks/useProfile.js`

- [ ] **Step 1: Create src/api/profiles.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function getMyProfile() {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateMyProfile(patch) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 2: Create src/hooks/useProfile.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/profiles'
import { useUser } from './useAuth'

export function useProfile() {
  const { user } = useUser()
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: api.getMyProfile,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateMyProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/profiles.js src/hooks/useProfile.js
git commit -m "feat: add profiles API and useProfile hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Create design-system primitives — Button, Input, Textarea, Select

**Files:**
- Create: `src/components/ui/cn.js`
- Create: `src/components/ui/Button.jsx`
- Create: `src/components/ui/Input.jsx`
- Create: `src/components/ui/Textarea.jsx`
- Create: `src/components/ui/Select.jsx`
- Create: `src/components/ui/Label.jsx`
- Create: `src/components/ui/FieldError.jsx`

- [ ] **Step 1: Create src/components/ui/cn.js**

```js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Create Button.jsx**

```jsx
import { forwardRef } from 'react'
import { cn } from './cn'

const VARIANTS = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-bg-elevated text-fg border border-border hover:bg-bg-muted',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-fg-muted hover:text-fg hover:bg-bg-muted',
  link: 'text-primary underline-offset-2 hover:underline px-0 py-0',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', disabled, loading, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin border-2 border-current border-r-transparent rounded-full" /> : null}
      {children}
    </button>
  )
})
```

- [ ] **Step 3: Create Input.jsx**

```jsx
import { forwardRef } from 'react'
import { cn } from './cn'

export const Input = forwardRef(function Input({ className, type = 'text', ...rest }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg',
        'placeholder:text-fg-subtle',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...rest}
    />
  )
})
```

- [ ] **Step 4: Create Textarea.jsx**

```jsx
import { forwardRef } from 'react'
import { cn } from './cn'

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg',
        'placeholder:text-fg-subtle',
        className
      )}
      {...rest}
    />
  )
})
```

- [ ] **Step 5: Create Select.jsx (native select; richer combobox can come later)**

```jsx
import { forwardRef } from 'react'
import { cn } from './cn'

export const Select = forwardRef(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
})
```

- [ ] **Step 6: Create Label.jsx and FieldError.jsx**

```jsx
// Label.jsx
import { cn } from './cn'
export function Label({ className, children, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-sm font-medium text-fg mb-1', className)}>
      {children}
      {required ? <span className="text-danger ml-0.5">*</span> : null}
    </label>
  )
}
```

```jsx
// FieldError.jsx
export function FieldError({ children }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-danger">{children}</p>
}
```

- [ ] **Step 7: Smoke-test Button renders**

```jsx
// src/components/ui/__tests__/Button.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })
  it('respects disabled', () => {
    render(<Button disabled>x</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

- [ ] **Step 8: Run tests**

```bash
npm run test:run -- Button
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): add Button, Input, Textarea, Select, Label, FieldError

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Modal + Drawer components

**Files:**
- Create: `src/components/ui/Modal.jsx`
- Create: `src/components/ui/Drawer.jsx`

- [ ] **Step 1: Create Modal.jsx**

```jsx
import { useEffect } from 'react'
import { cn } from './cn'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, size = 'md', className }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative w-full rounded-lg bg-bg shadow-2xl border border-border', sizes[size], className)}>
        {title ? (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="text-fg-subtle hover:text-fg" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        ) : null}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Drawer.jsx**

```jsx
import { useEffect } from 'react'
import { cn } from './cn'
import { X } from 'lucide-react'

export function Drawer({ open, onClose, title, children, side = 'right', width = 'w-[480px]' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sideClass = side === 'right' ? 'right-0' : 'left-0'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={cn('absolute top-0 bottom-0 bg-bg border-l border-border shadow-2xl flex flex-col', sideClass, width)}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): add Modal and Drawer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: ConfirmDialog, EmptyState, Tabs, Badge, Skeleton, Pagination

**Files:**
- Create each component in `src/components/ui/`

- [ ] **Step 1: Create ConfirmDialog.jsx**

```jsx
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Are you sure?',
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      {body ? <p className="text-sm text-fg-muted mb-5">{body}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Create EmptyState.jsx**

```jsx
import { cn } from './cn'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon ? <Icon className="size-12 text-fg-subtle mb-4" /> : null}
      <h3 className="text-base font-semibold text-fg mb-1">{title}</h3>
      {description ? <p className="text-sm text-fg-muted mb-5 max-w-md">{description}</p> : null}
      {action}
    </div>
  )
}
```

- [ ] **Step 3: Create Tabs.jsx (minimal, controlled)**

```jsx
import { cn } from './cn'

export function Tabs({ value, onChange, items }) {
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {items.map((item) => {
          const active = item.key === value
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                'whitespace-nowrap border-b-2 py-3 text-sm font-medium',
                active ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Create Badge.jsx**

```jsx
import { cn } from './cn'

const VARIANTS = {
  default: 'bg-bg-muted text-fg-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  primary: 'bg-primary/15 text-primary',
}

export function Badge({ variant = 'default', className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', VARIANTS[variant], className)}>
      {children}
    </span>
  )
}
```

- [ ] **Step 5: Create Skeleton.jsx**

```jsx
import { cn } from './cn'
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse bg-bg-muted rounded', className)} />
}
```

- [ ] **Step 6: Create Pagination.jsx**

```jsx
import { Button } from './Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs text-fg-muted">
        Page {page + 1} of {totalPages} — {total} total
      </p>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous">
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create Table.jsx (presentational; data comes from page)**

```jsx
import { cn } from './cn'

export function Table({ className, children }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-bg', className)}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  )
}
export function THead({ children }) {
  return <thead className="bg-bg-elevated text-xs uppercase tracking-wider text-fg-muted">{children}</thead>
}
export function TR({ children, className, onClick }) {
  return (
    <tr onClick={onClick} className={cn('border-t border-border', onClick && 'cursor-pointer hover:bg-bg-muted', className)}>
      {children}
    </tr>
  )
}
export function TH({ children, className }) {
  return <th className={cn('text-left font-medium px-4 py-3', className)}>{children}</th>
}
export function TD({ children, className }) {
  return <td className={cn('px-4 py-3', className)}>{children}</td>
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/ui
git commit -m "feat(ui): add ConfirmDialog, EmptyState, Tabs, Badge, Skeleton, Pagination, Table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: TierGate, UpgradeCard, UpgradeDialog

**Files:**
- Create: `src/components/gates/UpgradeCard.jsx`
- Create: `src/components/gates/UpgradeDialog.jsx`
- Create: `src/components/gates/TierGate.jsx`

- [ ] **Step 1: Create UpgradeCard.jsx**

```jsx
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UPGRADE_COPY, getSplashUpgradeUrl } from '@/lib/tier'

export function UpgradeCard({ feature, currentTier = 'free', target = 'tier_1', onDismiss }) {
  const copy = UPGRADE_COPY[feature]
  if (!copy) return null
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2">
          <Lock className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{copy.title}</h3>
          <p className="mt-1 text-sm text-fg-muted">{copy.body(currentTier)}</p>
          <div className="mt-4 flex gap-2">
            <Button as="a" onClick={() => window.open(getSplashUpgradeUrl(target), '_blank')}>
              See plans
            </Button>
            {onDismiss ? (
              <Button variant="ghost" onClick={onDismiss}>
                Maybe later
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create UpgradeDialog.jsx**

```jsx
import { Modal } from '@/components/ui/Modal'
import { UpgradeCard } from './UpgradeCard'

export function UpgradeDialog({ open, onClose, feature, currentTier, target }) {
  return (
    <Modal open={open} onClose={onClose} title="Upgrade required" size="md">
      <UpgradeCard feature={feature} currentTier={currentTier} target={target} onDismiss={onClose} />
    </Modal>
  )
}
```

- [ ] **Step 3: Create TierGate.jsx**

```jsx
import { useState } from 'react'
import { Lock } from 'lucide-react'
import { hasFeature } from '@/lib/tier'
import { UpgradeDialog } from './UpgradeDialog'
import { useProfile } from '@/hooks/useProfile'

/**
 * variant:
 *   "nav"     - render the child as-is but with a lock indicator; click opens UpgradeDialog
 *   "action"  - render children normally; expose a check function via children-as-function pattern
 *   "inline"  - render disabled placeholder with a "Tier X feature" pill
 */
export function TierGate({ feature, variant = 'inline', target = 'tier_1', children, fallback }) {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [open, setOpen] = useState(false)

  if (hasFeature(tier, feature)) return children

  if (variant === 'nav') {
    return (
      <>
        <button onClick={() => setOpen(true)} className="w-full text-left">
          {typeof children === 'function' ? children({ locked: true }) : children}
        </button>
        <UpgradeDialog open={open} onClose={() => setOpen(false)} feature={feature} currentTier={tier} target={target} />
      </>
    )
  }

  if (variant === 'action') {
    return typeof children === 'function' ? children({ locked: true, openUpgrade: () => setOpen(true) }) : null
  }

  // inline
  if (fallback) return fallback
  return (
    <div className="rounded-md border border-dashed border-border bg-bg-muted/40 p-4 text-center text-sm text-fg-muted">
      <Lock className="size-4 inline mr-1.5 -mt-0.5" />
      Available on {target.replace('_', ' ')}. <button className="text-primary underline" onClick={() => setOpen(true)}>Learn more</button>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} feature={feature} currentTier={tier} target={target} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/gates
git commit -m "feat(gates): add TierGate, UpgradeCard, UpgradeDialog

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: AppShell + Sidebar + Topbar (theme toggle, account menu)

**Files:**
- Create: `src/features/auth/useSignOut.js`
- Create: `src/hooks/useTheme.js`
- Create: `src/components/layout/AppShell.jsx`
- Create: `src/components/layout/Sidebar.jsx`
- Create: `src/components/layout/Topbar.jsx`
- Create: `src/components/layout/NotificationBell.jsx`
- Modify: `src/app/routes.jsx` (wrap protected children in `<AppShell>`)

- [ ] **Step 1: Create useTheme hook**

```js
// src/hooks/useTheme.js
import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('loomlance-theme', theme)
    } catch {}
  }, [theme])
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
```

- [ ] **Step 2: Create useSignOut hook**

```js
// src/features/auth/useSignOut.js
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as auth from '@/api/auth'

export function useSignOut() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  return async () => {
    try {
      await auth.signOut()
      qc.clear()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(e.userMessage || 'Sign out failed')
    }
  }
}
```

- [ ] **Step 3: Create NotificationBell.jsx (read-only stub for Phase 1)**

```jsx
import { Bell } from 'lucide-react'

export function NotificationBell() {
  return (
    <button className="relative text-fg-muted hover:text-fg" aria-label="Notifications">
      <Bell className="size-5" />
    </button>
  )
}
```

- [ ] **Step 4: Create Sidebar.jsx**

```jsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileCheck,
  FileText,
  Clock,
  Receipt,
  BarChart3,
  Lock,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useProfile } from '@/hooks/useProfile'
import { hasFeature, FEATURES } from '@/lib/tier'
import { useState } from 'react'
import { UpgradeDialog } from '@/components/gates/UpgradeDialog'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/contracts', label: 'Contracts', icon: FileCheck },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/time', label: 'Time', icon: Clock, feature: FEATURES.TIME_TRACKING, target: 'tier_1' },
  { to: '/expenses', label: 'Expenses', icon: Receipt, feature: FEATURES.EXPENSES, target: 'tier_2' },
  { to: '/reports', label: 'Reports', icon: BarChart3, feature: FEATURES.REPORTS, target: 'tier_2' },
]

export function Sidebar() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const [lockedFeature, setLockedFeature] = useState(null)

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <img src="/logo.png" alt="" className="size-8" />
        <span className="ml-2 font-bold">
          <span className="text-primary">Loom</span>
          <span className="text-fg-muted">Lance</span>
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const locked = item.feature && !hasFeature(tier, item.feature)
          if (locked) {
            return (
              <button
                key={item.label}
                onClick={() => setLockedFeature({ feature: item.feature, target: item.target })}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-fg-subtle hover:bg-bg-muted"
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{item.label}</span>
                <Lock className="size-3" />
              </button>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:text-fg hover:bg-bg-muted'
                )
              }
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      {lockedFeature ? (
        <UpgradeDialog
          open
          onClose={() => setLockedFeature(null)}
          feature={lockedFeature.feature}
          currentTier={tier}
          target={lockedFeature.target}
        />
      ) : null}
    </aside>
  )
}
```

- [ ] **Step 5: Create Topbar.jsx**

```jsx
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Moon, Sun, User, ChevronDown, LogOut, UserCircle, CreditCard } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useProfile } from '@/hooks/useProfile'
import { useSignOut } from '@/features/auth/useSignOut'
import { NotificationBell } from './NotificationBell'

export function Topbar() {
  const { theme, toggle } = useTheme()
  const { data: profile } = useProfile()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initial = (profile?.display_name || profile?.email || '?').charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-border bg-bg px-6">
      <NotificationBell />
      <button onClick={toggle} className="text-fg-muted hover:text-fg" aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-md p-1 hover:bg-bg-muted">
          <div className="size-8 rounded-full bg-primary text-primary-fg flex items-center justify-center text-sm font-semibold">
            {initial}
          </div>
          <ChevronDown className="size-4 text-fg-muted" />
        </button>
        {open ? (
          <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-bg shadow-lg py-1">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
              <p className="text-xs text-fg-muted truncate">{profile?.email}</p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <UserCircle className="size-4" />
              Profile
            </button>
            <Link
              to="/profile?tab=subscription"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <CreditCard className="size-4" />
              Subscription
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
```

- [ ] **Step 6: Create AppShell.jsx**

```jsx
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 bg-bg">
          <div className="mx-auto max-w-7xl p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Wrap protected routes in AppShell — update src/app/routes.jsx**

Change the protected route element to:

```jsx
import { AppShell } from '@/components/layout/AppShell'
// ...
{
  path: '/',
  element: (
    <AuthGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGate>
  ),
  children: [ /* ...unchanged... */ ],
},
```

- [ ] **Step 8: Verify it boots (must be logged in to see — for now sidebar will be invisible)**

```bash
npm run dev
```

Expected: `/` still redirects to `/login`. We'll be able to see the shell after Task 19 (login implemented).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add AppShell with Sidebar (tier-aware nav) and Topbar (theme/account)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: LoginPage with Supabase auth

**Files:**
- Modify: `src/pages/LoginPage.jsx`

- [ ] **Step 1: Implement LoginPage**

```jsx
import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import * as auth from '@/api/auth'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      await auth.signInWithPassword(values)
      const to = location.state?.from || '/'
      navigate(to, { replace: true })
    } catch (e) {
      toast.error(e.userMessage || 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="" className="mx-auto size-16 mb-4" />
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Loom</span>
            <span className="text-fg-muted">Lance</span>
          </h1>
          <p className="mt-2 text-sm text-fg-muted">Weave it all together</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-border bg-bg-elevated p-6">
          <div>
            <Label htmlFor="email" required>Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="password" required>Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={submitting}>
            <LogIn className="size-4" />
            Sign in
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
            <a
              href={import.meta.env.VITE_SPLASH_URL || 'https://loomlance.com'}
              className="text-fg-muted hover:text-fg"
            >
              Don't have an account?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manual test — sign in works**

You need a test user. In the Supabase dashboard → Authentication → Users → Add User. Use `test@loomlance.local` / `password123`.

```bash
npm run dev
```

Navigate to `/login`. Sign in. Expected: redirect to `/` and see the AppShell.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LoginPage.jsx
git commit -m "feat(auth): implement Supabase login with form validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Forgot/Reset password pages

**Files:**
- Modify: `src/pages/ForgotPasswordPage.jsx`
- Modify: `src/pages/ResetPasswordPage.jsx`

- [ ] **Step 1: Implement ForgotPasswordPage**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import * as auth from '@/api/auth'

const schema = z.object({ email: z.string().email() })

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setSubmitting(true)
    try {
      await auth.requestPasswordReset(email)
      setSent(true)
    } catch (e) {
      toast.error(e.userMessage || 'Failed to send reset email')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-6">
        <h1 className="text-xl font-semibold mb-1">Reset your password</h1>
        <p className="text-sm text-fg-muted mb-6">We’ll email you a link to set a new one.</p>
        {sent ? (
          <p className="text-sm">Check your email for the reset link.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            <Button type="submit" className="w-full" loading={submitting}>Send reset link</Button>
          </form>
        )}
        <p className="mt-4 text-sm">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement ResetPasswordPage**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import * as auth from '@/api/auth'

const schema = z.object({
  password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords must match', path: ['confirm'] })

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ password }) => {
    setSubmitting(true)
    try {
      await auth.updatePassword(password)
      toast.success('Password updated')
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(e.userMessage || 'Failed to update password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-6">
        <h1 className="text-xl font-semibold mb-6">Set a new password</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="password" required>New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="confirm" required>Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
            <FieldError>{errors.confirm?.message}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={submitting}>Update password</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Configure Supabase email redirect**

In Supabase dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:5173`
- Redirect URLs: add `http://localhost:5173/reset-password`

(Update with production URLs in Task 68.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/ForgotPasswordPage.jsx src/pages/ResetPasswordPage.jsx
git commit -m "feat(auth): implement forgot/reset password flows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

**End of Milestone 1.** Push to remote:

```bash
git push origin main
```

---

## Milestone 2 — Clients fully working (Tasks 21–33)

### Task 21: Migration — clients + client_contacts + RLS

**Files:**
- Create: `supabase/migrations/<ts>__clients.sql`

- [ ] **Step 1: Scaffold the migration**

```bash
supabase migration new clients
```

- [ ] **Step 2: Fill in the migration**

```sql
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on public.clients (user_id);
create index clients_user_id_name_idx on public.clients (user_id, name);
create index clients_archived_at_idx on public.clients (user_id) where archived_at is null;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_select_own" on public.clients for select using (user_id = auth.uid());
create policy "clients_insert_own" on public.clients for insert with check (user_id = auth.uid());
create policy "clients_update_own" on public.clients for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clients_delete_own" on public.clients for delete using (user_id = auth.uid());

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_contacts_client_id_idx on public.client_contacts (client_id);

create trigger client_contacts_set_updated_at
  before update on public.client_contacts
  for each row execute function public.set_updated_at();

-- Enforce at most one primary contact per client
create unique index client_contacts_one_primary_per_client
  on public.client_contacts (client_id)
  where is_primary;

alter table public.client_contacts enable row level security;

create policy "client_contacts_select_own" on public.client_contacts for select using (user_id = auth.uid());
create policy "client_contacts_insert_own" on public.client_contacts for insert with check (user_id = auth.uid());
create policy "client_contacts_update_own" on public.client_contacts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "client_contacts_delete_own" on public.client_contacts for delete using (user_id = auth.uid());
```

- [ ] **Step 3: Apply locally and push**

```bash
supabase db reset
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "db: add clients and client_contacts tables with RLS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: SQL test for clients RLS

**Files:**
- Create: `supabase/tests/clients.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(6);

select tests.create_supabase_user('alice@test.com');
select tests.create_supabase_user('bob@test.com');

select tests.authenticate_as('alice@test.com');

-- 1: alice can insert her own client
select lives_ok(
  $$insert into public.clients (user_id, name) values (auth.uid(), 'Acme Co')$$,
  'alice can insert her own client'
);

-- 2: alice can read her own client
select isnt_empty(
  $$select 1 from public.clients where name = 'Acme Co'$$,
  'alice can read her own client'
);

-- 3: alice cannot insert a client for bob
select throws_ok(
  $$insert into public.clients (user_id, name)
    values ((select id from auth.users where email = 'bob@test.com'), 'Hijack Co')$$,
  '42501',
  null,
  'alice cannot insert a client for bob'
);

select tests.authenticate_as('bob@test.com');

-- 4: bob cannot read alice's client
select is_empty(
  $$select 1 from public.clients where name = 'Acme Co'$$,
  'bob cannot read alice client'
);

-- 5: bob cannot update alice's client
update public.clients set name = 'Hijacked' where name = 'Acme Co';
select tests.authenticate_as('alice@test.com');
select is(
  (select name from public.clients where user_id = auth.uid() limit 1),
  'Acme Co',
  'bob update did not affect alice client'
);

-- 6: only one primary contact per client enforced
insert into public.clients (id, user_id, name) values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'X');
insert into public.client_contacts (user_id, client_id, name, is_primary) values (auth.uid(), '11111111-1111-1111-1111-111111111111', 'A', true);
select throws_ok(
  $$insert into public.client_contacts (user_id, client_id, name, is_primary)
    values (auth.uid(), '11111111-1111-1111-1111-111111111111', 'B', true)$$,
  '23505',
  null,
  'cannot have two primary contacts per client'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

```bash
npm run db:test
```

Expected: 6 passing.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/clients.sql
git commit -m "test(db): RLS and primary-contact uniqueness for clients

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 23: Zod schemas for clients + client_contacts

**Files:**
- Create: `src/api/schemas/clients.js`
- Create: `src/api/schemas/client-contacts.js`

- [ ] **Step 1: Create clients schema**

```js
// src/api/schemas/clients.js
import { z } from 'zod'

export const clientCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  company: z.string().max(200).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
})

export const clientUpdateSchema = clientCreateSchema.partial()
```

- [ ] **Step 2: Create client-contacts schema**

```js
// src/api/schemas/client-contacts.js
import { z } from 'zod'

export const clientContactCreateSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  role: z.string().max(100).optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
})

export const clientContactUpdateSchema = clientContactCreateSchema.partial()
```

- [ ] **Step 3: Commit**

```bash
git add src/api/schemas
git commit -m "feat(schemas): add client and contact zod schemas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 24: api/clients.js + tests

**Files:**
- Create: `src/api/clients.js`
- Create: `src/api/__tests__/clients.test.js`

- [ ] **Step 1: Implement api/clients.js (follows the common API pattern at the top of this doc)**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listClients({ search = '', sort = { field: 'name', dir: 'asc' }, page = 0, pageSize = 25, includeArchived = false } = {}) {
  let q = supabase.from('clients').select('*', { count: 'exact' })
  if (!includeArchived) q = q.is('archived_at', null)
  if (search) q = q.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`)
  q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data || [], total: count || 0 }
}

export async function getClient(id) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createClient(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('clients').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateClient(id, patch) {
  const { data, error } = await supabase.from('clients').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function archiveClient(id) {
  return updateClient(id, { archived_at: new Date().toISOString() })
}

export async function unarchiveClient(id) {
  return updateClient(id, { archived_at: null })
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
```

- [ ] **Step 2: Write a test for the search OR clause (verifies our query shape is correct)**

```js
// src/api/__tests__/clients.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

const orMock = vi.fn()
const orderMock = vi.fn()
const rangeMock = vi.fn()
const isMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => {
  const chain = {
    select: (...a) => { selectMock(...a); return chain },
    is: (...a) => { isMock(...a); return chain },
    or: (...a) => { orMock(...a); return chain },
    order: (...a) => { orderMock(...a); return chain },
    range: (...a) => { rangeMock(...a); return Promise.resolve({ data: [], error: null, count: 0 }) },
  }
  return {
    supabase: {
      from: (...a) => { fromMock(...a); return chain },
      auth: { getSession: async () => ({ session: { user: { id: 'u1' } } }) },
    },
  }
})

import { listClients } from '@/api/clients'

describe('listClients', () => {
  beforeEach(() => {
    orMock.mockClear(); orderMock.mockClear(); rangeMock.mockClear(); isMock.mockClear(); selectMock.mockClear(); fromMock.mockClear()
  })

  it('filters out archived by default', async () => {
    await listClients()
    expect(isMock).toHaveBeenCalledWith('archived_at', null)
  })

  it('builds an OR ilike query for search', async () => {
    await listClients({ search: 'acme' })
    const arg = orMock.mock.calls[0][0]
    expect(arg).toMatch(/name\.ilike\.%acme%/)
    expect(arg).toMatch(/company\.ilike\.%acme%/)
    expect(arg).toMatch(/email\.ilike\.%acme%/)
  })

  it('uses page/pageSize for range', async () => {
    await listClients({ page: 2, pageSize: 10 })
    expect(rangeMock).toHaveBeenCalledWith(20, 29)
  })
})
```

- [ ] **Step 3: Run**

```bash
npm run test:run -- clients
```

Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/api/clients.js src/api/__tests__/clients.test.js
git commit -m "feat(api): clients CRUD + archive helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 25: api/client-contacts.js

**Files:**
- Create: `src/api/client-contacts.js`

- [ ] **Step 1: Implement**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listContacts(clientId) {
  const { data, error } = await supabase
    .from('client_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createContact(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('client_contacts').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateContact(id, patch) {
  const { data, error } = await supabase.from('client_contacts').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteContact(id) {
  const { error } = await supabase.from('client_contacts').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function setPrimary(contactId, clientId) {
  // Unset other primaries first, then set this one. Done as two ops to keep RLS simple.
  const { error: e1 } = await supabase
    .from('client_contacts')
    .update({ is_primary: false })
    .eq('client_id', clientId)
    .eq('is_primary', true)
  if (e1) throw mapPostgresError(e1)
  const { data, error: e2 } = await supabase
    .from('client_contacts')
    .update({ is_primary: true })
    .eq('id', contactId)
    .select()
    .single()
  if (e2) throw mapPostgresError(e2)
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/client-contacts.js
git commit -m "feat(api): client contacts CRUD with setPrimary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 26: hooks/useClients.js + useClientContacts.js

**Files:**
- Create: `src/hooks/useClients.js`
- Create: `src/hooks/useClientContacts.js`

- [ ] **Step 1: useClients.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/clients'

export function useClients(params) {
  return useQuery({
    queryKey: ['clients', 'list', params],
    queryFn: () => api.listClients(params),
    keepPreviousData: true,
  })
}

export function useClient(id) {
  return useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => api.getClient(id),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updateClient(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients', 'list'] })
      qc.invalidateQueries({ queryKey: ['clients', 'detail', id] })
    },
  })
}

export function useArchiveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
```

- [ ] **Step 2: useClientContacts.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/client-contacts'

export function useClientContacts(clientId) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: () => api.listContacts(clientId),
    enabled: !!clientId,
  })
}

function useInvalidate(clientId) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['client-contacts', clientId] })
}

export function useCreateContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: api.createContact, onSuccess: invalidate })
}
export function useUpdateContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: ({ id, patch }) => api.updateContact(id, patch), onSuccess: invalidate })
}
export function useDeleteContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: api.deleteContact, onSuccess: invalidate })
}
export function useSetPrimaryContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: (contactId) => api.setPrimary(contactId, clientId), onSuccess: invalidate })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useClients.js src/hooks/useClientContacts.js
git commit -m "feat(hooks): useClients and useClientContacts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 27: Clients list page (table + search + pagination)

**Files:**
- Create: `src/features/clients/ClientFormModal.jsx` (used in Task 28; create empty stub now)
- Modify: `src/pages/ClientsPage.jsx`

- [ ] **Step 1: Stub ClientFormModal**

```jsx
// src/features/clients/ClientFormModal.jsx
export function ClientFormModal() { return null }
```

- [ ] **Step 2: Implement ClientsPage**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { ClientFormModal } from '@/features/clients/ClientFormModal'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 250)
  const [formOpen, setFormOpen] = useState(false)
  const pageSize = 25

  const { data, isLoading } = useClients({ search: debouncedSearch, page, pageSize })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-fg-muted">Manage your client relationships</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          New client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Search by name, company, or email"
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : data?.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to start tracking projects and invoices."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New client</Button>}
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Company</TH>
                <TH>Email</TH>
                <TH>Tags</TH>
              </TR>
            </THead>
            <tbody>
              {data.rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link to={`/clients/${c.id}`} className="font-medium text-fg hover:text-primary">
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-fg-muted">{c.company || '—'}</TD>
                  <TD className="text-fg-muted">{c.email || '—'}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => <Badge key={t}>{t}</Badge>)}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={pageSize} total={data.total} onChange={setPage} />
        </>
      )}

      {formOpen ? <ClientFormModal open onClose={() => setFormOpen(false)} /> : null}
    </div>
  )
}
```

- [ ] **Step 3: Add a useDebouncedValue hook**

```js
// src/hooks/useDebouncedValue.js
import { useEffect, useState } from 'react'

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
```

- [ ] **Step 4: Manual test — page loads with empty state**

```bash
npm run dev
```

Sign in, navigate to /clients. Expected: empty state with "New client" CTA.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ClientsPage.jsx src/features/clients src/hooks/useDebouncedValue.js
git commit -m "feat(clients): list page with search and pagination

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 28: Client form modal (create/edit with tags)

**Files:**
- Create: `src/components/ui/TagInput.jsx`
- Replace: `src/features/clients/ClientFormModal.jsx`

- [ ] **Step 1: Create TagInput.jsx**

```jsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from './cn'

export function TagInput({ value = [], onChange, placeholder = 'Add tag and press Enter' }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (value.includes(v)) { setDraft(''); return }
    onChange([...value, v])
    setDraft('')
  }
  const remove = (t) => onChange(value.filter((x) => x !== t))
  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-md border border-border bg-bg px-2 py-1.5 min-h-[2.5rem]')}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-xs">
          {t}
          <button onClick={() => remove(t)} className="text-fg-subtle hover:text-fg" aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 bg-transparent text-sm outline-none min-w-[8rem] px-1"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !draft && value.length) { onChange(value.slice(0, -1)) }
        }}
        onBlur={add}
      />
    </div>
  )
}
```

- [ ] **Step 2: Replace ClientFormModal**

```jsx
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { TagInput } from '@/components/ui/TagInput'
import { clientCreateSchema } from '@/api/schemas/clients'
import { useCreateClient, useUpdateClient } from '@/hooks/useClients'

export function ClientFormModal({ open, onClose, client }) {
  const isEdit = !!client
  const create = useCreateClient()
  const update = useUpdateClient()
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      name: client?.name ?? '',
      company: client?.company ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      address: client?.address ?? '',
      notes: client?.notes ?? '',
      tags: client?.tags ?? [],
    },
  })

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: client.id, patch: values })
        toast.success('Client updated')
      } else {
        await create.mutateAsync(values)
        toast.success('Client created')
      }
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit client' : 'New client'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" required>Name</Label>
            <Input id="name" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input id="company" {...register('company')} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" rows={2} {...register('address')} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} {...register('notes')} />
        </div>
        <div>
          <Label>Tags</Label>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => <TagInput value={field.value} onChange={field.onChange} />}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 3: Manual test — create a client, see it in the list**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(clients): create/edit form modal with tags

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 29: Client detail page — header + tabs scaffold

**Files:**
- Modify: `src/pages/ClientDetailPage.jsx`
- Create: `src/features/clients/ClientHeader.jsx`
- Create: `src/features/clients/tabs/OverviewTab.jsx`
- Create: `src/features/clients/tabs/ContactsTab.jsx`
- Create: `src/features/clients/tabs/ProjectsTab.jsx`
- Create: `src/features/clients/tabs/ContractsTab.jsx`
- Create: `src/features/clients/tabs/InvoicesTab.jsx`
- Create: `src/features/clients/tabs/ActivityTab.jsx`

- [ ] **Step 1: Implement ClientHeader.jsx**

```jsx
import { useState } from 'react'
import { Edit, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ClientFormModal } from './ClientFormModal'
import { useArchiveClient, useDeleteClient } from '@/hooks/useClients'

export function ClientHeader({ client }) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const archive = useArchiveClient()
  const del = useDeleteClient()

  const onArchive = async () => {
    try {
      await archive.mutateAsync(client.id)
      toast.success(client.archived_at ? 'Client unarchived' : 'Client archived')
    } catch (e) {
      toast.error(e.userMessage)
    }
  }

  const onDelete = async () => {
    try {
      await del.mutateAsync(client.id)
      toast.success('Client deleted')
      navigate('/clients', { replace: true })
    } catch (e) {
      toast.error(e.userMessage)
    }
  }

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        {client.company ? <p className="text-fg-muted">{client.company}</p> : null}
        {(client.tags || []).length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {client.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          <Edit className="size-4" /> Edit
        </Button>
        <Button variant="secondary" onClick={onArchive}>
          {client.archived_at ? <><ArchiveRestore className="size-4" /> Unarchive</> : <><Archive className="size-4" /> Archive</>}
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
      {editOpen ? <ClientFormModal open onClose={() => setEditOpen(false)} client={client} /> : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete client?"
        body="This permanently removes the client. Their invoices and contracts will be orphaned. Consider archiving instead."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={del.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 2: Stub the other tabs (real content lands in later tasks / phases)**

```jsx
// src/features/clients/tabs/OverviewTab.jsx
export function OverviewTab({ client }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Contact</h3>
        <dl className="text-sm space-y-1">
          <div><dt className="inline text-fg-muted">Email: </dt><dd className="inline">{client.email || '—'}</dd></div>
          <div><dt className="inline text-fg-muted">Phone: </dt><dd className="inline">{client.phone || '—'}</dd></div>
          <div><dt className="inline text-fg-muted">Address: </dt><dd className="inline whitespace-pre-line">{client.address || '—'}</dd></div>
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">Notes</h3>
        <p className="text-sm whitespace-pre-line">{client.notes || '—'}</p>
      </div>
    </div>
  )
}
```

```jsx
// src/features/clients/tabs/ProjectsTab.jsx
export function ProjectsTab() {
  return <p className="text-sm text-fg-muted">Projects for this client will appear here. (Wired in Task 39.)</p>
}
```

```jsx
// src/features/clients/tabs/ContractsTab.jsx
export function ContractsTab() {
  return <p className="text-sm text-fg-muted">Contracts for this client will appear here. (Wired in Task 51.)</p>
}
```

```jsx
// src/features/clients/tabs/InvoicesTab.jsx
export function InvoicesTab() {
  return <p className="text-sm text-fg-muted">Invoices for this client will appear here. (Wired in Task 54.)</p>
}
```

```jsx
// src/features/clients/tabs/ActivityTab.jsx
export function ActivityTab() {
  return <p className="text-sm text-fg-muted">Activity timeline appears here. (Phase 2.)</p>
}
```

- [ ] **Step 3: Implement ClientDetailPage**

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClient } from '@/hooks/useClients'
import { Tabs } from '@/components/ui/Tabs'
import { Skeleton } from '@/components/ui/Skeleton'
import { ClientHeader } from '@/features/clients/ClientHeader'
import { OverviewTab } from '@/features/clients/tabs/OverviewTab'
import { ContactsTab } from '@/features/clients/tabs/ContactsTab'
import { ProjectsTab } from '@/features/clients/tabs/ProjectsTab'
import { ContractsTab } from '@/features/clients/tabs/ContractsTab'
import { InvoicesTab } from '@/features/clients/tabs/InvoicesTab'
import { ActivityTab } from '@/features/clients/tabs/ActivityTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'projects', label: 'Projects' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'activity', label: 'Activity' },
]

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: client, isLoading, error } = useClient(id)
  const [tab, setTab] = useState('overview')

  if (isLoading) return <Skeleton className="h-32" />
  if (error || !client) {
    return <p className="text-sm">Client not found. <button onClick={() => navigate('/clients')} className="text-primary underline">Back</button></p>
  }

  return (
    <div className="space-y-6">
      <ClientHeader client={client} />
      <Tabs value={tab} onChange={setTab} items={TABS} />
      <div className="pt-2">
        {tab === 'overview' && <OverviewTab client={client} />}
        {tab === 'contacts' && <ContactsTab clientId={client.id} />}
        {tab === 'projects' && <ProjectsTab clientId={client.id} />}
        {tab === 'contracts' && <ContractsTab clientId={client.id} />}
        {tab === 'invoices' && <InvoicesTab clientId={client.id} />}
        {tab === 'activity' && <ActivityTab clientId={client.id} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(clients): detail page with header, tabs, overview

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 30: Implement ContactsTab (CRUD with set-primary)

**Files:**
- Replace: `src/features/clients/tabs/ContactsTab.jsx`
- Create: `src/features/clients/ContactFormModal.jsx`

- [ ] **Step 1: Create ContactFormModal.jsx**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { clientContactCreateSchema } from '@/api/schemas/client-contacts'
import { useCreateContact, useUpdateContact } from '@/hooks/useClientContacts'

export function ContactFormModal({ open, onClose, clientId, contact }) {
  const isEdit = !!contact
  const create = useCreateContact(clientId)
  const update = useUpdateContact(clientId)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientContactCreateSchema),
    defaultValues: {
      client_id: clientId,
      name: contact?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      role: contact?.role ?? '',
      is_primary: contact?.is_primary ?? false,
    },
  })

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: contact.id, patch: values })
      } else {
        await create.mutateAsync(values)
      }
      toast.success(isEdit ? 'Contact updated' : 'Contact added')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit contact' : 'Add contact'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="cname" required>Name</Label>
          <Input id="cname" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cemail">Email</Label>
            <Input id="cemail" type="email" {...register('email')} />
          </div>
          <div>
            <Label htmlFor="cphone">Phone</Label>
            <Input id="cphone" {...register('phone')} />
          </div>
        </div>
        <div>
          <Label htmlFor="crole">Role</Label>
          <Input id="crole" placeholder="e.g. CTO, Accounts Payable" {...register('role')} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_primary')} />
          Primary contact
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Replace ContactsTab.jsx**

```jsx
import { useState } from 'react'
import { Plus, Star, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClientContacts, useDeleteContact, useSetPrimaryContact } from '@/hooks/useClientContacts'
import { ContactFormModal } from '../ContactFormModal'

export function ContactsTab({ clientId }) {
  const { data: contacts = [], isLoading } = useClientContacts(clientId)
  const del = useDeleteContact(clientId)
  const setPrimary = useSetPrimaryContact(clientId)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (isLoading) return <p className="text-sm text-fg-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Add contact</Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-fg-muted">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.name}</p>
                  {c.is_primary ? <Badge variant="primary"><Star className="size-3 inline -mt-0.5" /> Primary</Badge> : null}
                </div>
                <p className="text-xs text-fg-muted">
                  {[c.role, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {!c.is_primary ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try { await setPrimary.mutateAsync(c.id); toast.success('Set as primary') }
                    catch (e) { toast.error(e.userMessage) }
                  }}
                  title="Make primary"
                >
                  <Star className="size-4" />
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Edit className="size-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c)}><Trash2 className="size-4 text-danger" /></Button>
            </li>
          ))}
        </ul>
      )}

      {creating ? <ContactFormModal open onClose={() => setCreating(false)} clientId={clientId} /> : null}
      {editing ? <ContactFormModal open onClose={() => setEditing(null)} clientId={clientId} contact={editing} /> : null}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete contact?"
        body={`Remove ${confirmDelete?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          try { await del.mutateAsync(confirmDelete.id); toast.success('Contact deleted'); setConfirmDelete(null) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(clients): contacts tab with CRUD and set-primary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

**End of Milestone 2.** Push to remote: `git push origin main`.

---

## Milestone 3 — Projects + Kanban (Tasks 31–43)

### Task 31: Migration — projects + kanban_columns + tasks

**Files:**
- Create: `supabase/migrations/<ts>__projects_and_kanban.sql`

- [ ] **Step 1: Scaffold**

```bash
supabase migration new projects_and_kanban
```

- [ ] **Step 2: Fill migration**

```sql
create type project_status as enum ('active', 'paused', 'archived');
create type task_priority as enum ('low', 'medium', 'high');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  description text,
  status project_status not null default 'active',
  color text not null default '#2D3E50',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);
create index projects_client_id_idx on public.projects (client_id);
create index projects_active_idx on public.projects (user_id) where status = 'active';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
create policy "projects_select_own" on public.projects for select using (user_id = auth.uid());
create policy "projects_insert_own" on public.projects for insert with check (user_id = auth.uid());
create policy "projects_update_own" on public.projects for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "projects_delete_own" on public.projects for delete using (user_id = auth.uid());

create table public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  position integer not null,
  wip_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kanban_columns_project_id_idx on public.kanban_columns (project_id, position);

create trigger kanban_columns_set_updated_at
  before update on public.kanban_columns
  for each row execute function public.set_updated_at();

alter table public.kanban_columns enable row level security;
create policy "kanban_columns_select_own" on public.kanban_columns for select using (user_id = auth.uid());
create policy "kanban_columns_insert_own" on public.kanban_columns for insert with check (user_id = auth.uid());
create policy "kanban_columns_update_own" on public.kanban_columns for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kanban_columns_delete_own" on public.kanban_columns for delete using (user_id = auth.uid());

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  column_id uuid not null references public.kanban_columns(id) on delete cascade,
  title text not null,
  description text,
  position double precision not null default 0,
  due_date date,
  priority task_priority not null default 'medium',
  labels jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_column_position_idx on public.tasks (column_id, position) where archived_at is null;
create index tasks_project_idx on public.tasks (project_id) where archived_at is null;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
create policy "tasks_select_own" on public.tasks for select using (user_id = auth.uid());
create policy "tasks_insert_own" on public.tasks for insert with check (user_id = auth.uid());
create policy "tasks_update_own" on public.tasks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on public.tasks for delete using (user_id = auth.uid());

-- Auto-seed default columns when a project is created
create or replace function public.seed_default_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.kanban_columns (user_id, project_id, name, position) values
    (new.user_id, new.id, 'To Do', 0),
    (new.user_id, new.id, 'In Progress', 1),
    (new.user_id, new.id, 'Review', 2),
    (new.user_id, new.id, 'Done', 3);
  return new;
end;
$$;

create trigger projects_seed_columns
  after insert on public.projects
  for each row execute function public.seed_default_columns();
```

- [ ] **Step 3: Apply locally + push**

```bash
supabase db reset
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "db: add projects, kanban_columns, tasks with RLS and column seeding

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 32: Migration — enforce_project_limit trigger

**Files:**
- Create: `supabase/migrations/<ts>__project_limit_trigger.sql`

- [ ] **Step 1: Scaffold**

```bash
supabase migration new project_limit_trigger
```

- [ ] **Step 2: Fill migration**

```sql
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier subscription_tier;
  v_limit integer;
  v_active_count integer;
  is_becoming_active boolean;
begin
  -- On INSERT: count only if new row will be active.
  -- On UPDATE: count only if status is transitioning into 'active' from a non-active state.
  if (tg_op = 'INSERT') then
    is_becoming_active := (new.status = 'active' and new.archived_at is null);
  else
    is_becoming_active := (new.status = 'active' and new.archived_at is null and (old.status <> 'active' or old.archived_at is not null));
  end if;

  if not is_becoming_active then
    return new;
  end if;

  select subscription_tier into v_tier from public.profiles where id = new.user_id;
  if v_tier is null then v_tier := 'free'; end if;

  v_limit := case v_tier
    when 'free' then 1
    when 'tier_1' then 5
    when 'tier_2' then 2147483647
  end;

  select count(*) into v_active_count
  from public.projects
  where user_id = new.user_id
    and status = 'active'
    and archived_at is null
    and id <> new.id;

  if v_active_count >= v_limit then
    raise exception 'PROJECT_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger projects_enforce_limit_insert
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

create trigger projects_enforce_limit_update
  before update of status, archived_at on public.projects
  for each row execute function public.enforce_project_limit();
```

- [ ] **Step 3: Apply locally + push**

```bash
supabase db reset
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "db: enforce project limit per subscription tier

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 33: SQL tests for projects RLS + project-limit trigger

**Files:**
- Create: `supabase/tests/projects.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(7);

select tests.create_supabase_user('alice@test.com');
select tests.create_supabase_user('bob@test.com');

select tests.authenticate_as('alice@test.com');

insert into public.clients (user_id, name) values (auth.uid(), 'Acme') returning id \gset acme_

-- 1: alice can create 1 project on free
select lives_ok(
  format($$insert into public.projects (user_id, client_id, name) values (auth.uid(), '%s', 'P1')$$, :'acme_id'),
  'free tier allows 1 project'
);

-- 2: alice cannot create a 2nd project on free
select throws_ok(
  format($$insert into public.projects (user_id, client_id, name) values (auth.uid(), '%s', 'P2')$$, :'acme_id'),
  'P0001',
  'PROJECT_LIMIT_EXCEEDED',
  'free tier rejects 2nd project'
);

-- 3: default kanban columns were seeded for P1
select is(
  (select count(*)::int from public.kanban_columns where project_id = (select id from public.projects where name = 'P1')),
  4,
  'project P1 has 4 default columns'
);

-- 4: bump alice to tier_1 (as service role) — simulating Splash webhook
reset role;
update public.profiles set subscription_tier = 'tier_1' where email = 'alice@test.com';

select tests.authenticate_as('alice@test.com');

-- 5: now alice can create more projects up to 5
select lives_ok(
  format($$insert into public.projects (user_id, client_id, name) values (auth.uid(), '%s', 'P2')$$, :'acme_id'),
  'tier_1 allows 2nd project'
);

-- 6: bob cannot read alice's projects
select tests.authenticate_as('bob@test.com');
select is_empty($$select 1 from public.projects$$, 'bob cannot see alice projects');

-- 7: archiving a project frees up the active slot
select tests.authenticate_as('alice@test.com');
update public.projects set archived_at = now(), status = 'archived' where name = 'P1';
reset role;
update public.profiles set subscription_tier = 'free' where email = 'alice@test.com';
select tests.authenticate_as('alice@test.com');
update public.projects set status = 'archived', archived_at = now() where name = 'P2';
-- Now alice (back on free) has 0 active projects; can create 1 again
select lives_ok(
  format($$insert into public.projects (user_id, client_id, name) values (auth.uid(), '%s', 'P3')$$, :'acme_id'),
  'archiving frees up an active slot'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

```bash
npm run db:test
```

Expected: 7 passing.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/projects.sql
git commit -m "test(db): project limit trigger and RLS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 34: Zod schemas for projects, kanban_columns, tasks

**Files:**
- Create: `src/api/schemas/projects.js`
- Create: `src/api/schemas/kanban-columns.js`
- Create: `src/api/schemas/tasks.js`

- [ ] **Step 1: projects.js**

```js
import { z } from 'zod'
export const projectCreateSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2D3E50'),
})
export const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
})
```

- [ ] **Step 2: kanban-columns.js**

```js
import { z } from 'zod'
export const columnCreateSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(60),
  position: z.number().int().min(0),
  wip_limit: z.number().int().positive().nullable().optional(),
})
export const columnUpdateSchema = columnCreateSchema.partial()
```

- [ ] **Step 3: tasks.js**

```js
import { z } from 'zod'
const labelSchema = z.object({ name: z.string().min(1).max(40), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })
export const taskCreateSchema = z.object({
  project_id: z.string().uuid(),
  column_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  labels: z.array(labelSchema).default([]),
})
export const taskUpdateSchema = taskCreateSchema.partial()
```

- [ ] **Step 4: Commit**

```bash
git add src/api/schemas
git commit -m "feat(schemas): projects, columns, tasks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 35: api/projects.js + hooks

**Files:**
- Create: `src/api/projects.js`
- Create: `src/hooks/useProjects.js`

- [ ] **Step 1: api/projects.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listProjects({ clientId, status = 'all', search = '' } = {}) {
  let q = supabase.from('projects').select('*, clients(name)')
  if (clientId) q = q.eq('client_id', clientId)
  if (status === 'active') q = q.eq('status', 'active').is('archived_at', null)
  if (status === 'archived') q = q.not('archived_at', 'is', null)
  if (status === 'paused') q = q.eq('status', 'paused')
  if (search) q = q.ilike('name', `%${search}%`)
  q = q.order('updated_at', { ascending: false })
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function getProject(id) {
  const { data, error } = await supabase.from('projects').select('*, clients(name)').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function countActiveProjects() {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('archived_at', null)
  if (error) throw mapPostgresError(error)
  return count || 0
}

export async function createProject(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('projects').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateProject(id, patch) {
  const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function archiveProject(id) {
  return updateProject(id, { status: 'archived', archived_at: new Date().toISOString() })
}

export async function unarchiveProject(id) {
  return updateProject(id, { status: 'active', archived_at: null })
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
```

- [ ] **Step 2: hooks/useProjects.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/projects'

export function useProjects(params) {
  return useQuery({ queryKey: ['projects', 'list', params], queryFn: () => api.listProjects(params) })
}
export function useProject(id) {
  return useQuery({ queryKey: ['projects', 'detail', id], queryFn: () => api.getProject(id), enabled: !!id })
}
export function useActiveProjectCount() {
  return useQuery({ queryKey: ['projects', 'count', 'active'], queryFn: api.countActiveProjects })
}
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['projects'] })
}
export function useCreateProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.createProject, onSuccess: invalidate })
}
export function useUpdateProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateProject(id, patch), onSuccess: invalidate })
}
export function useArchiveProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.archiveProject, onSuccess: invalidate })
}
export function useUnarchiveProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.unarchiveProject, onSuccess: invalidate })
}
export function useDeleteProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.deleteProject, onSuccess: invalidate })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/projects.js src/hooks/useProjects.js
git commit -m "feat(api/hooks): projects with active-count helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 36: api/kanban-columns.js + api/tasks.js + hooks

**Files:**
- Create: `src/api/kanban-columns.js`
- Create: `src/api/tasks.js`
- Create: `src/hooks/useKanbanColumns.js`
- Create: `src/hooks/useTasks.js`

- [ ] **Step 1: api/kanban-columns.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listColumns(projectId) {
  const { data, error } = await supabase
    .from('kanban_columns')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createColumn(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('kanban_columns').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateColumn(id, patch) {
  const { data, error } = await supabase.from('kanban_columns').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteColumn(id) {
  const { error } = await supabase.from('kanban_columns').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function reorderColumns(projectId, idsInOrder) {
  // Update positions one by one — projects rarely have many columns.
  for (let i = 0; i < idsInOrder.length; i++) {
    const { error } = await supabase.from('kanban_columns').update({ position: i }).eq('id', idsInOrder[i])
    if (error) throw mapPostgresError(error)
  }
}
```

- [ ] **Step 2: api/tasks.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listTasks(projectId, { includeArchived = false } = {}) {
  let q = supabase.from('tasks').select('*').eq('project_id', projectId)
  if (!includeArchived) q = q.is('archived_at', null)
  q = q.order('position', { ascending: true })
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createTask(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('tasks').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function archiveDoneInColumn(columnId) {
  const { error } = await supabase
    .from('tasks')
    .update({ archived_at: new Date().toISOString() })
    .eq('column_id', columnId)
    .is('archived_at', null)
  if (error) throw mapPostgresError(error)
}

// Compute a new position between two existing positions (or at the end).
export function positionBetween(before, after) {
  if (before == null && after == null) return 1024
  if (before == null) return after - 1024
  if (after == null) return before + 1024
  return (before + after) / 2
}
```

- [ ] **Step 3: hooks/useKanbanColumns.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/kanban-columns'

export function useKanbanColumns(projectId) {
  return useQuery({ queryKey: ['kanban-columns', projectId], queryFn: () => api.listColumns(projectId), enabled: !!projectId })
}
function useInvalidate(projectId) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['kanban-columns', projectId] })
}
export function useCreateColumn(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: api.createColumn, onSuccess: invalidate })
}
export function useUpdateColumn(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: ({ id, patch }) => api.updateColumn(id, patch), onSuccess: invalidate })
}
export function useDeleteColumn(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: api.deleteColumn, onSuccess: invalidate })
}
export function useReorderColumns(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: (idsInOrder) => api.reorderColumns(projectId, idsInOrder), onSuccess: invalidate })
}
```

- [ ] **Step 4: hooks/useTasks.js (with optimistic update for moves)**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/tasks'

export function useTasks(projectId) {
  return useQuery({ queryKey: ['tasks', projectId], queryFn: () => api.listTasks(projectId), enabled: !!projectId })
}

export function useCreateTask(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}

export function useUpdateTask(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] })
      const prev = qc.getQueryData(['tasks', projectId])
      qc.setQueryData(['tasks', projectId], (old) =>
        (old || []).map((t) => (t.id === id ? { ...t, ...patch } : t))
      )
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', projectId], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}

export function useDeleteTask(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}

export function useArchiveDoneInColumn(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveDoneInColumn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/api/kanban-columns.js src/api/tasks.js src/hooks/useKanbanColumns.js src/hooks/useTasks.js
git commit -m "feat(api/hooks): kanban columns and tasks with optimistic updates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 37: Projects page (card grid + filters + tier-gated create)

**Files:**
- Create: `src/features/projects/ProjectFormModal.jsx` (stub now, real impl in Task 38)
- Create: `src/features/projects/ProjectCard.jsx`
- Modify: `src/pages/ProjectsPage.jsx`

- [ ] **Step 1: Stub ProjectFormModal**

```jsx
// src/features/projects/ProjectFormModal.jsx
export function ProjectFormModal() { return null }
```

- [ ] **Step 2: ProjectCard.jsx**

```jsx
import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'

export function ProjectCard({ project }) {
  const { data: tasks = [] } = useTasks(project.id)
  const openCount = tasks.length
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-lg border border-border bg-bg-elevated p-4 hover:border-border-strong transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md p-2" style={{ backgroundColor: project.color + '22' }}>
          <Briefcase className="size-5" style={{ color: project.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{project.name}</p>
          <p className="text-xs text-fg-muted truncate">{project.clients?.name}</p>
          <p className="mt-2 text-xs text-fg-subtle">{openCount} open tasks</p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: ProjectsPage.jsx**

```jsx
import { useState } from 'react'
import { Plus, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { useProjects, useActiveProjectCount } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { canCreateProject, TIER_LIMITS } from '@/lib/tier'
import { UpgradeDialog } from '@/components/gates/UpgradeDialog'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { ProjectCard } from '@/features/projects/ProjectCard'

export default function ProjectsPage() {
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { data: profile } = useProfile()
  const { data: projects = [], isLoading } = useProjects({ status, search })
  const { data: activeCount = 0 } = useActiveProjectCount()
  const tier = profile?.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier].maxActiveProjects
  const limitText = limit === Infinity ? 'Unlimited' : `${activeCount} / ${limit}`

  const handleNewClick = () => {
    if (!canCreateProject(tier, activeCount)) {
      setUpgradeOpen(true)
    } else {
      setFormOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-fg-muted">Active projects: <Badge variant="primary">{limitText}</Badge></p>
        </div>
        <Button onClick={handleNewClick}><Plus className="size-4" /> New project</Button>
      </div>

      <div className="flex gap-3 max-w-xl">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[12rem]">
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
        <Input placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects yet"
          description="Spin up your first project to start a kanban board for it."
          action={<Button onClick={handleNewClick}><Plus className="size-4" /> New project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {formOpen ? <ProjectFormModal open onClose={() => setFormOpen(false)} /> : null}
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="active_projects"
        currentTier={tier}
        target={tier === 'free' ? 'tier_1' : 'tier_2'}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(projects): card grid with active-count badge and tier-gated New button

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 38: Project form modal (with client picker)

**Files:**
- Replace: `src/features/projects/ProjectFormModal.jsx`

- [ ] **Step 1: Implement ProjectFormModal**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { projectCreateSchema } from '@/api/schemas/projects'
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects'
import { useClients } from '@/hooks/useClients'

export function ProjectFormModal({ open, onClose, project, defaultClientId }) {
  const isEdit = !!project
  const create = useCreateProject()
  const update = useUpdateProject()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      client_id: project?.client_id ?? defaultClientId ?? '',
      name: project?.name ?? '',
      description: project?.description ?? '',
      color: project?.color ?? '#2D3E50',
    },
  })

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: project.id, patch: values })
        toast.success('Project updated')
      } else {
        await create.mutateAsync(values)
        toast.success('Project created')
      }
      onClose()
    } catch (e) {
      if (e.code === 'PROJECT_LIMIT_EXCEEDED') {
        toast.error(e.userMessage)
      } else {
        toast.error(e.userMessage || 'Save failed')
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit project' : 'New project'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="client_id" required>Client</Label>
          <Select id="client_id" {...register('client_id')}>
            <option value="">Select a client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <FieldError>{errors.client_id?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="name" required>Name</Label>
          <Input id="name" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...register('description')} />
        </div>
        <div>
          <Label htmlFor="color">Accent color</Label>
          <input id="color" type="color" {...register('color')} className="h-10 w-20 rounded border border-border" />
          <FieldError>{errors.color?.message}</FieldError>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Wire ProjectsTab on client detail page (was stubbed in Task 29)**

Replace `src/features/clients/tabs/ProjectsTab.jsx`:

```jsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProjects } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { useActiveProjectCount } from '@/hooks/useProjects'
import { canCreateProject } from '@/lib/tier'
import { UpgradeDialog } from '@/components/gates/UpgradeDialog'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { ProjectCard } from '@/features/projects/ProjectCard'
import { Briefcase } from 'lucide-react'

export function ProjectsTab({ clientId }) {
  const { data: projects = [], isLoading } = useProjects({ clientId, status: 'all' })
  const { data: profile } = useProfile()
  const { data: activeCount = 0 } = useActiveProjectCount()
  const [formOpen, setFormOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const tier = profile?.subscription_tier ?? 'free'

  const handleNewClick = () => {
    if (!canCreateProject(tier, activeCount)) setUpgradeOpen(true)
    else setFormOpen(true)
  }

  if (isLoading) return <p className="text-sm text-fg-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleNewClick}><Plus className="size-4" /> New project</Button>
      </div>
      {projects.length === 0 ? (
        <EmptyState icon={Briefcase} title="No projects for this client" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
      {formOpen ? <ProjectFormModal open onClose={() => setFormOpen(false)} defaultClientId={clientId} /> : null}
      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="active_projects"
        currentTier={tier}
        target={tier === 'free' ? 'tier_1' : 'tier_2'}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(projects): create/edit modal and wire ProjectsTab on client detail

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 39: Kanban — board layout (no drag yet)

**Files:**
- Modify: `src/pages/ProjectDetailPage.jsx`
- Create: `src/features/kanban/KanbanBoard.jsx`
- Create: `src/features/kanban/KanbanColumn.jsx`
- Create: `src/features/kanban/TaskCard.jsx`

- [ ] **Step 1: ProjectDetailPage**

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { KanbanBoard } from '@/features/kanban/KanbanBoard'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading, error } = useProject(id)

  if (isLoading) return <Skeleton className="h-64" />
  if (error || !project) {
    return <p>Project not found. <button className="text-primary underline" onClick={() => navigate('/projects')}>Back</button></p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-fg-muted">{project.clients?.name}</p>
      </div>
      <KanbanBoard projectId={project.id} />
    </div>
  )
}
```

- [ ] **Step 2: TaskCard.jsx (presentational)**

```jsx
import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatDate, isOverdue } from '@/lib/date'
import { cn } from '@/components/ui/cn'

const PRIORITY_VARIANT = { low: 'default', medium: 'info', high: 'danger' }

export function TaskCard({ task, onClick }) {
  const overdue = isOverdue(task.due_date, 'sent')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
      className="rounded-md border border-border bg-bg p-3 text-sm hover:border-border-strong cursor-pointer"
    >
      <p className="font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
        {(task.labels || []).map((l) => (
          <span key={l.name} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: l.color + '33', color: l.color }}>
            {l.name}
          </span>
        ))}
        {task.due_date ? (
          <span className={cn('inline-flex items-center gap-1 text-xs', overdue ? 'text-danger' : 'text-fg-muted')}>
            <Calendar className="size-3" />
            {formatDate(task.due_date, 'MMM d')}
          </span>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: KanbanColumn.jsx**

```jsx
import { TaskCard } from './TaskCard'
import { Badge } from '@/components/ui/Badge'

export function KanbanColumn({ column, tasks, onTaskClick }) {
  const overLimit = column.wip_limit != null && tasks.length > column.wip_limit
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-bg-elevated p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium">{column.name}</h3>
        <Badge variant={overLimit ? 'danger' : 'default'}>
          {tasks.length}{column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 min-h-[100px]">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: KanbanBoard.jsx (no drag yet)**

```jsx
import { useMemo } from 'react'
import { useKanbanColumns } from '@/hooks/useKanbanColumns'
import { useTasks } from '@/hooks/useTasks'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard({ projectId }) {
  const { data: columns = [] } = useKanbanColumns(projectId)
  const { data: tasks = [] } = useTasks(projectId)

  const tasksByColumn = useMemo(() => {
    const map = new Map()
    for (const c of columns) map.set(c.id, [])
    for (const t of tasks) {
      if (!map.has(t.column_id)) map.set(t.column_id, [])
      map.get(t.column_id).push(t)
    }
    for (const [k, arr] of map) arr.sort((a, b) => a.position - b.position)
    return map
  }, [columns, tasks])

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {columns.map((col) => (
          <KanbanColumn key={col.id} column={col} tasks={tasksByColumn.get(col.id) || []} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Manual test**

Create a client → create a project → open project detail. Expected: 4 default columns rendered (To Do, In Progress, Review, Done), all empty.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(kanban): board + columns + task cards (no drag yet)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 40: Kanban — dnd-kit drag-drop between/within columns

**Files:**
- Replace: `src/features/kanban/KanbanBoard.jsx`
- Replace: `src/features/kanban/KanbanColumn.jsx`
- Replace: `src/features/kanban/TaskCard.jsx`

- [ ] **Step 1: Replace KanbanBoard.jsx**

```jsx
import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useKanbanColumns } from '@/hooks/useKanbanColumns'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { positionBetween } from '@/api/tasks'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'

export function KanbanBoard({ projectId, onTaskClick }) {
  const { data: columns = [] } = useKanbanColumns(projectId)
  const { data: tasks = [] } = useTasks(projectId)
  const updateTask = useUpdateTask(projectId)
  const [activeTask, setActiveTask] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const tasksByColumn = useMemo(() => {
    const map = new Map()
    for (const c of columns) map.set(c.id, [])
    for (const t of tasks) {
      if (!map.has(t.column_id)) map.set(t.column_id, [])
      map.get(t.column_id).push(t)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position)
    return map
  }, [columns, tasks])

  const findTask = (id) => tasks.find((t) => t.id === id)

  function onDragStart(e) {
    setActiveTask(findTask(e.active.id))
  }

  function resolveDestination(active, over) {
    if (!over) return null
    // Over a column? Drop at the end.
    const col = columns.find((c) => c.id === over.id)
    if (col) {
      const list = tasksByColumn.get(col.id) || []
      const last = list[list.length - 1]
      return { columnId: col.id, position: positionBetween(last?.position ?? null, null) }
    }
    // Over a task? Drop adjacent.
    const overTask = findTask(over.id)
    if (overTask) {
      const list = tasksByColumn.get(overTask.column_id) || []
      const idx = list.findIndex((t) => t.id === overTask.id)
      const activeTaskRow = findTask(active.id)
      // If reordering within the same column and moving down, insert AFTER over; otherwise BEFORE.
      const before = activeTaskRow?.column_id === overTask.column_id && (activeTaskRow?.position ?? 0) < (overTask.position ?? 0)
        ? overTask.position
        : list[idx - 1]?.position ?? null
      const after = activeTaskRow?.column_id === overTask.column_id && (activeTaskRow?.position ?? 0) < (overTask.position ?? 0)
        ? list[idx + 1]?.position ?? null
        : overTask.position
      return { columnId: overTask.column_id, position: positionBetween(before, after) }
    }
    return null
  }

  async function onDragEnd(e) {
    setActiveTask(null)
    const dest = resolveDestination(e.active, e.over)
    if (!dest) return
    const t = findTask(e.active.id)
    if (!t) return
    if (t.column_id === dest.columnId && t.position === dest.position) return
    updateTask.mutate({ id: t.id, patch: { column_id: dest.columnId, position: dest.position } })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveTask(null)}>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 snap-x">
          {columns.map((col) => (
            <SortableContext key={col.id} id={col.id} items={(tasksByColumn.get(col.id) || []).map((t) => t.id)}>
              <KanbanColumn column={col} tasks={tasksByColumn.get(col.id) || []} onTaskClick={onTaskClick} />
            </SortableContext>
          ))}
        </div>
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Make TaskCard sortable**

```jsx
// src/features/kanban/TaskCard.jsx
import { Calendar } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/Badge'
import { formatDate, isOverdue } from '@/lib/date'
import { cn } from '@/components/ui/cn'

const PRIORITY_VARIANT = { low: 'default', medium: 'info', high: 'danger' }

export function TaskCard({ task, onClick, asOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = asOverlay ? undefined : { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const overdue = isOverdue(task.due_date, 'sent')
  return (
    <div
      ref={asOverlay ? undefined : setNodeRef}
      style={style}
      {...(asOverlay ? {} : attributes)}
      {...(asOverlay ? {} : listeners)}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
      className="rounded-md border border-border bg-bg p-3 text-sm hover:border-border-strong cursor-pointer"
    >
      <p className="font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
        {(task.labels || []).map((l) => (
          <span key={l.name} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: l.color + '33', color: l.color }}>
            {l.name}
          </span>
        ))}
        {task.due_date ? (
          <span className={cn('inline-flex items-center gap-1 text-xs', overdue ? 'text-danger' : 'text-fg-muted')}>
            <Calendar className="size-3" />
            {formatDate(task.due_date, 'MMM d')}
          </span>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Make KanbanColumn a droppable target**

```jsx
// src/features/kanban/KanbanColumn.jsx
import { useDroppable } from '@dnd-kit/core'
import { TaskCard } from './TaskCard'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

export function KanbanColumn({ column, tasks, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const overLimit = column.wip_limit != null && tasks.length > column.wip_limit

  return (
    <div className={cn('flex w-72 shrink-0 flex-col rounded-lg bg-bg-elevated p-3 snap-start', isOver && 'ring-2 ring-primary')}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium">{column.name}</h3>
        <Badge variant={overLimit ? 'danger' : 'default'}>
          {tasks.length}{column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
        </Badge>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[100px]">
        {tasks.map((t) => <TaskCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(kanban): drag-drop with dnd-kit (optimistic via useUpdateTask)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 41: Kanban — inline add task in each column

**Files:**
- Modify: `src/features/kanban/KanbanColumn.jsx`
- Create: `src/features/kanban/InlineAddTask.jsx`

- [ ] **Step 1: InlineAddTask.jsx**

```jsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { positionBetween } from '@/api/tasks'
import { useCreateTask } from '@/hooks/useTasks'

export function InlineAddTask({ projectId, columnId, lastPosition }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const create = useCreateTask(projectId)

  const submit = async () => {
    const v = title.trim()
    if (!v) return
    try {
      await create.mutateAsync({
        project_id: projectId,
        column_id: columnId,
        title: v,
        position: positionBetween(lastPosition ?? null, null),
        priority: 'medium',
        labels: [],
      })
      setTitle('')
    } catch (e) {
      toast.error(e.userMessage || 'Failed to add task')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg"
      >
        <Plus className="size-4" /> Add task
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setTitle(''); setOpen(false) }
        }}
        placeholder="Task title"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={create.isPending}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => { setTitle(''); setOpen(false) }}>Cancel</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Use InlineAddTask in KanbanColumn**

Add to the end of the inner column div, after the task list:

```jsx
// inside KanbanColumn, after the droppable div
<InlineAddTask projectId={column.project_id} columnId={column.id} lastPosition={tasks[tasks.length - 1]?.position} />
```

(Make sure to import `InlineAddTask`.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(kanban): inline add-task per column

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 42: Kanban — task detail drawer (edit + delete)

**Files:**
- Create: `src/features/kanban/TaskDrawer.jsx`
- Modify: `src/pages/ProjectDetailPage.jsx` (wire drawer)

- [ ] **Step 1: Create TaskDrawer.jsx**

```jsx
import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { taskUpdateSchema } from '@/api/schemas/tasks'
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useKanbanColumns } from '@/hooks/useKanbanColumns'
import { useState } from 'react'

export function TaskDrawer({ open, onClose, projectId, task }) {
  const update = useUpdateTask(projectId)
  const del = useDeleteTask(projectId)
  const { data: columns = [] } = useKanbanColumns(projectId)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      due_date: task?.due_date ?? '',
      priority: task?.priority ?? 'medium',
      column_id: task?.column_id ?? '',
    },
  })

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        due_date: task.due_date ?? '',
        priority: task.priority,
        column_id: task.column_id,
      })
    }
  }, [task, reset])

  const onSubmit = async (values) => {
    try {
      const patch = { ...values, due_date: values.due_date || null }
      await update.mutateAsync({ id: task.id, patch })
      toast.success('Task updated')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  const onDelete = async () => {
    try {
      await del.mutateAsync(task.id)
      toast.success('Task deleted')
      setConfirmDelete(false)
      onClose()
    } catch (e) {
      toast.error(e.userMessage)
    }
  }

  if (!task) return null

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Task">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title" required>Title</Label>
            <Input id="title" {...register('title')} />
            <FieldError>{errors.title?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" {...register('due_date')} />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" {...register('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="column_id">Column</Label>
            <Select id="column_id" {...register('column_id')}>
              {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="flex justify-between pt-4 border-t border-border">
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={isSubmitting}>Save</Button>
            </div>
          </div>
        </form>
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete task?"
        body="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={del.isPending}
      />
    </>
  )
}
```

- [ ] **Step 2: Wire drawer in ProjectDetailPage**

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { KanbanBoard } from '@/features/kanban/KanbanBoard'
import { TaskDrawer } from '@/features/kanban/TaskDrawer'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading, error } = useProject(id)
  const [drawerTask, setDrawerTask] = useState(null)

  if (isLoading) return <Skeleton className="h-64" />
  if (error || !project) return <p>Project not found. <button onClick={() => navigate('/projects')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-fg-muted">{project.clients?.name}</p>
      </div>
      <KanbanBoard projectId={project.id} onTaskClick={setDrawerTask} />
      <TaskDrawer open={!!drawerTask} onClose={() => setDrawerTask(null)} projectId={project.id} task={drawerTask} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(kanban): task drawer with edit + delete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 43: Kanban — filters + custom column management + Clear Done

**Files:**
- Create: `src/features/kanban/KanbanFilters.jsx`
- Create: `src/features/kanban/ColumnSettingsMenu.jsx`
- Modify: `src/features/kanban/KanbanBoard.jsx`
- Modify: `src/features/kanban/KanbanColumn.jsx`

- [ ] **Step 1: KanbanFilters.jsx**

```jsx
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'

export function KanbanFilters({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Filter cards…"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        className="max-w-xs"
      />
      <Select value={value.priority} onChange={(e) => onChange({ ...value, priority: e.target.value })} className="w-32">
        <option value="">Any priority</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </Select>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={value.dueSoon}
          onChange={(e) => onChange({ ...value, dueSoon: e.target.checked })}
        />
        Due ≤ 7 days
      </label>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={value.hideDone}
          onChange={(e) => onChange({ ...value, hideDone: e.target.checked })}
        />
        Hide Done
      </label>
    </div>
  )
}
```

- [ ] **Step 2: ColumnSettingsMenu.jsx (rename, set WIP, delete, clear done)**

```jsx
import { useState } from 'react'
import { MoreHorizontal, Trash2, Edit, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useDeleteColumn, useUpdateColumn } from '@/hooks/useKanbanColumns'
import { useArchiveDoneInColumn } from '@/hooks/useTasks'

export function ColumnSettingsMenu({ projectId, column, tasksInColumn }) {
  const [open, setOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const update = useUpdateColumn(projectId)
  const del = useDeleteColumn(projectId)
  const clear = useArchiveDoneInColumn(projectId)
  const [name, setName] = useState(column.name)
  const [wip, setWip] = useState(column.wip_limit ?? '')

  return (
    <>
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="text-fg-muted hover:text-fg" aria-label="Column menu">
          <MoreHorizontal className="size-4" />
        </button>
        {open ? (
          <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-bg shadow-lg z-20 py-1">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-bg-muted" onClick={() => { setRenameOpen(true); setOpen(false) }}>
              <Edit className="size-4" /> Rename / WIP
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-bg-muted" onClick={() => { setConfirmClear(true); setOpen(false) }}>
              <CheckCheck className="size-4" /> Clear cards
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-bg-muted" onClick={() => { setConfirmDelete(true); setOpen(false) }}>
              <Trash2 className="size-4" /> Delete column
            </button>
          </div>
        ) : null}
      </div>

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Column settings" size="sm">
        <div className="space-y-3">
          <div>
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cwip">WIP limit (optional)</Label>
            <Input id="cwip" type="number" min={1} value={wip} onChange={(e) => setWip(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  await update.mutateAsync({ id: column.id, patch: { name, wip_limit: wip === '' ? null : Number(wip) } })
                  toast.success('Column updated')
                  setRenameOpen(false)
                } catch (e) { toast.error(e.userMessage) }
              }}
              loading={update.isPending}
            >Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete column?"
        body={`This will permanently delete the column and all ${tasksInColumn} tasks in it.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { try { await del.mutateAsync(column.id); toast.success('Column deleted'); setConfirmDelete(false) } catch (e) { toast.error(e.userMessage) } }}
        loading={del.isPending}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Archive all cards in this column?"
        body="Tasks will be archived (not deleted) and disappear from the board."
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => { try { await clear.mutateAsync(column.id); toast.success('Column cleared'); setConfirmClear(false) } catch (e) { toast.error(e.userMessage) } }}
        loading={clear.isPending}
      />
    </>
  )
}
```

- [ ] **Step 3: Update KanbanColumn to render menu**

In `KanbanColumn.jsx`, replace the header div:

```jsx
import { ColumnSettingsMenu } from './ColumnSettingsMenu'
// ...
<div className="flex items-center justify-between mb-3 px-1">
  <div className="flex items-center gap-2">
    <h3 className="text-sm font-medium">{column.name}</h3>
    <Badge variant={overLimit ? 'danger' : 'default'}>
      {tasks.length}{column.wip_limit != null ? ` / ${column.wip_limit}` : ''}
    </Badge>
  </div>
  <ColumnSettingsMenu projectId={column.project_id} column={column} tasksInColumn={tasks.length} />
</div>
```

- [ ] **Step 4: Add "Add column" button + filters to KanbanBoard**

```jsx
// At the top of KanbanBoard (above the dnd context), add:
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { KanbanFilters } from './KanbanFilters'
import { useCreateColumn } from '@/hooks/useKanbanColumns'
import { daysUntil } from '@/lib/date'
// ...

const [filters, setFilters] = useState({ search: '', priority: '', dueSoon: false, hideDone: false })
const createColumn = useCreateColumn(projectId)
const [newColumnOpen, setNewColumnOpen] = useState(false)
const [newColumnName, setNewColumnName] = useState('')

// Filter tasks:
const filteredTasksByColumn = useMemo(() => {
  const out = new Map()
  const doneColumnIds = new Set(columns.filter((c) => /done/i.test(c.name)).map((c) => c.id))
  for (const [col, list] of tasksByColumn) {
    let next = list
    if (filters.search) next = next.filter((t) => t.title.toLowerCase().includes(filters.search.toLowerCase()))
    if (filters.priority) next = next.filter((t) => t.priority === filters.priority)
    if (filters.dueSoon) next = next.filter((t) => t.due_date && daysUntil(t.due_date) <= 7)
    if (filters.hideDone && doneColumnIds.has(col)) next = []
    out.set(col, next)
  }
  return out
}, [tasksByColumn, filters, columns])

// Replace `tasksByColumn` usage in render with `filteredTasksByColumn`
```

Add the filters bar + "Add column" UI above the DndContext:

```jsx
<div className="flex items-center justify-between gap-2">
  <KanbanFilters value={filters} onChange={setFilters} />
  <Button variant="secondary" onClick={() => setNewColumnOpen(true)}><Plus className="size-4" /> Add column</Button>
</div>
{newColumnOpen ? (
  <Modal open onClose={() => setNewColumnOpen(false)} title="New column" size="sm">
    <div className="space-y-3">
      <Input value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Column name" autoFocus />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setNewColumnOpen(false)}>Cancel</Button>
        <Button
          onClick={async () => {
            try {
              await createColumn.mutateAsync({ project_id: projectId, name: newColumnName, position: columns.length })
              setNewColumnOpen(false); setNewColumnName('')
            } catch (e) { toast.error(e.userMessage) }
          }}
          loading={createColumn.isPending}
        >Create</Button>
      </div>
    </div>
  </Modal>
) : null}
```

(Add `Modal`, `Input`, `toast` to imports as needed.)

- [ ] **Step 5: Manual test — full board interaction works (drag, inline add, edit drawer, filters, add column, rename, delete, clear)**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(kanban): filters, custom columns, clear-done

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

**End of Milestone 3.** Push: `git push origin main`.

---

## Milestone 4 — Contracts + basic Invoices (Tasks 44–54)

### Task 44: Migration — contracts + invoices + line items + payments + numbering

**Files:**
- Create: `supabase/migrations/<ts>__contracts_and_invoices.sql`

- [ ] **Step 1: Scaffold**

```bash
supabase migration new contracts_and_invoices
```

- [ ] **Step 2: Fill migration**

```sql
create type contract_status as enum ('draft', 'active', 'completed', 'expired', 'canceled');
create type invoice_status as enum ('draft', 'sent', 'viewed', 'paid', 'overdue', 'void');
create type payment_method as enum ('stripe', 'bank', 'cash', 'other', 'manual');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  start_date date,
  end_date date,
  value numeric(14,2),
  currency text not null default 'USD',
  status contract_status not null default 'active',
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_user_id_idx on public.contracts (user_id);
create index contracts_client_id_idx on public.contracts (client_id);

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

alter table public.contracts enable row level security;
create policy "contracts_select_own" on public.contracts for select using (user_id = auth.uid());
create policy "contracts_insert_own" on public.contracts for insert with check (user_id = auth.uid());
create policy "contracts_update_own" on public.contracts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "contracts_delete_own" on public.contracts for delete using (user_id = auth.uid());

create table public.invoice_number_sequences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_number integer not null default 0
);
alter table public.invoice_number_sequences enable row level security;
-- No user-visible policies; modified only via SECURITY DEFINER function below.

create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.invoice_number_sequences (user_id, last_number)
    values (p_user_id, 1)
  on conflict (user_id) do update set last_number = invoice_number_sequences.last_number + 1
  returning last_number into v_next;
  return 'INV-' || lpad(v_next::text, 4, '0');
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  currency text not null default 'USD',
  status invoice_status not null default 'draft',
  notes text,
  terms text,
  payment_instructions text,
  public_token text not null default encode(gen_random_bytes(16), 'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_project_id_idx on public.invoices (project_id);
create index invoices_status_idx on public.invoices (user_id, status);
create unique index invoices_public_token_idx on public.invoices (public_token);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
create policy "invoices_select_own" on public.invoices for select using (user_id = auth.uid());
create policy "invoices_insert_own" on public.invoices for insert with check (user_id = auth.uid());
create policy "invoices_update_own" on public.invoices for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoices_delete_own" on public.invoices for delete using (user_id = auth.uid());

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  discount_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoice_line_items_invoice_id_idx on public.invoice_line_items (invoice_id, position);

create trigger invoice_line_items_set_updated_at
  before update on public.invoice_line_items
  for each row execute function public.set_updated_at();

alter table public.invoice_line_items enable row level security;
create policy "invoice_line_items_select_own" on public.invoice_line_items for select using (user_id = auth.uid());
create policy "invoice_line_items_insert_own" on public.invoice_line_items for insert with check (user_id = auth.uid());
create policy "invoice_line_items_update_own" on public.invoice_line_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoice_line_items_delete_own" on public.invoice_line_items for delete using (user_id = auth.uid());

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null,
  paid_at timestamptz not null default now(),
  method payment_method not null default 'manual',
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_id_idx on public.invoice_payments (invoice_id);
create unique index invoice_payments_stripe_pi_idx on public.invoice_payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

alter table public.invoice_payments enable row level security;
create policy "invoice_payments_select_own" on public.invoice_payments for select using (user_id = auth.uid());
create policy "invoice_payments_insert_own" on public.invoice_payments for insert with check (user_id = auth.uid());
create policy "invoice_payments_delete_own" on public.invoice_payments for delete using (user_id = auth.uid());
-- No UPDATE on payments — corrections are via delete + insert.
```

- [ ] **Step 3: Apply + push**

```bash
supabase db reset
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "db: add contracts, invoices, line items, payments, numbering function

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 45: SQL tests for invoice numbering and RLS

**Files:**
- Create: `supabase/tests/invoices.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(5);

select tests.create_supabase_user('alice@test.com');
select tests.create_supabase_user('bob@test.com');

select tests.authenticate_as('alice@test.com');

-- 1: next_invoice_number returns sequential INV-0001, INV-0002 for alice
select is(public.next_invoice_number(auth.uid()), 'INV-0001', 'first number for alice');
select is(public.next_invoice_number(auth.uid()), 'INV-0002', 'second number for alice');

-- 2: bob's sequence is independent
select tests.authenticate_as('bob@test.com');
select is(public.next_invoice_number(auth.uid()), 'INV-0001', 'first number for bob (independent sequence)');

-- 3: RLS: bob cannot read alice's invoices
select tests.authenticate_as('alice@test.com');
insert into public.clients (user_id, name) values (auth.uid(), 'X') returning id \gset x_
insert into public.invoices (user_id, client_id, invoice_number, due_date)
  values (auth.uid(), :'x_id', 'INV-0003', current_date);
select tests.authenticate_as('bob@test.com');
select is_empty($$select 1 from public.invoices$$, 'bob cannot see alice invoices');

-- 4: unique number per user enforced
select tests.authenticate_as('alice@test.com');
select throws_ok(
  format($$insert into public.invoices (user_id, client_id, invoice_number, due_date)
           values (auth.uid(), '%s', 'INV-0003', current_date)$$, :'x_id'),
  '23505',
  null,
  'duplicate invoice_number per user rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

```bash
npm run db:test
```

Expected: 5 passing.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/invoices.sql
git commit -m "test(db): invoice numbering and RLS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 46: Zod schemas for contracts, invoices, line items, payments

**Files:**
- Create: `src/api/schemas/contracts.js`
- Create: `src/api/schemas/invoices.js`
- Create: `src/api/schemas/invoice-line-items.js`
- Create: `src/api/schemas/invoice-payments.js`

- [ ] **Step 1: contracts.js**

```js
import { z } from 'zod'
export const contractCreateSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().or(z.literal('')),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default('USD'),
  status: z.enum(['draft', 'active', 'completed', 'expired', 'canceled']).default('active'),
}).refine(
  (d) => !d.start_date || !d.end_date || d.start_date <= d.end_date,
  { message: 'End date must be after start date', path: ['end_date'] }
)
export const contractUpdateSchema = contractCreateSchema._def.schema.partial()
```

- [ ] **Step 2: invoice-line-items.js**

```js
import { z } from 'zod'
export const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().nonnegative(),
  unit_price: z.number(),
  tax_rate: z.number().min(0).max(100).default(0),
  discount_rate: z.number().min(0).max(100).default(0),
  position: z.number().int().nonnegative(),
})
```

- [ ] **Step 3: invoices.js**

```js
import { z } from 'zod'
import { lineItemSchema } from './invoice-line-items'

export const invoiceCreateSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  invoice_number: z.string().min(1).max(50),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3),
  notes: z.string().max(5000).optional().or(z.literal('')),
  terms: z.string().max(5000).optional().or(z.literal('')),
  payment_instructions: z.string().max(5000).optional().or(z.literal('')),
  line_items: z.array(lineItemSchema).min(1, 'Add at least one line item'),
})

export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'overdue', 'void']).optional(),
})
```

- [ ] **Step 4: invoice-payments.js**

```js
import { z } from 'zod'
export const paymentCreateSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  paid_at: z.string(),
  method: z.enum(['stripe', 'bank', 'cash', 'other', 'manual']).default('manual'),
  notes: z.string().max(1000).optional().or(z.literal('')),
})
```

- [ ] **Step 5: Commit**

```bash
git add src/api/schemas
git commit -m "feat(schemas): contracts, invoices, line items, payments

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 47: api/contracts.js + hooks

**Files:**
- Create: `src/api/contracts.js`
- Create: `src/hooks/useContracts.js`

- [ ] **Step 1: api/contracts.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listContracts({ clientId, status, search = '', sort = { field: 'created_at', dir: 'desc' }, page = 0, pageSize = 25 } = {}) {
  let q = supabase.from('contracts').select('*, clients(name), projects(name)', { count: 'exact' })
  if (clientId) q = q.eq('client_id', clientId)
  if (status) q = q.eq('status', status)
  if (search) q = q.ilike('title', `%${search}%`)
  q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data || [], total: count || 0 }
}

export async function getContract(id) {
  const { data, error } = await supabase.from('contracts').select('*, clients(name), projects(name)').eq('id', id).single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function createContract(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const row = { ...input, user_id: userId }
  const { data, error } = await supabase.from('contracts').insert(row).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function updateContract(id, patch) {
  const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteContract(id) {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function uploadContractPdf(contractId, file) {
  const path = `${contractId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
  const { error: upErr } = await supabase.storage.from('contract-pdfs').upload(path, file, { upsert: false })
  if (upErr) throw mapPostgresError(upErr)
  return updateContract(contractId, { pdf_storage_path: path })
}

export async function getSignedPdfUrl(path) {
  const { data, error } = await supabase.storage.from('contract-pdfs').createSignedUrl(path, 60 * 60)
  if (error) throw mapPostgresError(error)
  return data.signedUrl
}
```

- [ ] **Step 2: hooks/useContracts.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/contracts'

export function useContracts(params) {
  return useQuery({ queryKey: ['contracts', 'list', params], queryFn: () => api.listContracts(params), keepPreviousData: true })
}
export function useContract(id) {
  return useQuery({ queryKey: ['contracts', 'detail', id], queryFn: () => api.getContract(id), enabled: !!id })
}
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['contracts'] })
}
export function useCreateContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createContract, onSuccess: inv })
}
export function useUpdateContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateContract(id, patch), onSuccess: inv })
}
export function useDeleteContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deleteContract, onSuccess: inv })
}
export function useUploadContractPdf() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, file }) => api.uploadContractPdf(id, file), onSuccess: inv })
}
```

- [ ] **Step 3: Create Supabase Storage bucket via migration**

```bash
supabase migration new contract_pdfs_bucket
```

```sql
insert into storage.buckets (id, name, public) values ('contract-pdfs', 'contract-pdfs', false) on conflict do nothing;

create policy "contract_pdfs_select_own"
  on storage.objects for select
  using (bucket_id = 'contract-pdfs' and (storage.foldername(name))[1] in (
    select id::text from public.contracts where user_id = auth.uid()
  ));

create policy "contract_pdfs_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'contract-pdfs' and (storage.foldername(name))[1] in (
    select id::text from public.contracts where user_id = auth.uid()
  ));

create policy "contract_pdfs_delete_own"
  on storage.objects for delete
  using (bucket_id = 'contract-pdfs' and (storage.foldername(name))[1] in (
    select id::text from public.contracts where user_id = auth.uid()
  ));
```

Apply + push:

```bash
supabase db reset
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(contracts): API, hooks, and Storage bucket for signed PDFs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 48: Contracts list page + form modal

**Files:**
- Create: `src/features/contracts/ContractFormModal.jsx`
- Create: `src/features/contracts/ContractStatusBadge.jsx`
- Modify: `src/pages/ContractsPage.jsx`

- [ ] **Step 1: ContractStatusBadge.jsx**

```jsx
import { Badge } from '@/components/ui/Badge'
const MAP = { draft: 'default', active: 'success', completed: 'info', expired: 'warning', canceled: 'danger' }
export function ContractStatusBadge({ status }) {
  return <Badge variant={MAP[status] || 'default'}>{status}</Badge>
}
```

- [ ] **Step 2: ContractFormModal.jsx**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { contractCreateSchema } from '@/api/schemas/contracts'
import { useCreateContract, useUpdateContract } from '@/hooks/useContracts'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

export function ContractFormModal({ open, onClose, contract, defaultClientId }) {
  const isEdit = !!contract
  const create = useCreateContract()
  const update = useUpdateContract()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contractCreateSchema),
    defaultValues: {
      client_id: contract?.client_id ?? defaultClientId ?? '',
      project_id: contract?.project_id ?? null,
      title: contract?.title ?? '',
      description: contract?.description ?? '',
      start_date: contract?.start_date ?? '',
      end_date: contract?.end_date ?? '',
      value: contract?.value ?? null,
      currency: contract?.currency ?? 'USD',
      status: contract?.status ?? 'active',
    },
  })
  const selectedClient = watch('client_id')
  const { data: projects = [] } = useProjects({ clientId: selectedClient, status: 'all' })

  const onSubmit = async (values) => {
    try {
      const patch = {
        ...values,
        project_id: values.project_id || null,
        value: values.value === '' || values.value == null ? null : Number(values.value),
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      }
      if (isEdit) await update.mutateAsync({ id: contract.id, patch })
      else await create.mutateAsync(patch)
      toast.success(isEdit ? 'Contract updated' : 'Contract created')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit contract' : 'New contract'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client_id" required>Client</Label>
            <Select id="client_id" {...register('client_id')}>
              <option value="">Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <FieldError>{errors.client_id?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="project_id">Project (optional)</Label>
            <Select id="project_id" {...register('project_id')}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="title" required>Title</Label>
          <Input id="title" {...register('title')} />
          <FieldError>{errors.title?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} {...register('description')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Start date</Label>
            <Input id="start_date" type="date" {...register('start_date')} />
          </div>
          <div>
            <Label htmlFor="end_date">End date</Label>
            <Input id="end_date" type="date" {...register('end_date')} />
            <FieldError>{errors.end_date?.message}</FieldError>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="value">Value</Label>
            <Input id="value" type="number" step="0.01" {...register('value', { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register('status')}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="canceled">Canceled</option>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 3: ContractsPage.jsx**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { useContracts } from '@/hooks/useContracts'
import { ContractStatusBadge } from '@/features/contracts/ContractStatusBadge'
import { ContractFormModal } from '@/features/contracts/ContractFormModal'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export default function ContractsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const debounced = useDebouncedValue(search, 250)
  const { data, isLoading } = useContracts({ search: debounced, status: status || undefined, page, pageSize: 25 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="text-sm text-fg-muted">Track agreements and signed PDFs</p>
        </div>
        <Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New contract</Button>
      </div>
      <div className="flex gap-2 max-w-xl">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} className="w-40">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="expired">Expired</option>
          <option value="canceled">Canceled</option>
        </Select>
        <Input placeholder="Search contracts" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : data?.rows.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No contracts yet"
          description="Track agreements and upload signed PDFs."
          action={<Button onClick={() => setFormOpen(true)}><Plus className="size-4" /> New contract</Button>}
        />
      ) : (
        <>
          <Table>
            <THead><TR><TH>Title</TH><TH>Client</TH><TH>Value</TH><TH>Dates</TH><TH>Status</TH></TR></THead>
            <tbody>
              {data.rows.map((c) => (
                <TR key={c.id}>
                  <TD><Link to={`/contracts/${c.id}`} className="font-medium hover:text-primary">{c.title}</Link></TD>
                  <TD className="text-fg-muted">{c.clients?.name}</TD>
                  <TD>{c.value != null ? formatCurrency(c.value, c.currency) : '—'}</TD>
                  <TD className="text-fg-muted text-xs">
                    {c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}
                  </TD>
                  <TD><ContractStatusBadge status={c.status} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </>
      )}
      {formOpen ? <ContractFormModal open onClose={() => setFormOpen(false)} /> : null}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(contracts): list page and create/edit form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 49: Contract detail page + PDF upload

**Files:**
- Create: `src/features/contracts/ContractPdfUploader.jsx`
- Modify: `src/pages/ContractDetailPage.jsx`
- Update `ContractsTab` on client detail to list contracts

- [ ] **Step 1: ContractPdfUploader.jsx**

```jsx
import { useRef, useState } from 'react'
import { Upload, FileText, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useUploadContractPdf } from '@/hooks/useContracts'
import { getSignedPdfUrl } from '@/api/contracts'

export function ContractPdfUploader({ contract }) {
  const fileRef = useRef(null)
  const upload = useUploadContractPdf()
  const [opening, setOpening] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF must be under 10MB')
      return
    }
    try {
      await upload.mutateAsync({ id: contract.id, file })
      toast.success('PDF uploaded')
    } catch (e) {
      toast.error(e.userMessage || 'Upload failed')
    }
  }

  const handleOpen = async () => {
    try {
      setOpening(true)
      const url = await getSignedPdfUrl(contract.pdf_storage_path)
      window.open(url, '_blank')
    } catch (e) {
      toast.error(e.userMessage)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <h3 className="text-sm font-semibold mb-3">Signed PDF</h3>
      {contract.pdf_storage_path ? (
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm">
            <FileText className="size-4" /> {contract.pdf_storage_path.split('/').pop()}
          </span>
          <Button variant="secondary" onClick={handleOpen} loading={opening}>
            <ExternalLink className="size-4" /> Open
          </Button>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">No PDF uploaded.</p>
      )}
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <div className="mt-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
          <Upload className="size-4" /> {contract.pdf_storage_path ? 'Replace PDF' : 'Upload PDF'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ContractDetailPage.jsx**

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useContract, useDeleteContract } from '@/hooks/useContracts'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ContractFormModal } from '@/features/contracts/ContractFormModal'
import { ContractStatusBadge } from '@/features/contracts/ContractStatusBadge'
import { ContractPdfUploader } from '@/features/contracts/ContractPdfUploader'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'

export default function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: contract, isLoading, error } = useContract(id)
  const del = useDeleteContract()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) return <Skeleton className="h-32" />
  if (error || !contract) return <p>Contract not found. <button onClick={() => navigate('/contracts')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{contract.title}</h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="text-sm text-fg-muted">{contract.clients?.name}{contract.projects ? ` · ${contract.projects.name}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}><Edit className="size-4" /> Edit</Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <h3 className="text-sm font-semibold mb-3">Details</h3>
          <dl className="text-sm space-y-1">
            <div><dt className="inline text-fg-muted">Value: </dt><dd className="inline">{contract.value != null ? formatCurrency(contract.value, contract.currency) : '—'}</dd></div>
            <div><dt className="inline text-fg-muted">Starts: </dt><dd className="inline">{contract.start_date ? formatDate(contract.start_date) : '—'}</dd></div>
            <div><dt className="inline text-fg-muted">Ends: </dt><dd className="inline">{contract.end_date ? formatDate(contract.end_date) : '—'}</dd></div>
          </dl>
          {contract.description ? (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase text-fg-muted mb-1">Description</h4>
              <p className="text-sm whitespace-pre-line">{contract.description}</p>
            </div>
          ) : null}
        </div>
        <ContractPdfUploader contract={contract} />
      </div>

      {editOpen ? <ContractFormModal open onClose={() => setEditOpen(false)} contract={contract} /> : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete contract?"
        body="This cannot be undone. Uploaded PDFs will be orphaned."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try { await del.mutateAsync(contract.id); toast.success('Contract deleted'); navigate('/contracts', { replace: true }) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 3: Wire ContractsTab on client detail**

```jsx
// src/features/clients/tabs/ContractsTab.jsx
import { Link } from 'react-router-dom'
import { useContracts } from '@/hooks/useContracts'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { ContractStatusBadge } from '@/features/contracts/ContractStatusBadge'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'

export function ContractsTab({ clientId }) {
  const { data } = useContracts({ clientId, pageSize: 100 })
  if (!data?.rows.length) return <p className="text-sm text-fg-muted">No contracts for this client.</p>
  return (
    <Table>
      <THead><TR><TH>Title</TH><TH>Value</TH><TH>Dates</TH><TH>Status</TH></TR></THead>
      <tbody>
        {data.rows.map((c) => (
          <TR key={c.id}>
            <TD><Link to={`/contracts/${c.id}`} className="font-medium hover:text-primary">{c.title}</Link></TD>
            <TD>{c.value != null ? formatCurrency(c.value, c.currency) : '—'}</TD>
            <TD className="text-fg-muted text-xs">{c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}</TD>
            <TD><ContractStatusBadge status={c.status} /></TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(contracts): detail page with PDF upload and client-detail tab wiring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 50: api/invoices.js + invoice-line-items.js + invoice-payments.js + hooks

**Files:**
- Create: `src/api/invoices.js`
- Create: `src/api/invoice-line-items.js`
- Create: `src/api/invoice-payments.js`
- Create: `src/hooks/useInvoices.js`
- Create: `src/hooks/useInvoiceLineItems.js`
- Create: `src/hooks/useInvoicePayments.js`

- [ ] **Step 1: api/invoices.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listInvoices({ clientId, projectId, status, search = '', currency, sort = { field: 'issue_date', dir: 'desc' }, page = 0, pageSize = 25 } = {}) {
  let q = supabase.from('invoices').select('*, clients(name), projects(name)', { count: 'exact' })
  if (clientId) q = q.eq('client_id', clientId)
  if (projectId) q = q.eq('project_id', projectId)
  if (status) q = q.eq('status', status)
  if (currency) q = q.eq('currency', currency)
  if (search) q = q.ilike('invoice_number', `%${search}%`)
  q = q.order(sort.field, { ascending: sort.dir === 'asc' })
  q = q.range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw mapPostgresError(error)
  return { rows: data || [], total: count || 0 }
}

export async function getInvoice(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(*), projects(name), invoice_line_items(*), invoice_payments(*)')
    .eq('id', id)
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function nextInvoiceNumber() {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const { data, error } = await supabase.rpc('next_invoice_number', { p_user_id: userId })
  if (error) throw mapPostgresError(error)
  return data
}

export async function createInvoice({ line_items, ...input }) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw mapPostgresError(error)
  if (line_items?.length) {
    const rows = line_items.map((li, i) => ({ ...li, invoice_id: invoice.id, user_id: userId, position: li.position ?? i }))
    const { error: liErr } = await supabase.from('invoice_line_items').insert(rows)
    if (liErr) throw mapPostgresError(liErr)
  }
  return invoice
}

export async function updateInvoice(id, patch) {
  const { data, error } = await supabase.from('invoices').update(patch).eq('id', id).select().single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function duplicateInvoice(sourceId) {
  const src = await getInvoice(sourceId)
  const newNumber = await nextInvoiceNumber()
  const todayIso = new Date().toISOString().slice(0, 10)
  return createInvoice({
    client_id: src.client_id,
    project_id: src.project_id,
    invoice_number: newNumber,
    issue_date: todayIso,
    due_date: todayIso,
    currency: src.currency,
    notes: src.notes,
    terms: src.terms,
    payment_instructions: src.payment_instructions,
    line_items: (src.invoice_line_items || []).map(({ id, invoice_id, user_id, created_at, updated_at, ...rest }) => rest),
  })
}
```

- [ ] **Step 2: api/invoice-line-items.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function replaceLineItems(invoiceId, items) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const { error: delErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
  if (delErr) throw mapPostgresError(delErr)
  if (!items.length) return []
  const rows = items.map((li, i) => ({ ...li, invoice_id: invoiceId, user_id: userId, position: li.position ?? i }))
  const { data, error } = await supabase.from('invoice_line_items').insert(rows).select()
  if (error) throw mapPostgresError(error)
  return data
}
```

- [ ] **Step 3: api/invoice-payments.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listPayments(invoiceId) {
  const { data, error } = await supabase.from('invoice_payments').select('*').eq('invoice_id', invoiceId).order('paid_at', { ascending: false })
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function createPayment(input) {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  const { data, error } = await supabase
    .from('invoice_payments')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw mapPostgresError(error)
  return data
}

export async function deletePayment(id) {
  const { error } = await supabase.from('invoice_payments').delete().eq('id', id)
  if (error) throw mapPostgresError(error)
}
```

- [ ] **Step 4: hooks/useInvoices.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/invoices'
import { replaceLineItems } from '@/api/invoice-line-items'

export function useInvoices(params) {
  return useQuery({ queryKey: ['invoices', 'list', params], queryFn: () => api.listInvoices(params), keepPreviousData: true })
}
export function useInvoice(id) {
  return useQuery({ queryKey: ['invoices', 'detail', id], queryFn: () => api.getInvoice(id), enabled: !!id })
}
export function useNextInvoiceNumber() {
  return useQuery({ queryKey: ['invoice-next-number'], queryFn: api.nextInvoiceNumber, staleTime: 0, gcTime: 0 })
}
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['invoices'] })
}
export function useCreateInvoice() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createInvoice, onSuccess: inv })
}
export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updateInvoice(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoices', 'list'] })
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', id] })
    },
  })
}
export function useReplaceLineItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, items }) => replaceLineItems(invoiceId, items),
    onSuccess: (_, { invoiceId }) => qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] }),
  })
}
export function useDeleteInvoice() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deleteInvoice, onSuccess: inv })
}
export function useDuplicateInvoice() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.duplicateInvoice, onSuccess: inv })
}
```

- [ ] **Step 5: hooks/useInvoicePayments.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/invoice-payments'

export function useInvoicePayments(invoiceId) {
  return useQuery({ queryKey: ['invoice-payments', invoiceId], queryFn: () => api.listPayments(invoiceId), enabled: !!invoiceId })
}
export function useCreatePayment(invoiceId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] })
    },
  })
}
export function useDeletePayment(invoiceId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deletePayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] })
    },
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(invoices): API + hooks for invoices, line items, payments

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 51: Invoices list page (table + status switcher)

**Files:**
- Create: `src/features/invoices/InvoiceStatusBadge.jsx`
- Modify: `src/pages/InvoicesPage.jsx`

- [ ] **Step 1: InvoiceStatusBadge.jsx**

```jsx
import { Badge } from '@/components/ui/Badge'
const MAP = { draft: 'default', sent: 'info', viewed: 'info', paid: 'success', overdue: 'danger', void: 'default' }
export function InvoiceStatusBadge({ status }) {
  return <Badge variant={MAP[status] || 'default'}>{status}</Badge>
}
```

- [ ] **Step 2: InvoicesPage.jsx**

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { useInvoices, useCreateInvoice, useNextInvoiceNumber } from '@/hooks/useInvoices'
import { useProfile } from '@/hooks/useProfile'
import { useClients } from '@/hooks/useClients'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toast } from 'sonner'

const STATUSES = ['', 'draft', 'sent', 'viewed', 'paid', 'overdue', 'void']

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedValue(search, 250)
  const { data, isLoading } = useInvoices({ search: debounced, status: status || undefined, page, pageSize: 25 })
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 1 })

  const create = useCreateInvoice()
  const nextNum = useNextInvoiceNumber()

  const handleNew = async () => {
    if (!clientsPage?.rows?.length) {
      toast.error('Add a client first')
      return
    }
    try {
      const number = await nextNum.refetch().then((r) => r.data)
      const inv = await create.mutateAsync({
        client_id: clientsPage.rows[0].id,
        invoice_number: number,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        currency: profile?.default_currency || 'USD',
        line_items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: 0 }],
      })
      navigate(`/invoices/${inv.id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not create draft invoice')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-fg-muted">Drafts, sent, paid, and overdue</p>
        </div>
        <Button onClick={handleNew} loading={create.isPending}><Plus className="size-4" /> New invoice</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(0) }}
            className={
              'rounded-full px-3 py-1 text-sm border ' +
              (status === s ? 'bg-primary text-primary-fg border-primary' : 'border-border text-fg-muted hover:bg-bg-muted')
            }
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      <Input placeholder="Search by invoice number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="max-w-sm" />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : data?.rows.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Spin up your first draft." action={<Button onClick={handleNew}><Plus className="size-4" /> New invoice</Button>} />
      ) : (
        <>
          <Table>
            <THead><TR><TH>Number</TH><TH>Client</TH><TH>Issue</TH><TH>Due</TH><TH>Status</TH></TR></THead>
            <tbody>
              {data.rows.map((inv) => (
                <TR key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <TD className="font-medium">{inv.invoice_number}</TD>
                  <TD className="text-fg-muted">{inv.clients?.name}</TD>
                  <TD className="text-xs text-fg-muted">{formatDate(inv.issue_date)}</TD>
                  <TD className="text-xs text-fg-muted">{formatDate(inv.due_date)}</TD>
                  <TD><InvoiceStatusBadge status={inv.status} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire InvoicesTab on client detail**

```jsx
// src/features/clients/tabs/InvoicesTab.jsx
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { Table, THead, TR, TH, TD } from '@/components/ui/Table'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { formatDate } from '@/lib/date'

export function InvoicesTab({ clientId }) {
  const { data } = useInvoices({ clientId, pageSize: 100 })
  if (!data?.rows.length) return <p className="text-sm text-fg-muted">No invoices for this client.</p>
  return (
    <Table>
      <THead><TR><TH>Number</TH><TH>Issue</TH><TH>Due</TH><TH>Status</TH></TR></THead>
      <tbody>
        {data.rows.map((inv) => (
          <TR key={inv.id}>
            <TD><Link to={`/invoices/${inv.id}`} className="font-medium hover:text-primary">{inv.invoice_number}</Link></TD>
            <TD className="text-xs text-fg-muted">{formatDate(inv.issue_date)}</TD>
            <TD className="text-xs text-fg-muted">{formatDate(inv.due_date)}</TD>
            <TD><InvoiceStatusBadge status={inv.status} /></TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(invoices): list page with status switcher and quick-create

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 52: Invoice editor — header + line items + totals + footer

**Files:**
- Create: `src/features/invoices/InvoiceEditor.jsx`
- Create: `src/features/invoices/LineItemsTable.jsx`
- Create: `src/features/invoices/TotalsPanel.jsx`
- Modify: `src/pages/InvoiceDetailPage.jsx`

- [ ] **Step 1: LineItemsTable.jsx**

```jsx
import { useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

export function LineItemsTable({ control, register }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-elevated text-xs uppercase text-fg-muted">
          <tr>
            <th className="text-left px-3 py-2 w-[40%]">Description</th>
            <th className="text-right px-3 py-2 w-[10%]">Qty</th>
            <th className="text-right px-3 py-2 w-[15%]">Unit price</th>
            <th className="text-right px-3 py-2 w-[10%]">Tax %</th>
            <th className="text-right px-3 py-2 w-[10%]">Disc %</th>
            <th className="px-3 py-2 w-[5%]" />
          </tr>
        </thead>
        <tbody>
          {fields.map((field, i) => (
            <tr key={field.id} className="border-t border-border">
              <td className="px-2 py-2">
                <Textarea rows={1} {...register(`line_items.${i}.description`)} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.01" className="text-right" {...register(`line_items.${i}.quantity`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.01" className="text-right" {...register(`line_items.${i}.unit_price`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.1" className="text-right" {...register(`line_items.${i}.tax_rate`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2">
                <Input type="number" step="0.1" className="text-right" {...register(`line_items.${i}.discount_rate`, { valueAsNumber: true })} />
              </td>
              <td className="px-2 py-2 text-right">
                <Button variant="ghost" size="sm" type="button" onClick={() => remove(i)} aria-label="Remove">
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 bg-bg-elevated">
        <Button
          type="button"
          variant="ghost"
          onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: fields.length })}
        >
          <Plus className="size-4" /> Add line
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TotalsPanel.jsx**

```jsx
import { useWatch } from 'react-hook-form'
import { invoiceTotals } from '@/lib/money'
import { formatCurrency } from '@/lib/currency'

export function TotalsPanel({ control }) {
  const lines = useWatch({ control, name: 'line_items' }) || []
  const currency = useWatch({ control, name: 'currency' }) || 'USD'
  const totals = invoiceTotals(lines)
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-1 text-sm">
      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, currency)}</span></div>
      {totals.discount > 0 ? (
        <div className="flex justify-between text-fg-muted"><span>Discount</span><span>−{formatCurrency(totals.discount, currency)}</span></div>
      ) : null}
      {Object.entries(totals.taxByRate).map(([rate, amount]) => (
        <div key={rate} className="flex justify-between text-fg-muted"><span>Tax {rate}%</span><span>{formatCurrency(amount, currency)}</span></div>
      ))}
      <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
        <span>Total</span><span>{formatCurrency(totals.total, currency)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: InvoiceEditor.jsx**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { invoiceCreateSchema } from '@/api/schemas/invoices'
import { useUpdateInvoice, useReplaceLineItems } from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { LineItemsTable } from './LineItemsTable'
import { TotalsPanel } from './TotalsPanel'

export function InvoiceEditor({ invoice }) {
  const update = useUpdateInvoice()
  const replaceLines = useReplaceLineItems()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(invoiceCreateSchema),
    defaultValues: {
      client_id: invoice.client_id,
      project_id: invoice.project_id,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      currency: invoice.currency,
      notes: invoice.notes ?? '',
      terms: invoice.terms ?? '',
      payment_instructions: invoice.payment_instructions ?? '',
      line_items: (invoice.invoice_line_items || []).sort((a, b) => a.position - b.position).map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
        tax_rate: Number(li.tax_rate),
        discount_rate: Number(li.discount_rate),
        position: li.position,
      })),
    },
  })
  const selectedClient = watch('client_id')
  const { data: projects = [] } = useProjects({ clientId: selectedClient, status: 'all' })

  const onSubmit = async (values) => {
    try {
      const { line_items, ...rest } = values
      await update.mutateAsync({ id: invoice.id, patch: rest })
      await replaceLines.mutateAsync({ invoiceId: invoice.id, items: line_items.map((li, i) => ({ ...li, position: i })) })
      toast.success('Invoice saved')
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="client_id" required>Client</Label>
          <Select id="client_id" {...register('client_id')}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <FieldError>{errors.client_id?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="project_id">Project (optional)</Label>
          <Select id="project_id" {...register('project_id')}>
            <option value="">—</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label htmlFor="invoice_number" required>Number</Label>
          <Input id="invoice_number" {...register('invoice_number')} />
        </div>
        <div>
          <Label htmlFor="issue_date" required>Issue date</Label>
          <Input id="issue_date" type="date" {...register('issue_date')} />
        </div>
        <div>
          <Label htmlFor="due_date" required>Due date</Label>
          <Input id="due_date" type="date" {...register('due_date')} />
        </div>
        <div>
          <Label htmlFor="currency" required>Currency</Label>
          <Select id="currency" {...register('currency')}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </div>
      </div>

      <div>
        <Label>Line items</Label>
        <LineItemsTable control={control} register={register} />
        <FieldError>{errors.line_items?.message}</FieldError>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>
          <div>
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" rows={2} {...register('terms')} />
          </div>
          <div>
            <Label htmlFor="payment_instructions">Payment instructions</Label>
            <Textarea id="payment_instructions" rows={2} {...register('payment_instructions')} />
          </div>
        </div>
        <TotalsPanel control={control} />
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-bg px-6 py-3 flex justify-end gap-2">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: InvoiceDetailPage.jsx**

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useInvoice } from '@/hooks/useInvoices'
import { Skeleton } from '@/components/ui/Skeleton'
import { InvoiceEditor } from '@/features/invoices/InvoiceEditor'
import { InvoiceActions } from '@/features/invoices/InvoiceActions'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: invoice, isLoading, error } = useInvoice(id)

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !invoice) return <p>Invoice not found. <button onClick={() => navigate('/invoices')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{invoice.invoice_number}</h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <InvoiceActions invoice={invoice} />
      </div>
      <InvoiceEditor invoice={invoice} />
    </div>
  )
}
```

- [ ] **Step 5: Stub InvoiceActions (full impl in Task 54)**

```jsx
// src/features/invoices/InvoiceActions.jsx
export function InvoiceActions() { return null }
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(invoices): editor with line items, totals panel, footer fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 53: Invoice preview pane (HTML mock of PDF — real PDF in Phase 2)

**Files:**
- Create: `src/features/invoices/InvoicePreview.jsx`
- Modify: `src/pages/InvoiceDetailPage.jsx` (split view)

- [ ] **Step 1: InvoicePreview.jsx**

```jsx
import { useWatch } from 'react-hook-form'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { invoiceTotals } from '@/lib/money'
import { useProfile } from '@/hooks/useProfile'

export function InvoicePreview({ control, client }) {
  const values = useWatch({ control })
  const { data: profile } = useProfile()
  const totals = invoiceTotals(values?.line_items || [])
  const tier = profile?.subscription_tier ?? 'free'
  const branded = tier !== 'free'

  return (
    <div className="rounded-lg border border-border bg-white text-black p-6 text-sm leading-snug min-h-[800px]">
      <div className="flex justify-between items-start mb-6">
        <div>
          {branded && profile?.logo_url ? (
            <img src={profile.logo_url} alt="" className="h-12 mb-2" />
          ) : (
            <h2 className="text-xl font-bold" style={{ color: branded ? profile?.invoice_accent_color : '#2D3E50' }}>
              {profile?.business_name || 'Your Business'}
            </h2>
          )}
          {profile?.address ? <p className="text-xs whitespace-pre-line">{profile.address}</p> : null}
          {profile?.tax_id ? <p className="text-xs">Tax ID: {profile.tax_id}</p> : null}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold tracking-tight">INVOICE</h1>
          <p className="text-xs mt-1">{values?.invoice_number}</p>
          <p className="text-xs">Issued: {values?.issue_date ? formatDate(values.issue_date) : '—'}</p>
          <p className="text-xs">Due: {values?.due_date ? formatDate(values.due_date) : '—'}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs uppercase text-gray-500 mb-1">Bill to</p>
        <p className="font-medium">{client?.name}</p>
        {client?.company ? <p>{client.company}</p> : null}
        {client?.address ? <p className="text-xs whitespace-pre-line">{client.address}</p> : null}
      </div>

      <table className="w-full mb-6 text-xs">
        <thead className="border-b border-gray-300">
          <tr>
            <th className="text-left py-2">Description</th>
            <th className="text-right py-2">Qty</th>
            <th className="text-right py-2">Unit</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {(values?.line_items || []).map((li, i) => {
            const lineTotal = (Number(li.quantity) || 0) * (Number(li.unit_price) || 0)
            return (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-2 pr-2 whitespace-pre-line">{li.description || '—'}</td>
                <td className="py-2 text-right">{Number(li.quantity || 0)}</td>
                <td className="py-2 text-right">{formatCurrency(Number(li.unit_price || 0), values.currency || 'USD')}</td>
                <td className="py-2 text-right">{formatCurrency(lineTotal, values.currency || 'USD')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="ml-auto w-64 text-xs space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, values?.currency || 'USD')}</span></div>
        {totals.discount > 0 ? <div className="flex justify-between"><span>Discount</span><span>−{formatCurrency(totals.discount, values?.currency || 'USD')}</span></div> : null}
        {Object.entries(totals.taxByRate).map(([r, a]) => (
          <div key={r} className="flex justify-between"><span>Tax {r}%</span><span>{formatCurrency(a, values?.currency || 'USD')}</span></div>
        ))}
        <div className="border-t border-gray-400 pt-1 font-semibold flex justify-between">
          <span>Total</span><span>{formatCurrency(totals.total, values?.currency || 'USD')}</span>
        </div>
      </div>

      {values?.notes ? <div className="mt-6 text-xs"><p className="font-semibold">Notes</p><p className="whitespace-pre-line">{values.notes}</p></div> : null}
      {values?.terms ? <div className="mt-3 text-xs"><p className="font-semibold">Terms</p><p className="whitespace-pre-line">{values.terms}</p></div> : null}
      {values?.payment_instructions ? <div className="mt-3 text-xs"><p className="font-semibold">Payment</p><p className="whitespace-pre-line">{values.payment_instructions}</p></div> : null}

      {branded && profile?.invoice_footer ? <p className="mt-8 text-center text-xs text-gray-600 whitespace-pre-line">{profile.invoice_footer}</p> : null}
    </div>
  )
}
```

- [ ] **Step 2: Update InvoiceEditor to expose `control` and use a 2-column layout via parent**

Wrap return statement contents in a Fragment and split out `control` to a sibling preview. For simplicity, refactor the editor into two pieces: the form on the left, preview on the right. The editor file already has `control`; we'll expose a render prop:

Replace the bottom of `InvoiceEditor.jsx` with this — split form vs preview at the page level:

Actually, simpler approach: have `InvoiceEditor` render both sides itself. Update `InvoiceEditor.jsx` final JSX:

```jsx
// Replace the existing return body to a two-column layout:
return (
  <form onSubmit={handleSubmit(onSubmit)} className="grid lg:grid-cols-2 gap-6">
    <div className="space-y-4">
      {/* All the form fields (client/project/numbers/dates/currency/lineItems/notes/terms/instructions/totals) */}
      {/* keep the same content but drop the sticky save bar and the right-side TotalsPanel — moved below */}
      {/* ... (same as before) ... */}
      <TotalsPanel control={control} />
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save</Button>
    </div>
    <div className="lg:sticky lg:top-20 h-fit">
      <InvoicePreview control={control} client={clients.find((c) => c.id === selectedClient)} />
    </div>
  </form>
)
```

(Adjust as needed; keep the form on the left, preview on the right, with sticky preview on large screens.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(invoices): live HTML preview pane (PDF lands in Phase 2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 54: Invoice state machine actions — send/paid/void/duplicate/delete

**Files:**
- Replace: `src/features/invoices/InvoiceActions.jsx`
- Create: `src/features/invoices/MarkPaidModal.jsx`

- [ ] **Step 1: MarkPaidModal.jsx**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { paymentCreateSchema } from '@/api/schemas/invoice-payments'
import { useCreatePayment } from '@/hooks/useInvoicePayments'
import { useUpdateInvoice } from '@/hooks/useInvoices'
import { invoiceTotals } from '@/lib/money'

export function MarkPaidModal({ open, onClose, invoice }) {
  const create = useCreatePayment(invoice.id)
  const update = useUpdateInvoice()
  const totals = invoiceTotals(invoice.invoice_line_items || [])
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: {
      invoice_id: invoice.id,
      amount: totals.total,
      currency: invoice.currency,
      paid_at: new Date().toISOString().slice(0, 10),
      method: 'bank',
      notes: '',
    },
  })

  const onSubmit = async (values) => {
    try {
      await create.mutateAsync({ ...values, amount: Number(values.amount), paid_at: new Date(values.paid_at).toISOString() })
      await update.mutateAsync({ id: invoice.id, patch: { status: 'paid', paid_at: new Date().toISOString() } })
      toast.success('Invoice marked as paid')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Failed to record payment')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark as paid" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="amount" required>Amount</Label>
            <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="paid_at" required>Paid date</Label>
            <Input id="paid_at" type="date" {...register('paid_at')} />
          </div>
        </div>
        <div>
          <Label htmlFor="method">Method</Label>
          <Select id="method" {...register('method')}>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
            <option value="manual">Manual</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" {...register('notes')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Record payment</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: InvoiceActions.jsx**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, CheckCircle2, Ban, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUpdateInvoice, useDuplicateInvoice, useDeleteInvoice } from '@/hooks/useInvoices'
import { MarkPaidModal } from './MarkPaidModal'

export function InvoiceActions({ invoice }) {
  const navigate = useNavigate()
  const update = useUpdateInvoice()
  const dup = useDuplicateInvoice()
  const del = useDeleteInvoice()
  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canMarkSent = invoice.status === 'draft'
  const canMarkPaid = ['sent', 'viewed', 'overdue'].includes(invoice.status)
  const canVoid = ['sent', 'viewed', 'overdue'].includes(invoice.status)
  const canDelete = invoice.status === 'draft'

  return (
    <div className="flex gap-2">
      {canMarkSent ? (
        <Button
          onClick={async () => {
            try { await update.mutateAsync({ id: invoice.id, patch: { status: 'sent', sent_at: new Date().toISOString() } }); toast.success('Marked as sent') }
            catch (e) { toast.error(e.userMessage) }
          }}
        >
          <Send className="size-4" /> Mark sent
        </Button>
      ) : null}
      {canMarkPaid ? (
        <Button onClick={() => setMarkPaidOpen(true)}><CheckCircle2 className="size-4" /> Mark paid</Button>
      ) : null}
      <Button
        variant="secondary"
        onClick={async () => {
          try { const inv = await dup.mutateAsync(invoice.id); toast.success('Duplicated'); navigate(`/invoices/${inv.id}`) }
          catch (e) { toast.error(e.userMessage) }
        }}
      >
        <Copy className="size-4" /> Duplicate
      </Button>
      {canVoid ? (
        <Button variant="secondary" onClick={() => setConfirmVoid(true)}><Ban className="size-4" /> Void</Button>
      ) : null}
      {canDelete ? (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</Button>
      ) : null}

      <MarkPaidModal open={markPaidOpen} onClose={() => setMarkPaidOpen(false)} invoice={invoice} />

      <ConfirmDialog
        open={confirmVoid}
        title="Void this invoice?"
        body="Voiding marks it canceled but preserves the invoice number for your records. This cannot be undone."
        confirmLabel="Void"
        variant="danger"
        onCancel={() => setConfirmVoid(false)}
        onConfirm={async () => {
          try { await update.mutateAsync({ id: invoice.id, patch: { status: 'void' } }); toast.success('Invoice voided'); setConfirmVoid(false) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={update.isPending}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft?"
        body="Draft invoices can be deleted. Sent or paid invoices must be voided instead."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try { await del.mutateAsync(invoice.id); toast.success('Deleted'); navigate('/invoices', { replace: true }) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(invoices): state-machine actions (sent/paid/void/duplicate/delete)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

**End of Milestone 4.** Push: `git push origin main`.

---

## Milestone 5 — Dashboard + Profile + E2E + Deploy (Tasks 55–64)

### Task 55: Migration — user_notifications + usage_events + error_logs

**Files:**
- Create: `supabase/migrations/<ts>__support_tables.sql`

- [ ] **Step 1: Scaffold + fill migration**

```bash
supabase migration new support_tables
```

```sql
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  link_to text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_notifications_user_idx on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
create policy "user_notifications_select_own" on public.user_notifications for select using (user_id = auth.uid());
create policy "user_notifications_update_own" on public.user_notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Inserts come from server-side jobs (service_role), not end users.

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;
create policy "usage_events_insert_own"
  on public.usage_events for insert
  with check (user_id is null or user_id = auth.uid());
-- No SELECT for end users; analytics consumes via service_role.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.error_logs enable row level security;
create policy "error_logs_insert_own"
  on public.error_logs for insert
  with check (user_id is null or user_id = auth.uid());
```

- [ ] **Step 2: Apply + push**

```bash
supabase db reset
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "db: add user_notifications, usage_events, error_logs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 56: api/notifications.js + topbar bell shows count

**Files:**
- Create: `src/api/notifications.js`
- Create: `src/hooks/useNotifications.js`
- Modify: `src/components/layout/NotificationBell.jsx`

- [ ] **Step 1: api/notifications.js**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function listNotifications({ unreadOnly = false, limit = 20 } = {}) {
  let q = supabase.from('user_notifications').select('*').order('created_at', { ascending: false }).limit(limit)
  if (unreadOnly) q = q.is('read_at', null)
  const { data, error } = await q
  if (error) throw mapPostgresError(error)
  return data || []
}

export async function unreadCount() {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw mapPostgresError(error)
  return count || 0
}

export async function markRead(id) {
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw mapPostgresError(error)
}

export async function markAllRead() {
  const { error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw mapPostgresError(error)
}
```

- [ ] **Step 2: hooks/useNotifications.js**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/notifications'

export function useNotifications(params) {
  return useQuery({ queryKey: ['notifications', params], queryFn: () => api.listNotifications(params) })
}
export function useUnreadCount() {
  return useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: api.unreadCount, refetchInterval: 60_000 })
}
export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.markRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
}
export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.markAllRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
}
```

- [ ] **Step 3: Update NotificationBell.jsx**

```jsx
import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { relativeTime } from '@/lib/date'
import { useNotifications, useUnreadCount, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { data: count = 0 } = useUnreadCount()
  const { data: notes = [] } = useNotifications({ limit: 10 })
  const markAll = useMarkAllRead()
  const markRead = useMarkRead()

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button className="relative text-fg-muted hover:text-fg" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Bell className="size-5" />
        {count > 0 ? <span className="absolute -top-1 -right-1 size-4 rounded-full bg-danger text-white text-[10px] flex items-center justify-center">{count > 9 ? '9+' : count}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-bg shadow-lg z-40">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 ? <button className="text-xs text-primary" onClick={() => markAll.mutate()}>Mark all read</button> : null}
          </div>
          {notes.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">You're all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-border">
              {notes.map((n) => (
                <li key={n.id} className={n.read_at ? '' : 'bg-bg-elevated'}>
                  <Link
                    to={n.link_to || '#'}
                    onClick={() => { if (!n.read_at) markRead.mutate(n.id); setOpen(false) }}
                    className="block p-3 text-sm hover:bg-bg-muted"
                  >
                    <p>{n.payload?.title || n.kind}</p>
                    {n.payload?.body ? <p className="text-xs text-fg-muted">{n.payload.body}</p> : null}
                    <p className="text-[10px] text-fg-subtle mt-1">{relativeTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(notifications): API + topbar bell with unread count and dropdown

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 57: Dashboard — stats row

**Files:**
- Create: `src/features/dashboard/dashboardStats.js`
- Create: `src/hooks/useDashboardStats.js`
- Create: `src/features/dashboard/StatsRow.jsx`

- [ ] **Step 1: dashboardStats.js (pure helpers)**

```js
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'

export async function fetchDashboardStats() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  const [paid, outstanding, projects] = await Promise.all([
    supabase.from('invoice_payments').select('amount, currency').gte('paid_at', monthStart).lt('paid_at', monthEnd),
    supabase.from('invoices').select('id, currency, invoice_line_items(quantity,unit_price,tax_rate,discount_rate)').in('status', ['sent', 'viewed', 'overdue']),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active').is('archived_at', null),
  ])
  if (paid.error) throw mapPostgresError(paid.error)
  if (outstanding.error) throw mapPostgresError(outstanding.error)
  if (projects.error) throw mapPostgresError(projects.error)

  const groupByCurrency = (rows, valueFn) => {
    const acc = {}
    for (const r of rows || []) {
      const c = r.currency || 'USD'
      acc[c] = (acc[c] || 0) + valueFn(r)
    }
    return acc
  }

  return {
    revenueByCurrency: groupByCurrency(paid.data, (r) => Number(r.amount)),
    outstandingByCurrency: groupByCurrency(outstanding.data, (inv) => {
      // approximate from line items
      const items = inv.invoice_line_items || []
      return items.reduce((s, li) => {
        const gross = Number(li.quantity) * Number(li.unit_price)
        const net = gross * (1 - Number(li.discount_rate) / 100)
        const tax = net * (Number(li.tax_rate) / 100)
        return s + net + tax
      }, 0)
    }),
    overdueCount: outstanding.data?.length ?? 0,
    activeProjectCount: projects.count ?? 0,
  }
}
```

- [ ] **Step 2: hooks/useDashboardStats.js**

```js
import { useQuery } from '@tanstack/react-query'
import { fetchDashboardStats } from '@/features/dashboard/dashboardStats'
export function useDashboardStats() {
  return useQuery({ queryKey: ['dashboard', 'stats'], queryFn: fetchDashboardStats, staleTime: 60_000 })
}
```

- [ ] **Step 3: StatsRow.jsx**

```jsx
import { DollarSign, Clock, AlertTriangle, Briefcase } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useProfile } from '@/hooks/useProfile'
import { TIER_LIMITS } from '@/lib/tier'
import { Skeleton } from '@/components/ui/Skeleton'

function CurrencyList({ map }) {
  const entries = Object.entries(map || {})
  if (!entries.length) return <span className="text-fg-muted">—</span>
  return (
    <div className="flex flex-col">
      {entries.slice(0, 2).map(([c, a]) => (
        <span key={c}>{formatCurrency(a, c)}</span>
      ))}
      {entries.length > 2 ? <span className="text-xs text-fg-muted">+{entries.length - 2} more</span> : null}
    </div>
  )
}

function StatCard({ icon: Icon, label, children }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 flex items-start gap-3">
      <div className="rounded-md bg-primary/10 p-2">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <p className="text-xs uppercase text-fg-muted">{label}</p>
        <div className="mt-1 text-xl font-semibold">{children}</div>
      </div>
    </div>
  )
}

export function StatsRow() {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier].maxActiveProjects

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={DollarSign} label="Revenue this month"><CurrencyList map={stats.revenueByCurrency} /></StatCard>
      <StatCard icon={Clock} label="Outstanding"><CurrencyList map={stats.outstandingByCurrency} /></StatCard>
      <StatCard icon={AlertTriangle} label="Open invoices">{stats.overdueCount}</StatCard>
      <StatCard icon={Briefcase} label="Active projects">
        {stats.activeProjectCount} {limit === Infinity ? '' : <span className="text-fg-muted text-sm">/ {limit}</span>}
      </StatCard>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dashboard): stats row with revenue/outstanding/overdue/projects

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 58: Dashboard — due-soon panel

**Files:**
- Create: `src/features/dashboard/DueSoonPanel.jsx`

- [ ] **Step 1: DueSoonPanel.jsx**

```jsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, FileCheck, CheckSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { formatDate, daysUntil } from '@/lib/date'
import { Skeleton } from '@/components/ui/Skeleton'

async function fetchDueSoon() {
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const [inv, con, tk] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, due_date, clients(name)').in('status', ['sent', 'viewed']).gte('due_date', today).lte('due_date', in7).order('due_date'),
    supabase.from('contracts').select('id, title, end_date, clients(name)').not('end_date', 'is', null).gte('end_date', today).lte('end_date', in30).order('end_date'),
    supabase.from('tasks').select('id, title, due_date, project_id').is('archived_at', null).not('due_date', 'is', null).gte('due_date', today).lte('due_date', in3).order('due_date'),
  ])
  if (inv.error) throw mapPostgresError(inv.error)
  if (con.error) throw mapPostgresError(con.error)
  if (tk.error) throw mapPostgresError(tk.error)
  return {
    invoices: inv.data || [],
    contracts: con.data || [],
    tasks: tk.data || [],
  }
}

export function DueSoonPanel() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'due-soon'], queryFn: fetchDueSoon, staleTime: 60_000 })
  if (isLoading) return <Skeleton className="h-64" />

  const items = [
    ...data.invoices.map((i) => ({ key: 'inv-' + i.id, icon: FileText, title: `${i.invoice_number} · ${i.clients?.name || ''}`, sub: `Due ${formatDate(i.due_date)}`, to: `/invoices/${i.id}`, days: daysUntil(i.due_date) })),
    ...data.contracts.map((c) => ({ key: 'con-' + c.id, icon: FileCheck, title: c.title, sub: `Ends ${formatDate(c.end_date)} · ${c.clients?.name || ''}`, to: `/contracts/${c.id}`, days: daysUntil(c.end_date) })),
    ...data.tasks.map((t) => ({ key: 'tsk-' + t.id, icon: CheckSquare, title: t.title, sub: `Due ${formatDate(t.due_date)}`, to: `/projects/${t.project_id}`, days: daysUntil(t.due_date) })),
  ].sort((a, b) => a.days - b.days).slice(0, 5)

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <h3 className="text-sm font-semibold mb-3">Due soon</h3>
      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">Nothing due in the near term.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => {
            const Icon = i.icon
            return (
              <li key={i.key}>
                <Link to={i.to} className="flex items-start gap-3 rounded-md p-2 hover:bg-bg-muted">
                  <Icon className="size-4 mt-0.5 text-fg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{i.title}</p>
                    <p className="text-xs text-fg-muted">{i.sub}</p>
                  </div>
                  <span className="text-xs text-fg-subtle">{i.days}d</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(dashboard): due-soon panel for invoices, contracts, tasks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 59: Dashboard — recent activity + page assembly

**Files:**
- Create: `src/features/dashboard/RecentActivity.jsx`
- Create: `src/features/dashboard/OnboardingChecklist.jsx`
- Modify: `src/pages/DashboardPage.jsx`

- [ ] **Step 1: RecentActivity.jsx**

```jsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { mapPostgresError } from '@/lib/errors'
import { relativeTime } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'
import { Skeleton } from '@/components/ui/Skeleton'

async function fetchRecent() {
  const [payments, invoices, contracts, projects] = await Promise.all([
    supabase.from('invoice_payments').select('id, amount, currency, paid_at, invoice_id, invoices(invoice_number, clients(name))').order('paid_at', { ascending: false }).limit(5),
    supabase.from('invoices').select('id, invoice_number, status, updated_at, clients(name)').order('updated_at', { ascending: false }).limit(5),
    supabase.from('contracts').select('id, title, status, updated_at, clients(name)').order('updated_at', { ascending: false }).limit(5),
    supabase.from('projects').select('id, name, status, updated_at, clients(name)').order('updated_at', { ascending: false }).limit(5),
  ])
  for (const r of [payments, invoices, contracts, projects]) if (r.error) throw mapPostgresError(r.error)
  const events = []
  for (const p of payments.data) events.push({ at: p.paid_at, text: `Payment ${formatCurrency(Number(p.amount), p.currency)} on ${p.invoices?.invoice_number} · ${p.invoices?.clients?.name || ''}`, to: `/invoices/${p.invoice_id}` })
  for (const i of invoices.data) events.push({ at: i.updated_at, text: `Invoice ${i.invoice_number} · ${i.status} · ${i.clients?.name || ''}`, to: `/invoices/${i.id}` })
  for (const c of contracts.data) events.push({ at: c.updated_at, text: `Contract ${c.title} · ${c.status} · ${c.clients?.name || ''}`, to: `/contracts/${c.id}` })
  for (const p of projects.data) events.push({ at: p.updated_at, text: `Project ${p.name} · ${p.status} · ${p.clients?.name || ''}`, to: `/projects/${p.id}` })
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10)
}

export function RecentActivity() {
  const { data: events, isLoading } = useQuery({ queryKey: ['dashboard', 'recent'], queryFn: fetchRecent, staleTime: 30_000 })
  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <h3 className="text-sm font-semibold mb-3">Recent activity</h3>
      {events.length === 0 ? (
        <p className="text-sm text-fg-muted">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e, i) => (
            <li key={i}>
              <Link to={e.to} className="block rounded-md p-2 hover:bg-bg-muted">
                <p className="text-sm">{e.text}</p>
                <p className="text-xs text-fg-muted">{relativeTime(e.at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: OnboardingChecklist.jsx**

```jsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

async function fetchCounts() {
  const [c, p, k, i] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['sent', 'viewed', 'paid']),
  ])
  return { clients: c.count ?? 0, projects: p.count ?? 0, tasks: k.count ?? 0, sentInvoices: i.count ?? 0 }
}

export function OnboardingChecklist() {
  const { data } = useQuery({ queryKey: ['dashboard', 'onboarding'], queryFn: fetchCounts, staleTime: 60_000 })
  if (!data) return null
  const items = [
    { done: data.clients > 0, text: 'Add your first client', to: '/clients' },
    { done: data.projects > 0, text: 'Create your first project', to: '/projects' },
    { done: data.tasks > 0, text: 'Build a kanban board', to: '/projects' },
    { done: data.sentInvoices > 0, text: 'Send your first invoice', to: '/invoices' },
  ]
  if (items.every((i) => i.done)) return null
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <h3 className="text-sm font-semibold mb-3">Get started</h3>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.text}>
            <Link to={i.to} className={'flex items-center gap-2 text-sm ' + (i.done ? 'text-fg-muted' : 'text-fg hover:text-primary')}>
              {i.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-fg-subtle" />}
              <span className={i.done ? 'line-through' : ''}>{i.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: DashboardPage.jsx**

```jsx
import { useProfile } from '@/hooks/useProfile'
import { StatsRow } from '@/features/dashboard/StatsRow'
import { DueSoonPanel } from '@/features/dashboard/DueSoonPanel'
import { RecentActivity } from '@/features/dashboard/RecentActivity'
import { OnboardingChecklist } from '@/features/dashboard/OnboardingChecklist'
import { formatDate } from '@/lib/date'

export default function DashboardPage() {
  const { data: profile } = useProfile()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = profile?.display_name || 'there'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{greeting}, {name}</h1>
        <p className="text-sm text-fg-muted">{formatDate(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>
      <OnboardingChecklist />
      <StatsRow />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><DueSoonPanel /></div>
        <div><RecentActivity /></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dashboard): recent activity, onboarding checklist, full page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 60: Profile page — Account tab

**Files:**
- Create: `src/features/profile/AccountTab.jsx`
- Modify: `src/pages/ProfilePage.jsx`

- [ ] **Step 1: AccountTab.jsx**

```jsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { updatePassword } from '@/api/auth'

const profileSchema = z.object({
  display_name: z.string().min(1).max(120),
})

const passwordSchema = z.object({
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine((d) => d.new_password === d.confirm, { message: 'Must match', path: ['confirm'] })

export function AccountTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const profileForm = useForm({ resolver: zodResolver(profileSchema), defaultValues: { display_name: profile?.display_name ?? '' } })
  const pwForm = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { new_password: '', confirm: '' } })

  const onProfile = async (values) => {
    try { await update.mutateAsync(values); toast.success('Profile updated') }
    catch (e) { toast.error(e.userMessage) }
  }
  const onPassword = async ({ new_password }) => {
    setPwSubmitting(true)
    try { await updatePassword(new_password); toast.success('Password updated'); pwForm.reset() }
    catch (e) { toast.error(e.userMessage) }
    finally { setPwSubmitting(false) }
  }

  return (
    <div className="grid grid-cols-2 gap-8">
      <form onSubmit={profileForm.handleSubmit(onProfile)} className="space-y-4">
        <h3 className="text-sm font-semibold">Display name</h3>
        <div>
          <Label htmlFor="display_name">Name</Label>
          <Input id="display_name" {...profileForm.register('display_name')} />
          <FieldError>{profileForm.formState.errors.display_name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email (read-only)</Label>
          <Input id="email" value={profile?.email ?? ''} readOnly />
        </div>
        <Button type="submit" loading={profileForm.formState.isSubmitting}>Save</Button>
      </form>

      <form onSubmit={pwForm.handleSubmit(onPassword)} className="space-y-4">
        <h3 className="text-sm font-semibold">Change password</h3>
        <div>
          <Label htmlFor="new_password">New password</Label>
          <Input id="new_password" type="password" {...pwForm.register('new_password')} />
          <FieldError>{pwForm.formState.errors.new_password?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm</Label>
          <Input id="confirm" type="password" {...pwForm.register('confirm')} />
          <FieldError>{pwForm.formState.errors.confirm?.message}</FieldError>
        </div>
        <Button type="submit" loading={pwSubmitting}>Update password</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(profile): account tab with name + password change

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 61: Profile — Business tab + Subscription tab + page assembly

**Files:**
- Create: `src/features/profile/BusinessTab.jsx`
- Create: `src/features/profile/SubscriptionTab.jsx`
- Modify: `src/pages/ProfilePage.jsx`

- [ ] **Step 1: BusinessTab.jsx**

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

const schema = z.object({
  business_name: z.string().max(200).optional().or(z.literal('')),
  tax_id: z.string().max(60).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  default_currency: z.string().length(3),
})

export function BusinessTab() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: profile?.business_name ?? '',
      tax_id: profile?.tax_id ?? '',
      address: profile?.address ?? '',
      default_currency: profile?.default_currency ?? 'USD',
    },
  })
  const onSubmit = async (values) => {
    try { await update.mutateAsync(values); toast.success('Saved') } catch (e) { toast.error(e.userMessage) }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <div>
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" {...register('business_name')} />
      </div>
      <div>
        <Label htmlFor="tax_id">Tax ID</Label>
        <Input id="tax_id" {...register('tax_id')} />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={3} {...register('address')} />
      </div>
      <div>
        <Label htmlFor="default_currency">Default currency</Label>
        <Select id="default_currency" {...register('default_currency')}>
          {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </Select>
        <FieldError>{errors.default_currency?.message}</FieldError>
      </div>
      <Button type="submit" loading={isSubmitting}>Save</Button>
    </form>
  )
}
```

- [ ] **Step 2: SubscriptionTab.jsx**

```jsx
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useProfile } from '@/hooks/useProfile'
import { getSplashUpgradeUrl } from '@/lib/tier'

export function SubscriptionTab() {
  const { data: profile } = useProfile()
  const tier = profile?.subscription_tier ?? 'free'
  const status = profile?.subscription_status ?? 'active'
  const splashUrl = import.meta.env.VITE_SPLASH_URL || 'https://loomlance.com'
  return (
    <div className="space-y-4 max-w-xl">
      <div className="rounded-lg border border-border bg-bg-elevated p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-fg-muted">Current plan</p>
            <p className="text-xl font-semibold capitalize">{tier.replace('_', ' ')}</p>
            <Badge variant={status === 'active' ? 'success' : 'warning'} className="mt-1">{status}</Badge>
          </div>
          <Button as="a" onClick={() => window.open(`${splashUrl}/billing`, '_blank')}>
            <ExternalLink className="size-4" /> Manage subscription
          </Button>
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          Billing, plan changes, and invoices for your LoomLance subscription are managed on the main site.
        </p>
      </div>
      {tier === 'free' || tier === 'tier_1' ? (
        <div>
          <p className="text-sm">Want more projects, branded invoices, time tracking, expenses, or reports?</p>
          <Button as="a" onClick={() => window.open(getSplashUpgradeUrl(tier === 'free' ? 'tier_1' : 'tier_2'), '_blank')}>
            See plans
          </Button>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: ProfilePage.jsx**

```jsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '@/components/ui/Tabs'
import { AccountTab } from '@/features/profile/AccountTab'
import { BusinessTab } from '@/features/profile/BusinessTab'
import { SubscriptionTab } from '@/features/profile/SubscriptionTab'

const TABS = [
  { key: 'account', label: 'Account' },
  { key: 'business', label: 'Business' },
  { key: 'subscription', label: 'Subscription' },
]

export default function ProfilePage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'account')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-fg-muted">Account, business, and subscription</p>
      </div>
      <Tabs value={tab} onChange={setTab} items={TABS} />
      <div className="pt-2">
        {tab === 'account' && <AccountTab />}
        {tab === 'business' && <BusinessTab />}
        {tab === 'subscription' && <SubscriptionTab />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(profile): business + subscription tabs and tabbed page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 62: Playwright config + happy-path E2E

**Files:**
- Create: `playwright.config.js`
- Create: `tests/e2e/happy-path.spec.js`
- Create: `tests/e2e/.env.example`

- [ ] **Step 1: Create playwright.config.js**

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

- [ ] **Step 2: Install Playwright browsers**

```bash
npx playwright install --with-deps chromium
```

- [ ] **Step 3: tests/e2e/happy-path.spec.js**

```js
import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_USER_EMAIL || 'test@loomlance.local'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'password123'

test('user can sign in, add a client, create a project, draft an invoice', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/')

  // Add a client
  await page.getByRole('link', { name: 'Clients' }).click()
  await page.getByRole('button', { name: /new client/i }).first().click()
  await page.getByLabel('Name').fill('Test Client ' + Date.now())
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()

  // Create a project
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByRole('button', { name: /new project/i }).first().click()
  await page.getByLabel('Client').selectOption({ index: 1 })
  await page.getByLabel('Name').fill('E2E Project')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText('E2E Project').first()).toBeVisible()

  // Draft an invoice
  await page.getByRole('link', { name: 'Invoices' }).click()
  await page.getByRole('button', { name: /new invoice/i }).first().click()
  await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible({ timeout: 10000 })
})
```

- [ ] **Step 4: Run the test (locally — requires a real Supabase user)**

```bash
E2E_USER_EMAIL=test@loomlance.local E2E_USER_PASSWORD=password123 npm run test:e2e
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): Playwright config and happy-path scenario

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 63: Vercel deploy config + production env handling

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

- [ ] **Step 1: Create vercel.json**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

(SPA fallback so client-side routes don't 404 on direct hit.)

- [ ] **Step 2: Manual — connect repo to Vercel**

1. Push to GitHub remote.
2. In Vercel dashboard → New Project → import the GitHub repo.
3. Add environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_SITE_URL` (e.g., `https://app.loomlance.com`)
   - `VITE_SPLASH_URL` (e.g., `https://loomlance.com`)
4. Deploy.
5. Update Supabase Auth → URL Configuration → add Vercel preview + production URLs to Redirect URLs.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: Vercel config for Vite SPA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 64: README rewrite + .env.example final + Phase 1 wrap

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with a focused Phase 1 README**

```markdown
# LoomLance Dashboard

All-in-one freelancer hub. This is the post-login app (clients, projects, kanban, contracts, invoices). Signup, pricing, and Stripe Checkout for the subscription live in the sibling **Loomlance Splash** project.

## Stack

React 18 · Vite · Tailwind · Supabase (Postgres + Auth + Storage) · TanStack Query · react-hook-form + zod · dnd-kit · Vitest · Playwright.

## Quick start

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project
npm install
npx supabase start          # local Supabase via Docker (optional)
npx supabase db push        # push migrations to remote
npm run dev
```

Visit `http://localhost:5173`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest single run |
| `npm run test:e2e` | Playwright |
| `npm run db:start` / `db:stop` | Local Supabase via Docker |
| `npm run db:reset` | Reapply all migrations locally |
| `npm run db:test` | Run SQL tests against local DB |

## Architecture

`src/api/*` are the only files that import `@supabase/supabase-js`. `src/hooks/*` wrap each API function in TanStack Query. UI components only use hooks. RLS + Postgres triggers are the security boundary; frontend tier-gating is UX.

See:
- `docs/superpowers/specs/2026-06-04-loomlance-rebuild-design.md` — design spec
- `docs/superpowers/plans/2026-06-04-loomlance-phase-1-foundation.md` — this phase's implementation plan

## Deploying

Vercel. See `vercel.json`. Configure Supabase Auth → URL Configuration to whitelist your deploy URLs for password reset redirects.
```

- [ ] **Step 2: Commit + final push**

```bash
git add README.md
git commit -m "docs: rewrite README for Phase 1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

**End of Phase 1.** A logged-in user can manage clients (with multiple contacts and tags), run kanban boards on tier-gated projects, draft and edit invoices with line items / multi-currency / manual tax, upload contract PDFs, see a useful dashboard, and edit their profile. Phases 2–4 will add PDF rendering, email sending, Stripe Connect, and Tier 1/2 features.

---

## Self-review check

Spec coverage:
- §1.3 tier matrix — `lib/tier.js` (Task 8), project-limit trigger (Task 32), nav gating (Task 18), action gating (Tasks 37, 38), inline gates (TierGate component, Task 17). ✓
- §2 data model — covered by migrations in Tasks 6, 21, 31, 32, 44, 47, 55. ✓
- §3 architecture — folder structure (Task 1), layering rules (Task 14 onward), all dependencies installed (Task 2), tier gate component (Task 17). ✓
- §4 page-by-page — Login (19), Forgot/Reset (20), Dashboard (57–59), Projects (37–43), Clients (27–30), Contracts (48–49), Invoices (51–54), Profile (60–61). Public hosted invoice page deferred to Phase 3 per spec. ✓
- §5 kanban — Tasks 39–43. ✓
- §6 dashboard widgets — Tasks 57–59. Revenue chart explicitly deferred to Phase 2. ✓
- §7 invoice system (basic, no PDF) — Tasks 50–54. PDF, email, Stripe Connect deferred. ✓
- §8 error handling / notifications / tests — `lib/errors.js` (Task 9), toasts via sonner (Task 11), ConfirmDialog (Task 16), bell (Task 56), SQL tests across migration tasks, Vitest helpers across lib tasks, Playwright (Task 62). ✓

Placeholder scan: no "TBD"/"TODO" steps; one stub component (`ProjectFormModal` in Task 37) is explicitly replaced in Task 38; same for `ClientFormModal` (27 → 28) and `InvoiceActions` (52 → 54). All stubs have a follow-on task. ✓

Type consistency: `subscription_tier` enum values (`free`/`tier_1`/`tier_2`) used consistently across schemas, `lib/tier.js`, and migrations. `invoice_status` enum values match the state-machine actions in Task 54. `feature` keys (`FEATURES.RECURRING_INVOICES` etc.) in `lib/tier.js` match what `Sidebar.jsx` passes to `TierGate`. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-loomlance-phase-1-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?




