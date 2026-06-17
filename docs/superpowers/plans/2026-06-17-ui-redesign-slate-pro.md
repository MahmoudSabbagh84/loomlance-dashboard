# LoomLance "Slate Pro" UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Repaint LoomLance to the dark-first "Slate Pro" identity (violet accent, Outfit type) and fix layout/spacing consistency via shared primitives + a per-screen alignment pass — no functional changes.

**Architecture:** All colors are CSS variables mapped in `tailwind.config.js`, so rewriting `src/styles/tokens.css` + the `sans` font repaints every component at once. Layout fixes are additive (new `PageHeader`/`Card`/`Toolbar` primitives) + refactoring screens onto them at a compact spacing scale.

**Tech Stack:** React 18, Vite 5, Tailwind 3, react-query 5, lucide-react, sonner. Spec: `docs/superpowers/specs/2026-06-17-ui-redesign-slate-pro-design.md`.

**Verification model (every task):** `npm run build` clean · `npm run lint` exit 0 · `npm run test:run` 26+ green · live Playwright check (login as `test@loomlance.com`/`password123`, target screen renders, **0 page errors**) · commit. Visual correctness is confirmed live in the running dev server (`localhost:5173`). The test user is **tier_2**; do not delete their "Site Building" project. Clean up any seeded test data.

---

### Task 1: Core theme — tokens, font, default dark

**Files:**
- Modify: `src/styles/tokens.css` (full rewrite, both themes)
- Modify: `tailwind.config.js:30-32` (fontFamily.sans → Outfit)
- Modify: `src/styles/tailwind.css` (body font, base polish)
- Modify: `index.html` (Outfit `<link>`, default-dark script)

- [ ] **Step 1: Rewrite `src/styles/tokens.css`**

```css
:root {
  --color-bg: #FBFBFD;
  --color-bg-elevated: #FFFFFF;
  --color-bg-muted: #F1F3F7;
  --color-fg: #14181F;
  --color-fg-muted: #5A6472;
  --color-fg-subtle: #8A95A5;
  --color-border: #E4E7EC;
  --color-border-strong: #CBD2DC;
  --color-primary: #6D45F0;
  --color-primary-fg: #FFFFFF;
  --color-primary-hover: #5B37D6;
  --color-accent: #7C5CFF;
  --color-accent-fg: #FFFFFF;
  --color-success: #15A66E;
  --color-warning: #C77A12;
  --color-danger: #DC4040;
  --color-info: #2D74D6;
}

:root[data-theme='dark'] {
  --color-bg: #0B0E14;
  --color-bg-elevated: #151B26;
  --color-bg-muted: #1E2532;
  --color-fg: #E6EDF3;
  --color-fg-muted: #94A3B8;
  --color-fg-subtle: #64748B;
  --color-border: #222B38;
  --color-border-strong: #324054;
  --color-primary: #7C5CFF;
  --color-primary-fg: #FFFFFF;
  --color-primary-hover: #8E72FF;
  --color-accent: #A78BFF;
  --color-accent-fg: #0B0E14;
  --color-success: #34D399;
  --color-warning: #F5B14C;
  --color-danger: #F87171;
  --color-info: #60A5FA;
}
```

- [ ] **Step 2: `tailwind.config.js` — font family**

Replace the `fontFamily` block (lines ~30-32):

```js
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
```

- [ ] **Step 3: `src/styles/tailwind.css` — body font + base polish**

Replace the `body` rule and add selection/scrollbar polish inside `@layer base`:

```css
  body {
    @apply bg-bg text-fg antialiased;
    font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    font-feature-settings: 'cv11', 'ss01';
  }
  ::selection {
    background-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  }
  :root[data-theme='dark'] {
    color-scheme: dark;
    scrollbar-color: var(--color-border-strong) transparent;
  }
```

(Keep the existing `:root`/`:root[data-theme='dark'] { color-scheme }` and `*:focus-visible` rules; the dark scrollbar-color line is additive.)

- [ ] **Step 4: `index.html` — font + default dark**

