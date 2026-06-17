# LoomLance — Tech Stack

LoomLance is an all-in-one hub for tech freelancers (clients, projects/kanban, contracts, invoices) with Free / Tier 1 / Tier 2 subscriptions. This document describes the technologies, libraries, and conventions used across the platform.

It reflects the current state of the codebase (Phase 1 foundation rebuild) and is kept in sync as the stack evolves.

---

## At a glance

| Layer | Choice |
|---|---|
| UI framework | **React 18** (JavaScript + JSX, no TypeScript) |
| Build tool / dev server | **Vite 5** |
| Styling | **Tailwind CSS 3** + a CSS-variable design-token system |
| Routing | **React Router DOM 6** |
| Server state / data fetching | **TanStack Query (react-query) 5** |
| Forms & validation | **react-hook-form 7** + **Zod 3** (via `@hookform/resolvers`) |
| Backend (BaaS) | **Supabase** — Postgres + Auth + Storage + Row-Level Security |
| Drag & drop | **dnd-kit** (Kanban board) |
| Icons | **lucide-react** |
| Toasts | **sonner** |
| Dates | **date-fns 3** |
| Unit tests | **Vitest** + **Testing Library** + jsdom |
| E2E / verification | **Playwright** |
| Linting | **ESLint 9** (flat config) |
| Typeface | **Outfit** (Google Fonts) |

---

## Frontend

### Core
- **React 18.3** (`react`, `react-dom`) — function components + hooks throughout. JavaScript/JSX only (no TypeScript); types are tracked via Zod schemas and conventions.
- **Vite 5.3** (`@vitejs/plugin-react`) — dev server (HMR) and production bundler. Config in `vite.config.js`:
  - `@` path alias → `src/`
  - `manualChunks` code-splitting: `vendor` (react/react-dom/react-router), `query` (react-query), `supabase`, `dnd` (dnd-kit)
  - jsdom test environment wired for Vitest

### Routing
- **React Router DOM 6.25** — `createBrowserRouter`; public routes (login/forgot/reset) and an `AuthGate`-protected route tree wrapped in `AppShell` (sidebar + topbar).

### Styling & design system
- **Tailwind CSS 3.4** + **PostCSS 8** + **autoprefixer**.
- **Token-based theming:** all colors are CSS custom properties in `src/styles/tokens.css`, mapped to Tailwind color utilities in `tailwind.config.js` (`bg-bg`, `text-fg`, `bg-primary`, `border-border`, `bg-success`, …). Rewriting the tokens repaints the entire app.
- **Light + dark themes** (dark is the default), toggled via a `data-theme` attribute on `<html>` and persisted to `localStorage`. "Slate Pro" identity: slate surfaces, **violet** accent, compact density.
- **Typography:** **Outfit** (geometric sans) loaded from Google Fonts; numerals use `tabular-nums`.
- **`cn` utility** — `clsx` + `tailwind-merge` for conditional, conflict-free class names.
- A small **micro-interaction** (`animate-pop-in`) defined in `src/styles/tailwind.css` for menus/modals.

### Data fetching / server state
- **TanStack Query (react-query) 5.51** — all server reads/writes go through query/mutation hooks in `src/hooks/`. Patterns used: query-key invalidation, `placeholderData: keepPreviousData` for paginated lists, and **optimistic updates** (e.g. Kanban card moves).
- **`@tanstack/react-query-devtools`** — mounted in development only.

### Forms & validation
- **react-hook-form 7.52** — `useForm`, `useFieldArray` (invoice line items), `useWatch` (live invoice totals/preview), `Controller` where needed.
- **Zod 3.23** — schemas in `src/api/schemas/` validate every form; wired to RHF via **`@hookform/resolvers`**. Date/optional fields accept `''` (what date/select inputs emit) and are normalized to `null` before persistence.

### Feature libraries
- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) — the Kanban board: draggable task cards, droppable columns, `DragOverlay`, pointer + keyboard sensors. Card ordering uses fractional indexing (`positionBetween`).
- **lucide-react** — icon set.
- **sonner** — toast notifications (`<Toaster>` in the app providers).
- **date-fns 3.6** — formatting and date math (`src/lib/date.js`).

---

## Backend & data (Supabase)

- **Supabase** (hosted) is the backend: managed **Postgres**, **Auth**, **Storage**, and **Row-Level Security**. The Splash (marketing/signup) sibling app and this dashboard share the same Supabase project; the dashboard owns **login** only.
- **`@supabase/supabase-js` 2.45** — the browser client (`src/lib/supabase.js`), configured from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### Postgres features in use
- **Row-Level Security** on every table — `user_id = auth.uid()` ownership policies (select/insert/update/delete) so each user only ever sees their own data.
- **Triggers** — `set_updated_at` (timestamps), `seed_default_columns` (auto-creates the 4 Kanban columns on project insert), `enforce_project_limit` (tier-based active-project cap).
- **SECURITY DEFINER functions** — `next_invoice_number` (per-user sequential `INV-####`), `enforce_project_limit`, etc.
- **Enums** — `project_status`, `task_priority`, `contract_status`, `invoice_status`, `payment_method`, `subscription_tier`.
- **pgcrypto** (in the `extensions` schema) — `gen_random_bytes` for invoice `public_token`s.
- **Storage** — a private `contract-pdfs` bucket with per-contract RLS on `storage.objects` (signed URLs for download).

