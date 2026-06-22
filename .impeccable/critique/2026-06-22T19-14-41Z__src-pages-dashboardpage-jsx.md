---
target: the dashboard
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T19-14-41Z
slug: src-pages-dashboardpage-jsx
---
# Critique — Dashboard overview (`src/pages/DashboardPage.jsx`)

**Visual basis:** code + documented design system + clean deterministic scan. The authenticated dashboard is login-gated, so it was reviewed from source (not pixel-rendered); a login-based visual pass can deepen contrast/rhythm/breakpoint findings.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons + active nav + toasts solid; no global stale/last-updated cue on cached panels |
| 2 | Match System / Real World | 3 | "Open invoices" stat actually shows the **overdue** count (label/value mismatch) |
| 3 | User Control and Freedom | 3 | Cancel/back/confirm present; little undo; dashboard lists have no "view all" |
| 4 | Consistency and Standards | 3 | Strong Card/Button vocabulary; redundant active-nav treatment; the stat mismatch |
| 5 | Error Prevention | 3 | Autosave + confirm dialogs + zod; pending autosave can drop on modal close (LOO-15) |
| 6 | Recognition Rather Than Recall | 4 | Labeled icon+text nav, Cmd+K palette, search — genuinely low recall load |
| 7 | Flexibility and Efficiency | 3 | Command palette + hotkeys; no bulk/batch actions on data lists |
| 8 | Aesthetic and Minimalist | 3 | Calm and restrained; StatsRow is the one "generic SaaS" tell; page runs long/stacked |
| 9 | Error Recovery | 3 | mapPostgresError → friendly toasts + SaveStatus retry; some raw "not found" copy |
| 10 | Help and Documentation | 2 | OnboardingChecklist is good; otherwise no contextual help/tooltips |
| **Total** | | **30/40** | **Good — solid foundation, address the weak areas** |

## Anti-Patterns Verdict

**Does it look AI-generated? Mostly no.** It passes the product slop test — a user fluent in Linear/Stripe would trust it: consistent component vocabulary, restrained color, labeled nav, tabular numbers, real skeleton states. The tool mostly disappears into the task, which is the bar.

**LLM assessment.** One element carries the generic-SaaS risk: **`StatsRow`** stacks *three* of the parent skill's banned tells at once — the hero-metric template (icon tile + big number), an identical 4-card grid (same size, same shape), and **tiny uppercase tracked labels** (`text-xs uppercase tracking-wide`). It's the most "could be any startup" thing on the page and undercuts the "calm control room" identity. Everything else is on-brand.

**Deterministic scan.** `detect.mjs` over `DashboardPage.jsx` + `features/dashboard` + `components/layout` → **clean (0 findings)**. The StatsRow tells above are JSX/semantic patterns the static detector doesn't flag, so the LLM catch is additive, not contradicted.

**Visual overlays.** Not available — the target is auth-gated and was not rendered in a browser. No user-visible overlay exists for this run; findings are source-based.

## Overall Impression

This is a **calm, competent, well-built dashboard** that already lives up to most of its "Calm Control Room" north star — flat surfaces, one violet voice, labeled nav, skeleton loading, a command palette. It does not feel like AI slop. The biggest single opportunity: the **StatsRow** is doing generic-SaaS cosplay at the top of the most-seen screen, and the **"Open invoices" stat is mislabeled** — for a money tool, a wrong-looking number on the dashboard is a trust paper-cut. Fix those two and tidy the empty states, and this screen moves from "good" to "genuinely excellent."

## What's Working

- **Earned familiarity & consistency.** One Card vocabulary, one Button system, tabular-nums everywhere money/dates appear, labeled icon+text nav. Screen-to-screen predictability is a virtue here, and it's real.
- **Recognition over recall (heuristic 4/4).** Cmd+K command palette + persistent search with a visible hotkey + always-labeled nav means users never have to memorize paths. This is the strongest part of the experience.
- **Honest loading & first-run.** Skeletons (not center spinners) per the product reference; the `OnboardingChecklist` teaches the app by action and auto-hides when complete — a genuinely good activation touch.

## Priority Issues