Add inside `<head>` (before the theme script):

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Change the theme script so dark is the default:

```js
      (() => {
        try {
          const saved = localStorage.getItem('loomlance-theme')
          document.documentElement.dataset.theme = saved || 'dark'
        } catch { document.documentElement.dataset.theme = 'dark' }
      })()
```

- [ ] **Step 5: Verify build + theme inlined**

Run: `npm run build`
Expected: builds clean. Then confirm dark token present:
Run: `grep -c "7C5CFF\|0B0E14" dist/assets/index-*.css`
Expected: ≥ 1.

- [ ] **Step 6: Live verify**

Start dev server if not running (`npm run dev`, port 5173). Playwright: load `/login`, assert `document.documentElement.dataset.theme === 'dark'`, the page background computed color is dark (`#0B0E14`-ish), 0 page errors. Run lint (exit 0) and `npm run test:run` (26 pass).

- [ ] **Step 7: Commit**

```bash
git add src/styles/tokens.css tailwind.config.js src/styles/tailwind.css index.html
git commit -m "feat(ui): Slate Pro theme tokens, Outfit font, dark default

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Layout primitives — PageHeader, Card, Toolbar

**Files:**
- Create: `src/components/ui/PageHeader.jsx`
- Create: `src/components/ui/Card.jsx`
- Create: `src/components/ui/Toolbar.jsx`
- Create: `src/components/ui/__tests__/layout.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/ui/__tests__/layout.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '../PageHeader'
import { Card } from '../Card'

