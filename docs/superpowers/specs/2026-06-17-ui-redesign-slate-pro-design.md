# LoomLance UI Redesign — "Slate Pro" Design Spec

**Date:** 2026-06-17
**Status:** Approved (brainstorming) — pending implementation plan
**Scope:** Visual + layout redesign of the existing LoomLance Dashboard. A side-quest before resuming Phase 1 (Task 44+). No functional/behavior changes.

## 1. Goal

Give the app a professional, cohesive "fresh coat of paint" AND fix the structural layout problems (inconsistent spacing, broken symmetry, ad-hoc per-page structure). Two pillars:

1. **Theme** — a dark-first "Slate Pro" identity (violet accent, Outfit type), via the existing CSS-variable token system so it cascades app-wide.
2. **Layout system** — a consistent compact spacing rhythm + shared layout primitives, then a per-screen alignment pass, so spacing/symmetry is uniform instead of hand-rolled per page.

**Non-goals:** no new features, no data-model/API changes, no copy rewrite, no routing changes. Fully reversible/themeable. All 26 tests stay green.

## 2. Architecture note (why this is low-risk)

`tailwind.config.js` already maps every color utility (`bg-bg`, `text-fg`, `bg-primary`, `border-border`, `bg-success`, …) to a CSS variable. Rewriting `src/styles/tokens.css` + the `sans` font family in the config repaints all ~30 components at once. The layout work is additive (new primitives) + targeted refactors of pages onto them.

## 3. Theme — token system

### 3.1 Dark (default / hero)
| Variable | Hex |
|---|---|
| `--color-bg` | `#0B0E14` |
| `--color-bg-elevated` | `#151B26` |
| `--color-bg-muted` | `#1E2532` |
| `--color-fg` | `#E6EDF3` |
| `--color-fg-muted` | `#94A3B8` |
| `--color-fg-subtle` | `#64748B` |
| `--color-border` | `#222B38` |
| `--color-border-strong` | `#324054` |
| `--color-primary` | `#7C5CFF` |
| `--color-primary-fg` | `#FFFFFF` |
| `--color-primary-hover` | `#8E72FF` |
| `--color-accent` | `#A78BFF` (light-violet, sparing highlights) |
| `--color-accent-fg` | `#0B0E14` |
| `--color-success` | `#34D399` |
| `--color-warning` | `#F5B14C` |
| `--color-danger` | `#F87171` |
| `--color-info` | `#60A5FA` |

### 3.2 Light (refined, secondary)
| Variable | Hex |
|---|---|
| `--color-bg` | `#FBFBFD` |
| `--color-bg-elevated` | `#FFFFFF` |
| `--color-bg-muted` | `#F1F3F7` |
| `--color-fg` | `#14181F` |
| `--color-fg-muted` | `#5A6472` |
| `--color-fg-subtle` | `#8A95A5` |
| `--color-border` | `#E4E7EC` |
| `--color-border-strong` | `#CBD2DC` |
| `--color-primary` | `#6D45F0` |
| `--color-primary-fg` | `#FFFFFF` |
| `--color-primary-hover` | `#5B37D6` |
| `--color-accent` | `#7C5CFF` |
| `--color-accent-fg` | `#FFFFFF` |
| `--color-success` | `#15A66E` |
| `--color-warning` | `#C77A12` |
| `--color-danger` | `#DC4040` |
| `--color-info` | `#2D74D6` |

### 3.3 Default theme
New sessions default to **dark**. `index.html` inline script becomes `saved || 'dark'` (drop the `prefers-color-scheme` branch). The ☀/☾ toggle and persistence keep working unchanged.

### 3.4 Status colors are functional only
Green/amber/red/blue convey state (paid/overdue/etc.), never used as brand accent. Brand accent = violet only.

## 4. Typography

- **Outfit** (Google Fonts, weights 400/500/600/700) as the single UI typeface; replaces Inter in `tailwind.css` `body` + `tailwind.config.js` `fontFamily.sans`. Loaded via `<link>` in `index.html`.
- Headings: 600–700 weight, tight tracking (`-0.01em` to `-0.02em` on large sizes).
- Numerals (money, counts, metrics): `tabular-nums` so columns align.

## 5. Density — compact scale

Compact = efficient information density. Concrete rules:

| Element | Value |
|---|---|
| Control height (Input/Select/Button md) | `h-9` (36px) |
| Button sizes | sm `h-8` · md `h-9` · lg `h-11` |
| Button padding | md `px-3.5` · icon↔label `gap-2` |
| Shell content padding | `px-6 py-5`, `max-w-7xl` |
| Page section gap | `space-y-5` |
| Card padding | `p-4` (compact) · `p-5` (roomy/detail) |
| Card / grid gap | `gap-3` (dense) · `gap-4` (cards) |
| Form field gap | `space-y-3.5` |
| Table cell | `px-4 py-2.5` |
| Sidebar nav item | `py-2 px-3`, `gap-2.5` |
| Base UI text | `text-sm` |

