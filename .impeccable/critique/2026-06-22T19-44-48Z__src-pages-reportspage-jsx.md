---
target: the reports page
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T19-44-48Z
slug: src-pages-reportspage-jsx
---
# Critique — Reports (`src/pages/ReportsPage.jsx` + `features/reports/*`)

**Visual basis:** code + design system + detector (clean). Tier-2 analytics surface; the only data-viz screen. Reviewed from source (login-gated).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Lazy-load skeletons, real empty states, inline date error |
| 2 | Match System / Real World | 4 | Standard finance terms (Revenue/P&L/Aging/Time), standard aging buckets |
| 3 | User Control and Freedom | 3 | Tabs + presets + custom range + currency + CSV + deep-link; invalid range → blank report |
| 4 | Consistency and Standards | 3 | Charts themed to tokens; but **three different tab vocabularies** in play |
| 5 | Error Prevention | 3 | Date from≤to validated inline and blocks render |
| 6 | Recognition Rather Than Recall | 4 | Tabs, labeled presets, currency tabs all visible |
| 7 | Flexibility and Efficiency | 4 | Presets + custom + per-currency + CSV export + deep-linkable |
| 8 | Aesthetic and Minimalist | 3 | Clean, well-themed charts; aging uses one flat color (missed risk signal) |
| 9 | Error Recovery | 3 | Empty states + date error |
| 10 | Help and Documentation | 2 | Finance jargon (P&L, aging) unexplained for the admin-averse user |
| **Total** | | **32/40** | **Good (upper) — the most polished surface so far** |

## Anti-Patterns Verdict

**Does it look AI-generated? No — and this is the strongest surface yet.** **Detector clean (0 findings).** The charts are **themed entirely through design tokens** (`var(--color-border)`, `--color-fg-muted`, `--color-primary`, tooltip on `--color-bg-elevated`) so they respect light/dark and the system — that's data-viz done *right*, which is rare. Lazy-loaded charts, genuine `EmptyState`s, CSV export, multi-currency, deep-linking. P&L even colors Revenue (violet) vs Expense (danger) semantically with a legend and sign-colored Net. This is craft.

## Overall Impression

The best-built screen I've reviewed: token-themed charts, real empty states (a step up from the dashboard's "nothing here"), export, and multi-currency all done thoughtfully. The opportunities are **polish, not fixes** — mostly making the *aging* chart signal risk through color, and tightening one consistency seam (tabs).

## What's Working

- **Charts respect the design system + theme.** Grid/axis/tooltip all use CSS-var tokens; bars use `--color-primary`/`--color-danger` with rounded caps and a compact tick formatter (`1.2k`). It looks native to the app in both themes.
- **Genuine empty states.** "No revenue in this range — Payments you receive will show up here." Icon + title + teaching description. This is the empty-state bar the dashboard should meet.
- **Real analyst affordances.** Date presets + custom range with `from ≤ to` validation, per-currency tabs, CSV export per report, and deep-linking (the dashboard chart drills straight into a month). Plus the chart is always backed by a data **table** (good for scanning *and* screen readers).

## Priority Issues

- **[P2] Aging chart uses one flat color for every bucket.** Current / 1–30 / 31–60 / 61–90 / 90+ all render in violet. **Why it matters:** aging is about *risk*, and color is the fastest signal — a freelancer should see overdue severity at a glance. **Fix:** escalate bucket color with the status palette (current → neutral/success … 90+ → danger). On-brand and more legible. **Command:** `/impeccable colorize`. *(New → Linear.)*
- **[P3] Three tab vocabularies.** The shared `ui/Tabs` (underline) is used elsewhere, but Reports rolls its own **pill** tabs for Revenue/P&L/Aging/Time, and `CurrencyTabs` is a third chip style. **Why it matters:** consistency is a product virtue; same control type should look the same. **Fix:** use `ui/Tabs` for the report tabs (keep CurrencyTabs as a distinct segmented control if intended). **Command:** `/impeccable polish`. *(New → Linear.)*
- **[P3] Finance jargon is unexplained.** "P&L" and "Aging" assume knowledge; the audience is admin-averse developers. **Fix:** a one-line definition or info tooltip per report. **Command:** `/impeccable clarify`. *(New → Linear.)*
- **[P3] Invalid date range shows a blank report.** When `from > to`, the control shows a small error but the report area below just renders nothing. **Fix:** a "Adjust the dates to see this report" placeholder. **Command:** `/impeccable harden`. *(New → Linear.)*

## Persona Red Flags

**Alex (power user / analyst):** well served — presets, custom range, per-currency, CSV, deep-links. Would want chart→table drill or click-to-filter, but the essentials are here.

**Sam (a11y):** charts are token-themed (theme-aware contrast) and **every chart is backed by a data table**, which is excellent for screen readers. Watch: chart elements lack aria text; aging relies on bar height alone (color would add a non-positional cue too).

**"Sam the solo freelancer":** can run the reports, but "P&L"/"Aging" without a plain-language hint may intimidate — the one place this surface assumes finance fluency.

## Minor Observations

- The monthly Revenue chart has By-client / By-project tables but no on-screen month table (CSV has it) — minor.
- Aging chart is single-series; severity color would also remove the need to read axis labels to gauge risk.

## Questions to Consider

- Should the aging chart's colors *be* the risk story (green→red), so the freelancer sees "I have a 90+ problem" before reading a number?
- Is the pill-tab style here intentional, or should Reports adopt the app's standard underline tabs for one consistent tab language?
- Would a one-line "what is this?" under each report header lower the bar for non-finance users without cluttering the analyst's view?