describe('PageHeader', () => {
  it('renders title, subtitle, and actions', () => {
    render(<PageHeader title="Clients" subtitle="Manage them"><button>New</button></PageHeader>)
    expect(screen.getByRole('heading', { name: 'Clients' })).toBeInTheDocument()
    expect(screen.getByText('Manage them')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders children inside a surface', () => {
    render(<Card>hello</Card>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `npm run test:run -- layout`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create `PageHeader.jsx`**

```jsx
import { cn } from './cn'

export function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}
```

- [ ] **Step 4: Create `Card.jsx`**

```jsx
import { cn } from './cn'

const PAD = { sm: 'p-3', md: 'p-4', lg: 'p-5' }

export function Card({ children, className, padding = 'md', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={cn('rounded-lg border border-border bg-bg-elevated', PAD[padding], className)} {...rest}>
      {children}
    </Tag>
  )
}
```

- [ ] **Step 5: Create `Toolbar.jsx`**

```jsx
import { cn } from './cn'

export function Toolbar({ children, className }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
```

- [ ] **Step 6: Run tests, expect pass**

Run: `npm run test:run -- layout`
Expected: PASS (2 tests). Run `npm run lint` (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/PageHeader.jsx src/components/ui/Card.jsx src/components/ui/Toolbar.jsx src/components/ui/__tests__/layout.test.jsx
git commit -m "feat(ui): add PageHeader, Card, Toolbar layout primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Polish control primitives — Button, Input, Select, Textarea, Badge

**Files:**
- Modify: `src/components/ui/Button.jsx`
- Modify: `src/components/ui/Input.jsx`
- Modify: `src/components/ui/Select.jsx`
- Modify: `src/components/ui/Textarea.jsx`
- Modify: `src/components/ui/Badge.jsx`

- [ ] **Step 1: Button — compact heights, violet depth**

Replace the `SIZES` map and base classes in `Button.jsx`:

```jsx
const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-6 text-base',
}
```

In the `className={cn(...)}` base string (first line), use:

```js
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[.98]',
```

Keep `VARIANTS` but update `primary` and `secondary`:

```js
  primary: 'bg-primary text-primary-fg shadow-sm shadow-primary/20 hover:bg-primary-hover',
  secondary: 'bg-bg-muted text-fg border border-border hover:border-border-strong hover:bg-bg-elevated',
```

- [ ] **Step 2: Input — h-9, muted surface, clear focus**

Replace the `cn(...)` class list in `Input.jsx`:

```jsx
      className={cn(
        'h-9 w-full rounded-md border border-border bg-bg-muted px-3 text-sm text-fg transition-colors',
        'placeholder:text-fg-subtle hover:border-border-strong',
        'focus:border-primary focus:bg-bg-elevated',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
```

- [ ] **Step 3: Select — match Input**

Replace the `cn(...)` class list in `Select.jsx`:

```jsx
      className={cn(
        'h-9 w-full rounded-md border border-border bg-bg-muted px-3 text-sm text-fg transition-colors',
        'hover:border-border-strong focus:border-primary',
        className
      )}
```

- [ ] **Step 4: Textarea — match surface**

Replace the `cn(...)` class list in `Textarea.jsx`:

```jsx
      className={cn(
        'w-full rounded-md border border-border bg-bg-muted px-3 py-2 text-sm text-fg transition-colors',
        'placeholder:text-fg-subtle hover:border-border-strong focus:border-primary focus:bg-bg-elevated',
        className
      )}
```

- [ ] **Step 5: Badge — tabular numerals**

In `Badge.jsx`, add `tabular-nums` to the base class string:

```jsx
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', VARIANTS[variant], className)}>
```

- [ ] **Step 6: Verify**

Run `npm run build` (clean), `npm run lint` (exit 0), `npm run test:run` (26 pass — Button test still green). Live: `/login` form inputs/buttons render with new style, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Button.jsx src/components/ui/Input.jsx src/components/ui/Select.jsx src/components/ui/Textarea.jsx src/components/ui/Badge.jsx
git commit -m "feat(ui): compact, dark-first control primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Polish overlay & data primitives — Modal, Drawer, Tabs, Table, EmptyState, Pagination

**Files:**
- Modify: `src/components/ui/Modal.jsx`, `Drawer.jsx`, `Tabs.jsx`, `Table.jsx`, `EmptyState.jsx`, `Pagination.jsx`

- [ ] **Step 1: Modal — darker backdrop, pop-in, compact**

In `Modal.jsx`: change backdrop `bg-black/40` → `bg-black/60 backdrop-blur-sm`; add `animate-pop-in` to the panel div; change panel padding header `px-5 py-4` → `px-5 py-3.5` and body `p-5` → `p-4`.

- [ ] **Step 2: Drawer — same backdrop + compact**

In `Drawer.jsx`: backdrop `bg-black/30` → `bg-black/60 backdrop-blur-sm`; header `px-5 py-4` → `px-5 py-3.5`; body `p-5` → `p-4`.

- [ ] **Step 3: Tabs — violet active, even spacing**

In `Tabs.jsx`: change active classes to `border-primary text-primary` (already) and inactive to `border-transparent text-fg-muted hover:text-fg`; change `gap-6` → `gap-5`, `py-3` → `py-2.5`.

- [ ] **Step 4: Table — compact cells, row hover**

In `Table.jsx`: `TH`/`TD` padding `px-4 py-3` → `px-4 py-2.5`; `THead` keep; `TR` hover already conditional — add base `transition-colors`.

- [ ] **Step 5: EmptyState + Pagination — spacing**

`EmptyState.jsx`: `py-16` → `py-14`. `Pagination.jsx`: ensure `mt-4` → `mt-3` and text `tabular-nums` on the "Page x of y" `<p>`.

- [ ] **Step 6: Verify**

`npm run build` clean, `npm run lint` 0, `npm run test:run` 26. Live: open a Modal (e.g. Clients → New client) and a Table (Clients list) — render correctly, backdrop blurred, 0 errors. (Seed/cleanup not needed; use existing data.)

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Modal.jsx src/components/ui/Drawer.jsx src/components/ui/Tabs.jsx src/components/ui/Table.jsx src/components/ui/EmptyState.jsx src/components/ui/Pagination.jsx
git commit -m "feat(ui): polish overlays and data primitives for Slate Pro

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: App shell — Sidebar, Topbar, background atmosphere

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`, `Topbar.jsx`, `AppShell.jsx`

- [ ] **Step 1: AppShell — subtle dark glow**

In `AppShell.jsx`, wrap `<main>` content background with a radial glow (dark only). Change `<main className="flex-1 bg-bg">` to include a layered background:

```jsx
        <main className="relative flex-1 bg-bg">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_10%,transparent),transparent)] dark:opacity-100 opacity-0" />
          <div className="relative mx-auto max-w-7xl px-6 py-5">{children}</div>
        </main>
```

(Note: `dark:` variant uses the `[data-theme="dark"]` class config — verify it applies; if not, gate the glow with the data attribute via an `:root[data-theme=dark]` utility. Acceptance: glow visible in dark, absent in light.)

- [ ] **Step 2: Sidebar — violet active state + compact rhythm**

In `Sidebar.jsx` `NavLink` className: active → `bg-primary/12 text-primary` with a left indicator; inactive → `text-fg-muted hover:text-fg hover:bg-bg-muted`. Items `px-3 py-2 gap-2.5 rounded-md text-sm`. Header brand stays "Loom"(primary)/"Lance"(muted). Locked items: `text-fg-subtle hover:bg-bg-muted`.

- [ ] **Step 3: Topbar — aligned cluster**

In `Topbar.jsx`: ensure the right cluster is `gap-2`, the avatar button `h-9`, the theme/bell buttons `size-9 grid place-items-center rounded-md hover:bg-bg-muted`. Dropdown uses `animate-pop-in`, `bg-bg-elevated border-border`.

- [ ] **Step 4: Verify (live, authed)**

Playwright: login → `/` → assert Sidebar nav present, active item (Dashboard) has violet styling, Topbar controls present, theme toggle flips `data-theme` light↔dark, 0 errors. Build/lint/tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.jsx src/components/layout/Topbar.jsx src/components/layout/AppShell.jsx
git commit -m "feat(ui): Slate Pro app shell — violet nav, refined topbar, glow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Auth pages — Login (hero), Forgot, Reset

**Files:**
- Modify: `src/pages/LoginPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`

- [ ] **Step 1: Login hero**

Wrap the card on an atmospheric background and use `Card`. Replace the outer `<div className="min-h-screen ...">` content: keep the form/logic, but the container gets `relative overflow-hidden` with a radial violet glow div behind the centered card; the card uses the `Card` primitive (`padding="lg"`), heading uses `text-2xl font-semibold tracking-tight`. Keep all form fields, validation, and the curly-apostrophe link.

- [ ] **Step 2: Forgot + Reset — match**

Wrap both in the same centered `Card padding="lg"` treatment; field rhythm `space-y-3.5`; standardized footer button row. Keep all logic.

- [ ] **Step 3: Verify (live)**

Playwright: `/login` renders form on the new hero (0 errors), empty submit shows validation; `/forgot-password` and `/reset-password` render. Build/lint/tests green.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LoginPage.jsx src/pages/ForgotPasswordPage.jsx src/pages/ResetPasswordPage.jsx
git commit -m "feat(ui): Slate Pro auth pages with hero treatment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Clients — list + detail onto primitives

**Files:**
- Modify: `src/pages/ClientsPage.jsx`, `src/features/clients/ClientHeader.jsx`, `src/features/clients/tabs/OverviewTab.jsx`, `src/features/clients/tabs/ContactsTab.jsx`

- [ ] **Step 1: ClientsPage**

Replace the bespoke header `div` with `<PageHeader title="Clients" subtitle="Manage your client relationships"><Button…>New client</Button></PageHeader>`. Wrap the search row in `<Toolbar>`. Section gap `space-y-5`. Table unchanged structurally (inherits new styles). Import `PageHeader`, `Toolbar`.

- [ ] **Step 2: ClientHeader (detail)**

Use the consistent action cluster `flex items-center gap-2` for Edit/Archive/Delete; title `text-xl font-semibold tracking-tight`; tags row `mt-2 gap-1.5`. Same logic.

- [ ] **Step 3: Overview + Contacts tabs — Card surfaces + rhythm**

OverviewTab: wrap the two columns in `Card`s; `gap-5`. ContactsTab: list items use consistent `p-3`, action buttons `gap-1`. Keep logic.

- [ ] **Step 4: Verify (live)**

Playwright: login → `/clients` (PageHeader + toolbar + table render, 16 clients, 0 errors) → open a client → detail header + tabs render. Build/lint/tests green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ClientsPage.jsx src/features/clients/ClientHeader.jsx src/features/clients/tabs/OverviewTab.jsx src/features/clients/tabs/ContactsTab.jsx
git commit -m "feat(ui): refactor Clients onto layout primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Projects + Kanban alignment

**Files:**
- Modify: `src/pages/ProjectsPage.jsx`, `src/features/projects/ProjectCard.jsx`, `src/pages/ProjectDetailPage.jsx`

- [ ] **Step 1: ProjectsPage**

Header → `PageHeader title="Projects"` with the active-count `Badge` in the subtitle slot and the New-project `Button` as actions; filters row → `<Toolbar>`; grid `gap-4`. Import primitives.

- [ ] **Step 2: ProjectCard — use Card + symmetry**

Rebuild card body on the `Card` primitive (`padding="md"`), consistent `gap-3`, the color chip `size-9 rounded-md grid place-items-center`, name/client/owner aligned, "open tasks" pinned bottom. Keep `useTasks` logic + Link.

- [ ] **Step 3: ProjectDetailPage — header rhythm**

Header block uses `PageHeader title={project.name} subtitle={project.clients?.name}`; board spacing `space-y-4`. Kanban internals (Task 43) already aligned; verify they read correctly on dark.

- [ ] **Step 4: Verify (live)**

Playwright: login → `/projects` (PageHeader, filters toolbar, card grid render, 0 errors). Seed 1 throwaway project, open it, confirm board + columns render on dark; delete the throwaway. Build/lint/tests green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectsPage.jsx src/features/projects/ProjectCard.jsx src/pages/ProjectDetailPage.jsx
git commit -m "feat(ui): align Projects + Kanban to Slate Pro layout system

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Placeholders, profile, final audit

**Files:**
- Modify: `src/pages/{Dashboard,Profile,Contracts,ContractDetail,Invoices,InvoiceDetail}Page.jsx`, `src/pages/NotFoundPage.jsx`

- [ ] **Step 1: Consistent placeholder headers**

Each placeholder page: replace the bare `<div className="p-6"><h1…></div>` with `<div className="space-y-5"><PageHeader title="<Name>" /></div>` so headers are uniform app-wide. NotFoundPage: center treatment refined, button uses `Button`.

- [ ] **Step 2: Full-app audit sweep**

Click through every screen in the running app (both themes via toggle). Fix any remaining: misaligned action clusters, inconsistent gaps, elements stuck/stranded, contrast issues on dark. Apply §5 rhythm. (This step is iterative; commit fixes as found.)

- [ ] **Step 3: Final verification**

`npm run build` clean · `npm run lint` 0 · `npm run test:run` (≥27 with layout test) · Playwright sweep: login → visit `/`, `/clients`, `/projects`, `/profile`, toggle theme — 0 page errors on each. Confirm dark default for a fresh session (no `loomlance-theme` in localStorage → dark).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): consistent placeholders + final Slate Pro audit pass

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Finish**

Use superpowers:finishing-a-development-branch. Update the progress memory; offer to push; resume Phase 1 at Task 44.

---

## Notes for the implementer

- **Don't break logic.** This is visual/structural only — preserve all hooks, handlers, form wiring, routes.
- **Reuse, don't duplicate.** Once `PageHeader`/`Card`/`Toolbar` exist (Task 2), every page must use them rather than re-rolling markup.
- **Verify both themes** — toggle ☀/☾ on key screens; the violet accent and contrast must hold in light and dark.
- **Test data hygiene** — the test user is tier_2; never delete "Site Building" (`6779ac12-…`); delete any `ZZ …` seeds you create.
- **`animate-pop-in`** already exists in `tailwind.css` (from Phase-1 Task 43) — reuse it for menus/modals.