These supersede the current mix of `h-10`, `p-6`, `space-y-6`, `py-3`.

## 6. Layout primitives (the structural fix)

Root cause of the asymmetry: every page hand-rolls header/toolbar/surface markup. Introduce reusable primitives and refactor pages onto them so spacing/alignment is automatic and identical.

- **`PageHeader`** (`src/components/ui/PageHeader.jsx`)
  - Props: `title`, `subtitle?`, `children` (right-aligned actions).
  - Always: `flex items-center justify-between gap-4`, title block left, actions right, uniform bottom rhythm. Replaces the bespoke header `div`s in ClientsPage, ProjectsPage, ClientDetailPage, etc.
- **`Card`** (`src/components/ui/Card.jsx`)
  - One surface: `rounded-lg border border-border bg-bg-elevated`, `p-4` default (prop `padding="sm|md|lg"`), optional `as`. Replaces ad-hoc `rounded-lg border p-4/p-5/p-6` variants.
- **`Toolbar`** (`src/components/ui/Toolbar.jsx`)
  - Filter/search row: `flex flex-wrap items-center gap-2`, uniform control height (h-9). Used by Clients search bar, Projects filters, Kanban filters.
- **`FormActions`** (small helper or convention) — standardized footer: `flex justify-end gap-2 pt-2`. Applied across all modals/forms.

Primitives are presentational, token-based, and independently testable (a smoke test for `PageHeader` + `Card`).

## 7. Component polish pass (token-aware primitives)

Refine the existing primitives for the new density + dark-first look (no API changes):
- **Button** — violet primary with subtle hover/active depth; heights per §5; consistent `gap-2`; loading spinner sizing.
- **Input / Select / Textarea** — `h-9`, dark-friendly bg (`bg-bg-muted` or `bg-bg`), clear focus ring (violet), consistent placeholder color.
- **Badge** — refined tints on dark; tabular where numeric.
- **Modal / Drawer** — consistent padding, header rhythm, backdrop opacity tuned for dark; standardized footer (`FormActions`).
- **Tabs** — active = violet underline; even spacing.
- **Table** — compact cells, subtle row hover, header treatment.
- **EmptyState / Skeleton / Pagination** — consistent centering, spacing, shimmer tuned for dark.

## 8. Hero polish (most-seen surfaces)

- **App shell** — Sidebar: active nav item uses violet tint + left indicator, consistent item rhythm, refined brand wordmark (Loom violet / Lance muted); Topbar: aligned cluster, refined avatar/menu. A faint radial violet glow on the page background (dark only, very subtle) for atmosphere.
- **Login page** — a polished dark first impression: centered card on an atmospheric background, refined logo lockup, consistent field rhythm.

## 9. Per-screen alignment audit & fixes

Pass over each screen; standardize on primitives + §5 rhythm; fix cramped/stranded/misaligned elements:

- [ ] Login / Forgot / Reset (hero treatment + field rhythm)
- [ ] Dashboard (placeholder — light touch, consistent header)
- [ ] Clients list (PageHeader + Toolbar + Table)
- [ ] Client detail (ClientHeader actions cluster, Tabs, Overview/Contacts layout, modals)
- [ ] Projects (PageHeader, filter Toolbar, ProjectCard grid symmetry)
- [ ] Project detail / Kanban (board spacing, column rhythm, drawer, filters already pill-styled in Task 43 — align to system)
- [ ] Profile + remaining placeholders (consistent PageHeader)
- [ ] All modals/drawers/confirms (FormActions footer, padding)

## 10. Approach & verification

- Token + font + default-theme change first (instant app-wide repaint), verify live.
- Introduce primitives, then refactor screen-by-screen, verifying each live at `localhost:5173` and via Playwright spot-checks (no functional regressions, no console errors).
- `npm run build` + `npm run lint` + `npm run test:run` (26) green throughout.
- Commit per logical step.

## 11. Success criteria

- Dark-first Slate Pro look with violet accent and Outfit type, both themes refined.
- Consistent compact spacing rhythm across every screen; action clusters aligned; no "stuck together / miles apart" elements.
- Shared primitives (PageHeader/Card/Toolbar) adopted by the main screens.
- Zero functional regressions; tests green; lint clean; builds clean.
- Reversible/themeable (all via tokens + presentational primitives).
