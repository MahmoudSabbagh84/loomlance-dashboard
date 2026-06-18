# Mobile Pass Implementation Plan (Phase 2 · Milestone 6 — final)

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the app usable on phones — add mobile navigation (the sidebar is `lg:flex`, so phones currently have NO nav), and fix overlay sizing (Drawer width, Modal height) for small screens.

**Architecture:** Extract the sidebar's nav list into a shared `<SidebarNav/>` used by both the desktop `Sidebar` and a new `<MobileNav/>` (hamburger in the Topbar → slide-in left drawer). Tables already wrap in `overflow-x-auto` and the kanban already has `overflow-x-auto snap-x` — those are fine; no per-page card rewrite needed. Drawer/Modal get responsive sizing.

**Tech Stack:** existing NAV config + `hasFeature` tier gating + `UpgradeDialog`; `react-router` `useLocation`; lucide `Menu`/`X`; a new `slide-in-left` keyframe.

---

### Task 1: Shared nav + mobile drawer

**Files:**
- Create: `src/components/layout/SidebarNav.jsx`
- Modify: `src/components/layout/Sidebar.jsx` (use SidebarNav)
- Create: `src/components/layout/MobileNav.jsx`
- Modify: `src/components/layout/Topbar.jsx` (hamburger on the left, `lg:hidden`)
- Modify: `src/styles/tailwind.css` (slide-in-left keyframe)

- [ ] **Step 1:** `SidebarNav.jsx` — move the `NAV` array + `<nav>` rendering (NavLink active styling, locked-feature button → UpgradeDialog) out of `Sidebar`. Accept `onNavigate` prop, call it on NavLink click (closes the mobile drawer). Owns its own `lockedFeature` state + UpgradeDialog.
- [ ] **Step 2:** `Sidebar.jsx` — keep the `aside` (`hidden ... lg:flex`) + brand header; render `<SidebarNav/>`.
- [ ] **Step 3:** `MobileNav.jsx` — internal `open` state; hamburger `<button class="lg:hidden">` (Menu). When open: `fixed inset-0 z-50 lg:hidden` backdrop + left panel (`w-72`, `animate-slide-in-left`) with brand header (logo + close X) + `<SidebarNav onNavigate={close}/>`. Close on backdrop click, Escape, and route change (`useEffect` on `location.pathname`).
- [ ] **Step 4:** `Topbar.jsx` — wrap the existing search pill in a left group with `<MobileNav/>` before it.
- [ ] **Step 5:** `tailwind.css` — add `@keyframes slide-in-left` (translateX(-100%)→0, ~160ms) + `.animate-slide-in-left`.

---

### Task 2: Responsive overlays

**Files:**
- Modify: `src/components/ui/Drawer.jsx`
- Modify: `src/components/ui/Modal.jsx`

- [ ] **Step 1:** Drawer default `width` → `'w-[calc(100vw-2.5rem)] sm:w-[480px]'` (full-width-minus-margin on phones, 480px on ≥sm; leaves a backdrop strip to tap).
- [ ] **Step 2:** Modal panel → add `flex max-h-[calc(100dvh-2rem)] flex-col`; move the body to `flex-1 overflow-y-auto` so tall forms scroll within the viewport instead of overflowing. Header stays pinned.

---

### Task 3: Verify and commit

- [ ] **Step 1:** Gate — `npm run build`, `eslint --max-warnings 0`, `vitest run` (28 pass).
- [ ] **Step 2:** Live-verify (Playwright, iPhone-ish viewport 390×844): hamburger visible on mobile → tap opens nav drawer → nav links present → tap a link navigates & closes drawer; desktop (1280) shows sidebar and NO hamburger; open a Drawer (task) and Modal (new client) at 390px wide → both fit within viewport. 0 errors.
- [ ] **Step 3:** Commit: `feat(mobile): mobile nav drawer + responsive overlays`.

---
```
