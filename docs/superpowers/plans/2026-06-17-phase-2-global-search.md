# Global Search (Cmd+K) Implementation Plan (Phase 2 · Milestone 3)

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A command palette (⌘K / Ctrl+K) to jump to any client, project, or invoice by name or number, with debounced search and full keyboard navigation.

**Architecture:** `searchEverything(query)` runs three parallel, limited Supabase queries (clients, projects, invoices) and returns a flat, typed result list. `<CommandPalette/>` (mounted once in `AppShell`) owns open state, a global ⌘K listener, a debounced TanStack-Query search, and arrow/enter/esc keyboard navigation. A search trigger in the `Topbar` opens it via a custom DOM event (no prop drilling). RLS already scopes results to the user.

**Tech Stack:** existing `useDebouncedValue`, TanStack Query, `lib/supabase`, `lib/errors`, `react-router` navigation, `cn`, lucide icons, `.animate-pop-in`.

---

### Task 1: Search data layer

**Files:**
- Create: `src/features/search/globalSearch.js`

- [ ] **Step 1:** `searchEverything(query)` — trim; return `[]` if empty. `like = '%'+q+'%'`. `Promise.all`:
  - `clients`: `select id,name,company` `.or(name.ilike,company.ilike)` `.is('archived_at', null)` `.limit(5)`
  - `projects`: `select id,name,clients(name)` `.ilike('name', like)` `.is('archived_at', null)` `.limit(5)`
  - `invoices`: `select id,invoice_number,status,clients(name)` `.ilike('invoice_number', like)` `.limit(5)`
  Throw `mapPostgresError` on any error. Flatten to `{ type:'Client'|'Project'|'Invoice', id, title, subtitle, to }` (`to` = `/clients/:id` · `/projects/:id` · `/invoices/:id`).

---

### Task 2: Command palette + trigger

**Files:**
- Create: `src/features/search/CommandPalette.jsx`
- Modify: `src/components/layout/AppShell.jsx` (mount palette)
- Modify: `src/components/layout/Topbar.jsx` (search trigger button → dispatches `loomlance:open-search`)

- [ ] **Step 1:** `CommandPalette.jsx` —
  - State: `open`, `query`, `active`. `debounced = useDebouncedValue(query, 200)`.
  - Global listener: `keydown` → `(meta|ctrl)+k` toggles open (preventDefault); window event `loomlance:open-search` → open.
  - On open: clear query, reset active, focus input (via ref). Reset `active` to 0 whenever `debounced` changes.
  - `useQuery({ queryKey:['global-search', debounced], queryFn:()=>searchEverything(debounced), enabled: open && debounced.trim().length>0, staleTime:30_000 })`.
  - Returns `null` when closed. Overlay (`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm`, click-out closes) + panel (`max-w-xl`, `animate-pop-in`, stopPropagation): search input (icon + placeholder + Esc kbd) and a results list.
  - Input `onKeyDown`: Escape closes; ArrowDown/Up move `active` (clamped); Enter navigates `results[active]`. Mouse hover sets `active`; click navigates. Active row `scrollIntoView({block:'nearest'})` via ref.
  - States: empty query → "Type to search…"; fetching+no-results → "Searching…"; no results → `No results for "<q>"`. Each row: type icon (Users/Briefcase/FileText) + title + subtitle.
- [ ] **Step 2:** Mount `<CommandPalette/>` inside `AppShell` (after `<Topbar/>`, before/after `<main>` — top level so it overlays everything).
- [ ] **Step 3:** `Topbar.jsx` — change header to `justify-between`; add a left search button (`Search… ⌘K` pill) that `window.dispatchEvent(new CustomEvent('loomlance:open-search'))`; wrap the existing right-side controls in a `div`.

---

### Task 3: Verify and commit

- [ ] **Step 1:** Gate — `npm run build`, `eslint --max-warnings 0`, `vitest run` (28 pass).
- [ ] **Step 2:** Live-verify (Playwright, dev or preview): press Ctrl+K → palette opens & input focused; type a known client name → result appears; ArrowDown + Enter (or click) → navigates to that record; Escape closes. Also click the Topbar trigger → opens. 0 page errors.
- [ ] **Step 3:** Commit (lint-gated): `feat(search): Cmd+K global command palette`.

---
```
