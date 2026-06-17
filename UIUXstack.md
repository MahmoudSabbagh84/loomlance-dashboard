# LoomLance — UI / UX & Design System

This document is the reference for LoomLance's visual language: identity, color, typography, spacing, components, theming, motion, and accessibility. It describes the **"Slate Pro"** design system the app is built on.

Pair this with [`techstack.md`](./techstack.md) (engineering stack). Source of truth for tokens: `src/styles/tokens.css` + `tailwind.config.js`; component primitives live in `src/components/ui/`.

---

## 1. Identity

**Slate Pro — a dark-first, professional command center for freelancers.**

- **Dark-first:** dark is the default experience and gets the most polish; a refined light theme is always available via the ☀/☾ toggle.
- **Accent:** a single confident **violet** (`#7C5CFF`) drives actions, links, focus, and active states. Status colors (green/amber/red/blue) are functional only — never used as brand accent.
- **Density:** **compact** — efficient information density (smaller control heights, tighter rhythm) suited to a data-rich dashboard.
- **Tone:** calm, crisp, premium (Linear / Vercel-grade), not flashy. Cohesion over novelty.

Everything is driven by **CSS design tokens** mapped into Tailwind, so the entire app re-themes from one file.

---

## 2. Color palette

All colors are CSS custom properties on `:root` (light) and `:root[data-theme='dark']` (dark), surfaced as Tailwind utilities (`bg-bg`, `text-fg`, `bg-primary`, `border-border`, `text-success`, …). Components never hardcode hex — they use tokens, so both themes and any future re-skin come for free.

### 2.1 Dark theme (default / hero)

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#0B0E14` | App background (deep slate) |
| `--color-bg-elevated` | `#151B26` | Cards, sidebar, columns, modals, panels |
| `--color-bg-muted` | `#1E2532` | Inputs, hovers, subtle fills |
| `--color-fg` | `#E6EDF3` | Primary text |
| `--color-fg-muted` | `#94A3B8` | Secondary text |
| `--color-fg-subtle` | `#64748B` | Tertiary text, placeholders, icons |
| `--color-border` | `#222B38` | Hairline borders |
| `--color-border-strong` | `#324054` | Emphasis borders, hover borders |
| `--color-primary` | `#7C5CFF` | **Brand violet** — actions, links, active nav, focus |
| `--color-primary-fg` | `#FFFFFF` | Text/icon on primary |
| `--color-primary-hover` | `#8E72FF` | Primary hover |
| `--color-accent` | `#A78BFF` | Light-violet, sparing highlights |
| `--color-accent-fg` | `#0B0E14` | Text on accent |
| `--color-success` | `#34D399` | Paid / positive |
| `--color-warning` | `#F5B14C` | Caution / pending |
| `--color-danger` | `#F87171` | Destructive / overdue |
| `--color-info` | `#60A5FA` | Informational |

### 2.2 Light theme (refined, secondary)

| Token | Hex | Role |
|---|---|---|
| `--color-bg` | `#FBFBFD` | App background (near-white) |
| `--color-bg-elevated` | `#FFFFFF` | Cards, panels |
| `--color-bg-muted` | `#F1F3F7` | Inputs, hovers |
| `--color-fg` | `#14181F` | Primary text (cool near-black) |
| `--color-fg-muted` | `#5A6472` | Secondary text |
| `--color-fg-subtle` | `#8A95A5` | Tertiary text |
| `--color-border` | `#E4E7EC` | Hairline borders |
| `--color-border-strong` | `#CBD2DC` | Emphasis borders |
| `--color-primary` | `#6D45F0` | Brand violet (deeper for light-bg contrast) |
| `--color-primary-fg` | `#FFFFFF` | Text on primary |
| `--color-primary-hover` | `#5B37D6` | Primary hover |
| `--color-accent` | `#7C5CFF` | Highlights |
| `--color-accent-fg` | `#FFFFFF` | Text on accent |
| `--color-success` | `#15A66E` | Paid / positive |
| `--color-warning` | `#C77A12` | Caution |
| `--color-danger` | `#DC4040` | Destructive |
| `--color-info` | `#2D74D6` | Informational |

### 2.3 Semantic / status usage
- **Status badges** map state → semantic color:
  - **Contracts:** draft→default · active→success · completed→info · expired→warning · canceled→danger
  - **Invoices:** draft→default · sent/viewed→info · paid→success · overdue→danger · void→default
- Semantic colors are used at low-alpha tints for badge backgrounds (e.g. `bg-success/15 text-success`).

---

## 3. Typography