### Database workflow (hosted-only)
- **No local Docker / no local Postgres.** Development runs against the hosted dev project; migrations are version-controlled SQL files in `supabase/migrations/` and applied to the hosted DB.
- **Supabase CLI** — project linking, `migration new`, and `db push` (run with credentials loaded from a gitignored `.env.supabase.local`).
- **Supabase MCP server** (`.mcp.json`, OAuth) — used during development to apply migrations (`apply_migration`) and run/verify SQL (`execute_sql`) directly against the hosted project.

---

## Tooling & quality

### Linting
- **ESLint 9.6** with the modern **flat config** (`eslint.config.js`): `@eslint/js` recommended + `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Browser globals for `src/`, Vitest globals for tests, Node globals for root tooling. Runs with `--max-warnings 0` (zero-tolerance).

### Unit / component tests
- **Vitest 1.6** — test runner (jsdom environment, globals on; setup in `src/test-setup.js`).
- **Testing Library** — `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- Tests live in `__tests__/` folders next to the code (e.g. tier matrix, error mapping, money math, UI primitives, the clients API query shape).

### End-to-end / verification
- **Playwright** (`@playwright/test` 1.45, Chromium) — drives the running app to verify real user flows (login, CRUD, drag-drop, invoice state machine) against the live dev server. A formal E2E suite lands in a later milestone; the scripts `test:e2e` / `test:e2e:ui` are wired.

---

## Project structure & conventions

```
src/
  app/            # entry (main.jsx), providers, router
  pages/          # route-level page components
  components/
    ui/           # design-system primitives (Button, Input, Modal, Card, PageHeader, Table, …) + cn
    layout/       # AppShell, Sidebar, Topbar
    gates/        # tier-gating UI (TierGate, UpgradeCard/Dialog)
  features/       # feature folders: clients, projects, kanban, contracts, invoices, auth
  hooks/          # react-query hooks + small utilities (useDebouncedValue, useTheme, …)
  api/            # data-access layer (one module per entity)
    schemas/      # Zod schemas
  lib/            # framework-agnostic helpers (supabase client, errors, money, currency, date, tier, queryClient)
  styles/         # tokens.css + tailwind.css
supabase/
  migrations/     # version-controlled SQL (applied to the hosted DB)
docs/superpowers/ # specs and implementation plans
```

**Conventions**
- **API + hooks split:** `src/api/<entity>.js` wraps Supabase calls (and maps errors); `src/hooks/use<Entity>.js` wraps those in react-query. Components never call Supabase directly.
- **Error handling:** every Supabase error passes through `mapPostgresError` (`src/lib/errors.js`) into an `AppError` with a friendly `userMessage` (Postgres codes / RLS / app-raised errors → human text). Toasts surface `e.userMessage`.
- **Shared layout primitives** (`PageHeader`, `Card`, `Toolbar`) enforce consistent spacing/alignment instead of per-page markup.
- **Tier gating** is centralized in `src/lib/tier.js` (feature matrix, limits, upgrade copy) and enforced both in the UI (`TierGate`/dialogs) and in the database (RLS + the project-limit trigger).
- **Money math** (`src/lib/money.js`) is pure and unit-tested; invoice totals (subtotal, per-rate tax, discount, total) compute the same way in the editor, the preview, and the payment modal.

---

## Build, config & environment

- **Build:** `npm run build` → Vite production bundle (`dist/`) with the manual chunks above.
- **Env vars** (Vite `VITE_`-prefixed, in `.env.local`):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase client
  - `VITE_PUBLIC_SITE_URL` — password-reset redirect base
  - `VITE_SPLASH_URL` — link to the Splash signup/pricing app
- **Secrets:** Supabase CLI credentials live in a gitignored `.env.supabase.local`; `.mcp.json` (MCP config) contains no secrets (OAuth).
- **Deployment:** target finalized in Milestone 5 (static SPA hosting of the Vite build; Supabase hosts the backend).

---

## Notable conventions / gotchas (for contributors)

- **JavaScript, not TypeScript** — type safety comes from Zod at the boundaries.
- **react-query v5** semantics: use `placeholderData: keepPreviousData` (not v4's `keepPreviousData: true`), `gcTime` (not `cacheTime`), and `isPending` (not `isLoading`) for mutations.
- **Date & select inputs emit `''`** when empty — schemas accept `''` and code normalizes to `null` before writing to the DB.
- **Hosted-only DB** — there is no local Supabase stack; apply migrations to the hosted project (MCP or CLI `db push`).
- **Lint is a hard gate** (`--max-warnings 0`); keep imports tidy and prefer the shared primitives.
