---
name: LoomLance Dashboard
description: Calm, trustworthy command center for freelance developers — clients, invoices, time, money.
colors:
  bg: "#FBFBFD"
  bg-elevated: "#FFFFFF"
  bg-muted: "#F1F3F7"
  fg: "#14181F"
  fg-muted: "#5A6472"
  fg-subtle: "#8A95A5"
  border: "#E4E7EC"
  border-strong: "#CBD2DC"
  primary: "#6D45F0"
  primary-fg: "#FFFFFF"
  primary-hover: "#5B37D6"
  accent: "#7C5CFF"
  success: "#15A66E"
  warning: "#C77A12"
  danger: "#DC4040"
  info: "#2D74D6"
typography:
  display:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.bg-muted}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-ghost:
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  card:
    backgroundColor: "{colors.bg-elevated}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.bg-muted}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
---

# Design System: LoomLance Dashboard

## 1. Overview

**Creative North Star: "The Calm Control Room"**

LoomLance is the post-login app where a freelance developer runs the business of their business — clients, contracts, invoices, time, expenses, money. The interface is the control room for that operation: everything legible at a glance, status always unambiguous, and nothing competing for attention. The operator stays calm because the surface is calm. This is software people trust with their livelihood, so it earns that trust by being quiet, predictable, and exact — never flashy, never anxious, never shouting.

The system is **light-first on cool, near-white neutrals** (a true off-white at near-zero chroma, deliberately *not* the warm cream/sand that marks AI-default UIs), with a **confident violet** as the brand's single voice and a small, disciplined set of status hues. Depth is restrained: surfaces are flat by default and earn a shadow only when they rise (a primary button, a popover, a modal). Type is one family — Outfit — carrying the whole hierarchy through weight and size, so the page reads as one calm system rather than a collage. A full dark theme mirrors every token for low-light work.

What it explicitly rejects: the **generic SaaS template** (gradient hero, identical icon-card grids, Bootstrap-default spacing — "could be any startup") and **cluttered enterprise accounting** (QuickBooks/SAP dropdown-soup density and joyless gray walls). LoomLance must feel lighter, calmer, and more focused than the legacy tools it replaces.

**Key Characteristics:**
- Cool near-white neutrals (never cream/warm); the data, not the chrome, is the hero.
- One confident violet voice + a tight status palette; both light and dark themes hold WCAG AA.
- Flat by default; shadows are a response to state, not a decoration.
- One typeface (Outfit), full hierarchy by weight/size; numbers are tabular and aligned.
- Refined, restrained controls (6–8px radii, muted-fill inputs, understated hovers).

## 2. Colors

A cool, composed neutral field carrying one confident violet voice and a small set of status hues. Neutrals are tinted very slightly toward blue (hue ~230), never toward warm — warmth-by-default is the AI tell this system avoids.

### Primary
- **Signal Violet** (`#6D45F0`): the brand's voice — primary buttons, active navigation, selected states, links, focus rings, key data highlights, and chart emphasis. Used confidently throughout (not rationed to a single element) but always with discipline: it always means "this is actionable or active." Hover deepens to **Violet Deep** (`#5B37D6`).
- **Lifted Violet** (`#7C5CFF`): a lighter accent for tints (`primary/10` icon tiles, selection wash, soft glows) and the primary value in dark mode.

### Neutral
- **Ink** (`#14181F`): primary text, headings, the numbers that matter. Carries all essential reading.
- **Slate** (`#5A6472`): secondary text — labels, captions, supporting copy. Holds AA on light surfaces.
- **Fog** (`#8A95A5`): non-essential hints, placeholders, disabled text only. *Never* body or essential content (see Do's & Don'ts).
- **Paper** (`#FBFBFD`): the page background — a true near-white at ~zero chroma.
- **Pure Surface** (`#FFFFFF`): elevated surfaces — cards, header, menus, focused inputs.
- **Cool Mist** (`#F1F3F7`): muted fill — input rests, alternating rows, quiet section bands.
- **Hairline** (`#E4E7EC`) / **Hairline Strong** (`#CBD2DC`): default borders/dividers, and the hover/emphasis border.