- **Typeface:** **Outfit** (geometric sans), loaded from Google Fonts; fallback `system-ui, -apple-system, sans-serif`. Set as Tailwind's `sans` family and the `body` font.
- **Headings:** weight 600–700, tight tracking (`tracking-tight`, ≈ `-0.01em` to `-0.02em`) on larger sizes.
  - Page titles: `text-xl font-semibold tracking-tight` (via `PageHeader`).
  - Section headings: `text-sm font-semibold`.
- **Body / UI:** base `text-sm`; secondary text uses `text-fg-muted`, tertiary `text-fg-subtle`.
- **Numerals:** money, counts, dates, and metrics use **`tabular-nums`** so columns align and figures don't jitter while editing.
- `font-feature-settings: 'cv11', 'ss01'` enabled on body for refined letterforms.

---

## 4. Spacing & density (compact scale)

Compact is the standard. Use these consistently instead of ad-hoc values:

| Element | Value |
|---|---|
| Control height (Input / Select / Button md) | `h-9` (36px) |
| Button sizes | sm `h-8` · md `h-9` · lg `h-11` |
| Button padding (md) / icon↔label gap | `px-3.5` / `gap-2` |
| App shell content padding | `px-6 py-5`, capped at `max-w-7xl` |
| Page section gap | `space-y-5` |
| Card padding | sm `p-3` · md `p-4` (default) · lg `p-5` |
| Grid / card gap | `gap-3` (dense) · `gap-4` (cards) |
| Form field gap | `space-y-3.5` |
| Form footer | `flex justify-end gap-2 pt-2` |
| Table cell | `px-4 py-2.5` |
| Sidebar nav item | `px-3 py-2`, `gap-2.5` |
| Base UI text | `text-sm` |

---

## 5. Shape, depth & motion

- **Radii:** `rounded-md` for controls/menus, `rounded-lg` for cards/panels/modals, `rounded-full` for badges and pill toggles.
- **Borders:** `1px` hairlines (`border-border`); hover/emphasis uses `border-border-strong`.
- **Elevation:** depth comes from **layered surfaces** (`bg` → `bg-elevated` → `bg-muted`) and subtle borders rather than heavy shadows. Modals/drawers use `shadow-2xl`; the login card uses `shadow-xl`. The primary button carries a soft violet glow (`shadow-sm shadow-primary/20`).
- **Backdrops:** modal/drawer overlays are `bg-black/60 backdrop-blur-sm`.
- **Atmosphere (dark only):** a faint violet radial **glow** sits behind page content; the auth screens get larger violet/accent glow orbs.
- **Focus:** global `*:focus-visible` → `ring-2 ring-primary ring-offset-2 ring-offset-bg` (violet focus ring).
- **Selection:** text selection is a 30% violet tint (`::selection`).
- **Motion:**
  - `transition-colors` / `transition-all` on interactive elements; buttons `active:scale-[.98]`.
  - **`animate-pop-in`** (120ms, custom cubic-bezier) — a subtle scale/opacity entrance for menus, dropdowns, and modals.
  - The Topbar is a **blurred sticky header** (`bg-bg/80 backdrop-blur`).
  - Motion is deliberately restrained (no scroll-jank, no gratuitous animation).

---

## 6. Layout system

The structural backbone — shared primitives enforce identical spacing/alignment across every screen (the cure for "stuck-together / miles-apart" inconsistencies).

- **`AppShell`** (`components/layout/`) — fixed-width **Sidebar** (`w-60`, `lg:` and up) + a column with a sticky **Topbar** and a scrollable `<main>` (centered `max-w-7xl`, `px-6 py-5`, plus the dark glow).
- **`Sidebar`** — brand wordmark (Loom in violet / Lance muted), tier-aware nav. Active item: `bg-primary/12 text-primary` with a violet left-indicator bar. Tier-locked items show a lock and open an upgrade dialog.
- **`Topbar`** — notification bell, theme toggle, and an avatar menu (Profile / Subscription / Sign out) as a pop-in dropdown. Uniform `size-9` icon buttons.
- **`PageHeader`** (`components/ui/`) — title (+ optional subtitle) left, actions right; one consistent rhythm everywhere.
- **`Card`** — the single surface primitive (`rounded-lg border bg-bg-elevated`, padding `sm|md|lg`), polymorphic via `as`.
- **`Toolbar`** — filter/search rows on a uniform baseline and gap.
- **`AuthShell`** — centered card on an atmospheric background, shared by login / forgot / reset.

---

## 7. Component library (`src/components/ui/`)

Token-driven, presentational, and reused everywhere.