- **[P2] StatsRow is the generic-SaaS tell.** Four identical cards, each icon-tile + UPPERCASE tracked label + big number — the hero-metric + identical-grid + tracked-eyebrow trio. **Why it matters:** it's the first thing users see and it reads "template," diluting the calm/premium identity and flattening the hierarchy (all four metrics shout equally; revenue should lead). **Fix:** break the symmetry — lead with Revenue as the dominant figure, demote the rest to a quieter inline strip; drop the uppercase tracking (sentence-case labels). **Command:** `/impeccable layout` (or `/impeccable distill`).
- **[P2] "Open invoices" shows the overdue count.** `label="Open invoices"` renders `stats.overdueCount` under an AlertTriangle. **Why it matters:** a mislabeled number on a money dashboard is a direct trust hit and a Match-to-real-world failure. **Fix:** relabel to "Overdue" (matches the value + icon), or show the true open count and add overdue separately. **Command:** `/impeccable clarify`.
- **[P2] Empty/quiet states say "nothing," don't reassure or guide.** "No activity yet." / "Nothing due in the near term." **Why it matters:** the product register explicitly wants empty states that teach, and a freelancer glancing at a quiet dashboard should feel *on top of things*, not stared back at. **Fix:** turn them into calm, reassuring states with a next action ("All clear — nothing due in 7 days" + a subtle link to create an invoice). **Command:** `/impeccable onboard`.
- **[P2] Contextual help is thin (heuristic 2/4).** Beyond onboarding there are no tooltips/inline hints; stat meanings (e.g. what "Outstanding" counts, which currencies) aren't explained. **Why it matters:** admin-averse first-timers guess. **Fix:** add quiet info affordances on the stat cards / panel headers. **Command:** `/impeccable clarify`.
- **[P3] Redundant + borderline active-nav treatment.** The active item already gets `bg-primary/12` + violet text + `font-medium`, *and* a 3px left `before:` stripe. **Why it matters:** the stripe is redundant (active is already obvious) and it's the side-stripe pattern the skill bans on list items. **Fix:** drop the bar; keep the tint+color (cleaner, on-brand). **Command:** `/impeccable polish`.

## Persona Red Flags

**Alex (Power User):** Cmd+K palette + search hotkey + keyboard nav land well — but **no bulk/batch actions** on the data lists (invoices, clients), so multi-item work is one-at-a-time. Dashboard panels cap at 5/10 items with **no "view all"**, forcing a context switch to the full page. He'll want a denser, faster path.

**Sam (Accessibility-dependent):** Global focus ring + labeled controls + status-as-text (not color-alone) are good. But **`fg-subtle` (#8A95A5) carries meaningful info** — the "Xd" days-until counter in *Due Soon* and stat sub-text — at ~2.9:1 on white, **below WCAG AA**. The uppercase tracked stat labels also reduce legibility. (Ties to the documented "Fog is hints-only" rule and go-live LOO-16.)

**"Sam the solo freelancer" (project persona — admin-averse, technical):** The OnboardingChecklist meets him well. But the mislabeled "Open invoices" stat and unexplained metrics make him second-guess the numbers — exactly the audience least willing to tolerate a money tool that looks even slightly wrong.

## Minor Observations

- Dashboard is ~6 stacked full-width sections; consider whether all earn a spot above the fold or whether secondary panels can be demoted/collapsed.
- `RecentActivity` packs type + status + client into one `·`-separated line — scannable but undifferentiated; small leading type-icons (like DueSoon has) would speed parsing.
- No "view all" / overflow affordance on Due Soon (5) and Recent Activity (10).
- Nice, restrained touch: the dark-mode-only radial primary glow behind content (`opacity-0 dark:opacity-100`, pointer-events-none) — on-brand, not slop.

## Questions to Consider

- What if **Revenue** were the dashboard's single hero figure, with the other three stats demoted to a quiet strip — would the screen feel more confident and less "template"?
- Does the overview need all six sections, or would a freelancer be better served by "what needs my attention" (due/overdue/get-paid) leading, and the rest below?
- What would the **quiet/all-clear** dashboard feel like for a user with nothing due — reassuring, or empty? That state may be the most common one and deserves design, not a fallback string.
