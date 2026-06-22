# Impeccable critique — remaining surfaces (2026-06-22)

Batch critique of the surfaces not covered by the individual runs (dashboard, invoice editor, public invoice page, reports, kanban). Reviewed from source (login-gated); detector clean on every surface. Register: product. Design system: "Slate Pro" violet.

## Scoreboard (all surfaces critiqued this session)

| Surface | Score | Notes |
|---|---|---|
| Kanban board | 34/40 | best-engineered (accessible DnD) — LOO-61/62 |
| Reports | 32/40 | best-polished data-viz — LOO-59/60 |
| Time tracking | 32/40 | timer controls dense; default-rate field misplaced |
| Clients | 31/40 | status as bare text; row-action contrast |
| Contracts | 31/40 | raw enum badges; `active`→green semantics |
| Profile / Settings | 31/40 | `#2D3E50` default-accent source; own segmented toggle |
| Invoices list | 31/40 | **no amount column** (data-is-hero miss) |
| Dashboard | 30 → fixed ✅ | StatsRow rework shipped — LOO-54 |
| Invoice editor | 30/40 | risks already tracked — LOO-6/15/24/33 |
| Public invoice page | 30/40 | conversion/mobile/theme — LOO-57 |
| Recurring invoices | 29/40 | action-icon contrast; silent invalid autosave |
| Projects list | 23/40 | **identical-card-grid + N+1 task fetch** (lowest) |

**Range 23–34, mostly 30–32.** No surface is broken or AI-slop; detector clean everywhere. The lower scores are concentrated, fixable issues, not pervasive weakness.

## Cross-cutting themes (the high-leverage fixes)

### 1. `fg-subtle` (#8A95A5, ~2.9:1) used for meaningful content/controls — SYSTEMIC a11y (P2)
The single most-repeated finding. `fg-subtle` is "hints/placeholders/disabled only" per DESIGN.md, but it's used as the **resting color for actionable row-action icons** (Clients, Recurring, Expenses tables) and for **meaningful text** (Clients ActivityTab dates, Projects "N open tasks", board "Due {date}"). All sub-AA. → **LOO-63.** One pass: rest actionable icons at `fg-muted`, move meaningful text off `fg-subtle`.

### 2. Retired `#2D3E50` is the system-wide invoice-accent default (P2/P3)
Source is `BrandingTab.jsx` `DEFAULT_ACCENT = '#2D3E50'`, mirrored in `InvoicePDF`, `PublicInvoiceView`, `colors.js`. → folded into **LOO-55**: centralize one `INVOICE_DEFAULT_ACCENT` (neutral ink, not the dead slate).

### 3. Data lists lack sort / bulk actions / keyboard (P3, power-user)
Clients, Contracts, Time, Expenses, Invoices, Projects: no column sort, no row-select/bulk, no keyboard accelerators; some whole-row `onClick` without keyboard handlers. → **LOO-67.**

### 4. Status-badge polish (P3)
Contracts/Recurring render **raw lowercase DB enums** ("active", "paused"); Clients ActivityTab shows status as plain text (no badge). Map to Title-case + a status glyph via the existing `Badge`. (`active`→green is also semantically off; reserve green for completed.) → **LOO-67.**

### 5. Component-vocabulary divergences (P3)
SubscriptionTab rolls its own monthly/annual segmented toggle; Reports its own pill tabs; Invoices vs Projects use different filter idioms. Extract a shared `SegmentedControl`/standardize on `ui/Tabs`. → **LOO-67 / LOO-59.**

## Per-surface highlights

**Clients (31)** — strengths: component discipline, trust-first delete copy (archive beside delete), create-vs-edit split. Findings: status as bare text (use Badge), row-action icons sub-AA at rest, detail skeleton doesn't match layout, no sort/bulk.

**Time (32)** — strengths: tabular-nums everywhere, one-violet discipline, confirm on discard/delete. Findings: running-timer pause/commit/discard too dense (commit ✓ next to discard ✗ — misclick risk under a live timer), "Default rate" looks like a filter (it's a profile setting, persists silently), 9-col table where Duration should be the hero, topbar timer popover not keyboard/SR-operable.

**Contracts (31) / Recurring (29)** — strengths: tabular-nums, status-not-color-alone, real states. Findings: Recurring action icons sub-AA; raw lowercase enum badges; Recurring invalid edit silently holds (no error — see LOO-24); Contracts `active`→green; a lone uppercase "Description" heading.

**Expenses (27 — lowest with real issues)** — strengths: Ready-to-bill panel + category totals (work→money in one screen), correct status badges, autosave. Findings: **[P1] receipt replace deletes the old file before the new upload succeeds → data loss on failure**; **[P1] "Billable" with no client/project silently creates an un-billable expense**; receipt errors only via post-hoc toast (no inline validation/limits/progress); currency is **free-text** (typo corrupts grouping) — should be a Select; row-action icons sub-AA.

**Profile/Settings (31)** — strengths: autosave with `keepDirtyValues`, branding live preview, honest payment copy + tier gates. Findings: `#2D3E50` default accent (source of the system-wide drift); accent `<Input>` has no validation + dangling `htmlFor`; uppercase "Preview" eyebrow; own segmented toggle; first-timer discoverability (5 tabs, no "complete setup" nudge, master payment switch silently dims cards).

**Invoices list (31)** — strengths: real board view, status filters, debounced search, pagination, view-persist. Findings: **[P1] no amount/total column** (the number a freelancer scans for — data-is-hero miss); no sort; no bulk; whole-row `onClick` without keyboard handler; board silently caps at 200.

**Projects list (23 — lowest)** — strengths: clean cards, real `<Link>`s, empty state. Findings: **[P1] identical-card-grid (product ban) + N+1 `useTasks` per card**; no pagination/count/sort; "N open tasks" in sub-AA fg-subtle. → move to a dense table matching Invoices' vocabulary with batched counts.

## Linear (dual-home)
- **LOO-63** (Go-Live, P2) — cross-cutting `fg-subtle` a11y sweep.
- **LOO-64** (Go-Live, P2) — Expenses: receipt-upload safety + billable-without-client + currency select.
- **LOO-65** (Post-Launch, P2) — Projects list → table + batch task counts (N+1).
- **LOO-66** (Go-Live, P2) — Invoices list: add Total/amount column + sort.
- **LOO-67** (Post-Launch, P3) — cross-cutting consistency & power-user polish (sort/bulk/keyboard, Title-case status badges, shared SegmentedControl).
- **LOO-55** updated — centralize `INVOICE_DEFAULT_ACCENT` (BrandingTab is the source).
- **LOO-68** (Delivered) — this sweep, logged.