### Status
- **Green** (`#15A66E`) success/paid · **Amber** (`#C77A12`) warning/due-soon · **Red** (`#DC4040`) error/overdue/destructive · **Blue** (`#2D74D6`) informational. Always paired with an icon or label — never color alone.

### Named Rules
**The Confident-Voice Rule.** Signal Violet is the only brand color and it always carries one meaning: actionable or active. Use it freely across actions, links, selection, and data emphasis — but never decoratively, and never a second brand hue beside it. Discipline, not scarcity, is the point.

**The Cool-Neutral Rule.** Neutrals tint toward blue (hue ~230) or stay at zero chroma. Cream, sand, beige, warm-gray (`--paper`/`--linen`-style warmth) is forbidden — it reads as generic-AI and breaks the composed, technical calm.

**The Status-Never-Alone Rule.** A status color is always reinforced by an icon, label, or text. Color alone never conveys state (color-blind users, AA).

## 3. Typography

**Display / Body / Label Font:** Outfit (with `system-ui, -apple-system, sans-serif` fallback). One family for everything.

**Character:** Outfit is a low-contrast geometric sans — clean, modern, quietly confident, with enough warmth to avoid feeling clinical. A single family across the whole hierarchy keeps the surface calm and coherent; contrast comes from weight and size, never from a second typeface. OpenType features `cv11` + `ss01` are enabled for more legible single-story glyphs.

### Hierarchy
- **Display** (600, `1.875rem`/clamp on marketing-ish surfaces, line-height 1.1, tracking −0.02em): auth screens, the occasional hero moment. Rare inside the app.
- **Headline** (600, `1.25rem`, tracking −0.01em): page titles (`PageHeader` h1).
- **Title** (600, `1rem`): card titles, section headers, dialog titles.
- **Body** (400, `0.875rem`, line-height 1.5): the app's base size — form values, table cells, descriptions. Cap prose at 65–75ch.
- **Label** (500, `0.75rem`): field labels, badges, table headers, metadata. Sentence case by default.

### Named Rules
**The One-Family Rule.** Outfit carries the entire hierarchy. Never introduce a second display or body face; hierarchy is weight (400/500/600) and size, not a font pairing.

**The Tabular-Number Rule.** Money, hours, dates, invoice numbers, and any aligned figures use tabular/`tabular-nums` and right-align in tables. Numbers are first-class content here — they must line up.

## 4. Elevation

Flat by default. Surfaces are distinguished by **background tone + a 1px hairline border**, not by shadow. A shadow appears only when an element genuinely rises above the page: the primary button (a soft violet-tinted lift), and transient layers — popovers, menus, dialogs, the auth card. Depth is a response to state and intent, never ambient decoration.

### Shadow Vocabulary
- **Primary lift** (`box-shadow: 0 1px 2px 0 rgb(109 69 240 / 0.20)` — `shadow-sm shadow-primary/20`): the primary button only; a faint violet glow that says "press me."
- **Floating layer** (`box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.18)` — `shadow-xl`-ish): popovers, dropdown menus, modals, the auth card. Paired with the `pop-in` entrance.

### Named Rules
**The Flat-By-Default Rule.** Cards, panels, table rows, and inputs are flat at rest — border + tone only. If you're reaching for a shadow on a resting card, you're wrong; raise it with `bg-elevated` and a border instead. Shadows are reserved for what's actionable (primary button) or transient (overlays).

## 5. Components

Controls are **refined and restrained** — composed, quiet, never drawing attention to themselves. Small radii (6–8px), muted fills, understated hovers, a crisp violet focus ring.