**Controls**
- **`Button`** — variants `primary` (violet, soft glow), `secondary` (muted surface + border), `danger`, `ghost`, `link`; sizes `sm | md | lg`; `loading` spinner; `active:scale` press.
- **`Input`, `Select`, `Textarea`** — `h-9`, `bg-bg-muted`, hover `border-border-strong`, focus `border-primary`; placeholders `text-fg-subtle`.
- **`Label`** (with required asterisk) + **`FieldError`** (danger text under fields).
- **`TagInput`** — chip entry (Enter/comma to add, Backspace/×, removal buttons are `type="button"` so they don't submit forms).

**Overlays & feedback**
- **`Modal`** — sizes `sm | md | lg | xl`, blurred backdrop, pop-in, titled header with close, Escape-to-close, body-scroll lock.
- **`Drawer`** — right/left side panel, blurred backdrop, Escape-to-close.
- **`ConfirmDialog`** — confirm/cancel built on `Modal` (used for deletes/voids).
- Toasts via **sonner** (`richColors`, top-right).

**Data display**
- **`Table`** set (`Table`, `THead`, `TR`, `TH`, `TD`) — compact cells, row hover, optional clickable rows.
- **`Badge`** — variants `default | success | warning | danger | info | primary`; `tabular-nums`.
- **`Tabs`** — violet active underline.
- **`Pagination`** — prev/next with a tabular page indicator.
- **`EmptyState`** — centered icon + title + description + action (CTA).
- **`Skeleton`** — `animate-pulse` loading placeholders.

**Layout primitives:** `PageHeader`, `Card`, `Toolbar` (see §6).
**Utility:** `cn` — `clsx` + `tailwind-merge`.

---

## 8. Feature UI highlights

- **Kanban board** (`features/kanban/`) — drag-and-drop columns/cards (dnd-kit), per-column WIP badges + over-limit ring, filter bar with **pill toggles**, ghost "Add column", inline add-task, a task **detail drawer**, and a column settings menu (pop-in, closes on outside-click/Escape).
- **Invoice editor** (`features/invoices/`) — **split view**: a line-item builder with **live totals** (subtotal / per-rate tax / discount / total recompute as you type) on the left, and a **live white-paper invoice preview** on the right (intentionally light/`bg-white` regardless of theme, since an invoice is printed on paper). A status-machine action bar (sent → paid → void, etc.).
- **Tier gating** (`components/gates/`) — `TierGate`, `UpgradeCard`, `UpgradeDialog` present locked features and route to the Splash pricing page.

---

## 9. Theming mechanism

1. **Tokens** are declared in `src/styles/tokens.css` for `:root` (light) and `:root[data-theme='dark']` (dark).
2. **Tailwind** maps semantic color names → those variables in `tailwind.config.js` (`darkMode: ['class', '[data-theme="dark"]']`).
3. The **default** theme is **dark** — an inline script in `index.html` sets `data-theme` to the saved value or `'dark'` before paint (no flash).
4. **`useTheme`** toggles `data-theme` and persists to `localStorage` (`loomlance-theme`); the Topbar exposes the ☀/☾ control.

To re-skin the entire product, edit token values only — no component changes required.

---

## 10. Iconography & imagery
- **Icons:** **lucide-react** throughout (consistent `size-4` / `size-5`), inheriting `currentColor`.
- **Brand:** `/logo.png` + the "LoomLance" wordmark (Loom = primary, Lance = muted). Tagline: *"Weave it all together."*
- **Invoice branding:** Tier 1/2 users can surface a logo, accent color, and footer on invoices (read from profile).

---

## 11. Accessibility
- **Focus-visible** rings on all interactive elements (violet, offset).
- **ARIA:** menus use `role="menu"`/`menuitem` + `aria-haspopup`/`aria-expanded`; dialogs use `role="dialog"` + `aria-modal`; icon-only buttons have `aria-label`; toggles use `aria-pressed`.
- **Keyboard:** Escape closes overlays/menus; menus close on outside-click; the Kanban board includes a keyboard drag sensor.
- **Contrast:** text tiers and semantic colors are tuned per theme to hold contrast on both slate-dark and near-white backgrounds.
- **Motion:** intentionally minimal and short; no essential information conveyed by motion alone.

---

## 12. Conventions for contributors
- **Use tokens, never hardcode colors.** `text-fg`, `bg-bg-elevated`, `text-primary`, etc.
- **Reach for the primitives** (`PageHeader`, `Card`, `Toolbar`, `Button`, `Input`, …) before writing bespoke markup — this is what keeps spacing/alignment consistent.
- **Follow the compact scale** in §4.
- **Buttons inside forms** that aren't submitting must be `type="button"`.
- **Numbers** get `tabular-nums`.
- **Verify both themes** (toggle ☀/☾) — the violet accent and contrast must hold in light and dark.
