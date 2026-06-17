# LoomLance Dashboard

All-in-one freelancer hub. This is the **post-login app** — clients, projects, kanban, contracts, and invoices. Signup, pricing, and Stripe Checkout for the subscription live in the sibling **Loomlance Splash** project; both apps share one Supabase project, so auth is shared. This app owns **login only**.

## Stack

React 18 · Vite · Tailwind CSS · Supabase (Postgres + Auth + Storage) · TanStack Query · react-hook-form + Zod · dnd-kit · lucide-react · Vitest · Playwright.

See [`techstack.md`](./techstack.md) for the full engineering reference and [`UIUXstack.md`](./UIUXstack.md) for the design system (tokens, palette, component library).

## Quick start

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project
npm install
npm run dev
```

Visit `http://localhost:5173`.

> **Database:** this project develops against a **hosted** Supabase project — there is no local Docker stack. Schema changes are authored as SQL migrations in `supabase/migrations/` and applied to the hosted project (via the Supabase CLI or MCP). The `db:*` npm scripts wrap the Supabase CLI for anyone who does want a local stack, but they are optional.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint (zero-warning gate) |
| `npm run test` | Vitest (watch) |
| `npm run test:run` | Vitest (single run) |
| `npm run test:e2e` | Playwright happy-path E2E |
| `npm run db:start` / `db:stop` | Local Supabase via Docker (optional) |
| `npm run db:reset` | Reapply all migrations to a local stack (optional) |
| `npm run db:test` | Run SQL tests against a local stack (optional) |

E2E credentials are read from the environment — see [`tests/e2e/.env.example`](./tests/e2e/.env.example).

## Architecture

`src/api/*` are the only files that import `@supabase/supabase-js`. `src/hooks/*` wrap each API function in TanStack Query. UI components consume hooks, never the client directly. Zod schemas validate input before it reaches the API layer.

Postgres **RLS + triggers are the security boundary** (every table is scoped to `user_id = auth.uid()`); frontend tier-gating is UX only, not enforcement. Subscription tier/status are written by `service_role` (the Splash app + Stripe webhooks), never by the user.

```
src/
  api/        Supabase calls + Zod schemas (only layer touching supabase-js)
  hooks/      TanStack Query wrappers around the API layer
  components/ Shared UI primitives (ui/) and layout (layout/)
  features/   Feature modules (clients, projects, kanban, contracts, invoices, profile, dashboard)
  pages/      Route-level views
  lib/        Cross-cutting helpers (supabase client, errors, currency, date, tier)
  styles/     Design tokens + Tailwind theme
supabase/migrations/   SQL migrations (applied to the hosted project)
tests/e2e/             Playwright specs
```

See also:
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans

## Deploying

Vercel — config in [`vercel.json`](./vercel.json) (Vite framework preset + SPA rewrite so deep links don't 404). Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`, and `VITE_SPLASH_URL` in the Vercel project. Add your deploy URLs to **Supabase → Authentication → URL Configuration** so password-reset redirects are whitelisted.