### Buttons
- **Shape:** gently rounded (`6px`, `rounded-md`), height `36px` (md); `32px` (sm) / `44px` (lg). `font-medium`, `transition-all`, `active:scale-[.98]` for a subtle press.
- **Primary:** Signal Violet fill, white text, faint violet lift (`shadow-sm shadow-primary/20`); hover → Violet Deep (`#5B37D6`).
- **Secondary:** Cool Mist fill (`bg-muted`), Ink text, hairline border; hover strengthens the border and lifts to Pure Surface.
- **Ghost:** no fill; Slate text → Ink on hover with a Cool Mist wash. For low-emphasis/toolbar actions.
- **Danger:** Red fill for destructive confirmation only. **Link:** violet, underline-on-hover, no padding.
- **Focus:** global ring — `ring-2 ring-primary ring-offset-2 ring-offset-bg`.

### Cards / Containers
- **Corner Style:** `8px` (`rounded-lg`).
- **Background:** Pure Surface (`bg-elevated`) on the Paper page.
- **Shadow Strategy:** none at rest (see Elevation). Hierarchy from tone + border.
- **Border:** 1px Hairline (`border`).
- **Internal Padding:** `16px` default (`12px` sm / `20px` lg). **Never nest a card inside a card.**

### Inputs / Fields
- **Style:** height `36px`, `6px` radius, 1px Hairline border, **Cool Mist fill** (`bg-muted`) at rest, `0.875rem` Ink text.
- **Hover:** border strengthens (Hairline Strong).
- **Focus:** border → Signal Violet **and** fill → Pure Surface (the field "wakes up"); global violet ring.
- **Placeholder:** Fog (`fg-subtle`). **Error:** Red border + helper text. **Disabled:** 50% opacity, not-allowed.

### Navigation
- **Style:** quiet sidebar/top nav; Slate labels, Ink on hover. **Active** item carries Signal Violet (text + a subtle violet wash). Mobile: off-canvas drawer with `slide-in-left` (160ms) over a scrim.

### Status badges
- Small, `full`-radius or `6px` pills using the status hues at low-tint backgrounds with the matching ink (e.g. paid → Green tint + Green text + check icon). Always icon-or-label, never color alone.

### Overlays (menus, dialogs, toasts)
- Pure Surface, Hairline border, **Floating layer** shadow, `pop-in` entrance (120ms, ease-out-expo). Toasts offset below the topbar with a dismiss control. Build a semantic z-scale (dropdown → sticky → modal-backdrop → modal → toast → tooltip).

## 6. Do's and Don'ts

### Do:
- **Do** keep surfaces flat at rest — border + tone, not shadow. Raise only what's actionable or transient.
- **Do** let Signal Violet (`#6D45F0`) carry one meaning — actionable/active — used confidently across actions, links, selection, and data emphasis.
- **Do** keep neutrals cool (hue ~230) or zero-chroma. The page background is Paper (`#FBFBFD`), a true near-white.
- **Do** make numbers tabular and right-aligned in tables; money/hours/dates are first-class content.
- **Do** carry the full type hierarchy in Outfit via weight and size; cap prose at 65–75ch.
- **Do** hold WCAG AA in both light and dark: body text ≥4.5:1 (use Ink/Slate), visible focus ring, reduced-motion alternatives, status reinforced by icon/label.

### Don't:
- **Don't** ship the **generic SaaS template** — no gradient hero, no identical icon-card grids, no Bootstrap-default spacing. If a screen "could be any startup," redesign it.
- **Don't** recreate **cluttered enterprise accounting** — no dropdown soup, no dense intimidating forms, no joyless gray walls. Lighter and more focused than QuickBooks/SAP, always.
- **Don't** use warm neutrals — no cream, sand, beige, parchment, or warm-gray. That's the AI-default tell and it breaks the composed calm.
- **Don't** use Fog (`#8A95A5`) for body or any essential text — it's for hints/placeholders/disabled only (it does not meet AA as body). Bump to Slate or Ink for anything that must be read.
- **Don't** introduce a second brand color or a second typeface. One violet voice, one family (Outfit).
- **Don't** use a `border-left`/`border-right` color stripe as an accent, gradient text, or decorative glassmorphism (cross-register bans).
- **Don't** put a shadow on a resting card or nest cards inside cards.
- **Don't** convey status with color alone — always pair with an icon or label.
