---
target: the kanban board
total_score: 34
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T19-53-07Z
slug: src-pages-projectdetailpage-jsx
---
# Critique — Kanban board (`src/features/kanban/*`, via `ProjectDetailPage`)

**Visual basis:** code + design system + detector (clean). The most interaction-rich surface (drag-and-drop). Reviewed from source (login-gated).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | WIP count/limit badges, over-limit danger ring, drop highlight, drag overlay, toasts; board has no own loading skeleton |
| 2 | Match System / Real World | 4 | Kanban / columns / WIP / priority / due — standard PM language |
| 3 | User Control and Freedom | 4 | Drag, inline add, drawer edit, delete-with-confirm, filters + clear, cancel |
| 4 | Consistency and Standards | 3 | Badge/Button/Drawer/Select consistent; custom label chips differ from `Badge` |
| 5 | Error Prevention | 4 | 5px drag activation (drag≠click), delete confirm, zod, WIP-limit warning |
| 6 | Recognition Rather Than Recall | 4 | Filters, columns, options all visible |
| 7 | Flexibility and Efficiency | 4 | Pointer + keyboard drag, inline add, filters, WIP limits — real power features |
| 8 | Aesthetic and Minimalist | 3 | Clean; a priority badge on every card (incl. "low") + label chips add density |
| 9 | Error Recovery | 3 | Toasts on save/delete failure; not-found state |
| 10 | Help and Documentation | 2 | No in-board guidance / empty-state teaching (relies on kanban familiarity) |
| **Total** | | **34/40** | **Good (high) — the best-engineered surface so far** |

## Anti-Patterns Verdict

**Does it look AI-generated? No — this is the most sophisticated surface.** **Detector clean (0 findings).** Drag-and-drop is built on **@dnd-kit** with a `PointerSensor` (5px activation so a tap opens vs a drag moves) **and a `KeyboardSensor`** (cards are movable by keyboard) plus a `DragOverlay` and fractional `positionBetween` reordering. Cards are `role="button"` + `tabIndex` + Enter-to-open. WIP limits with a danger ring when exceeded. Accessible kanban is genuinely hard, and this is done right.

## Overall Impression

The strongest engineering on any surface: accessible DnD, WIP limits, inline-add, a drawer (not a modal) for editing, real filters. It earns the "calm control room" + "fewer steps" principles. The findings are **minor polish and one real a11y nit** (custom label-chip contrast) — nothing structural.

## What's Working

- **Accessible drag-and-drop.** @dnd-kit pointer + **keyboard** sensors, drag overlay, `closestCorners`, 5px activation distance, fractional positioning. The hard part of kanban, done accessibly — rare.
- **WIP limits with a real signal.** Column count `/ limit`, the badge + a `ring-danger` when over. A thoughtful PM feature with clear, on-brand feedback.
- **Right interaction choices.** Inline add-task per column and a side **Drawer** (not a modal-first edit) — matches the product principle of fewer steps and "exhaust inline alternatives before a modal." Delete is confirm-guarded.

## Priority Issues

- **[P2] Custom label-chip contrast can fail.** `TaskCard` renders label chips as `backgroundColor: color + '33'` (25% tint) with `color: <the same hue>` as text. A light/saturated label color (yellow, lime, cyan) becomes low-contrast text on a pale tint of itself. **Why it matters:** unreadable labels for some users, and the freelancer picks the colors. **Fix:** use a fixed dark/ink text on the tinted chip (or compute an accessible foreground), not the raw label hue as text. **Command:** `/impeccable colorize`. *(New → Linear.)*
- **[P3] "Hide Done" relies on a `/done/i` column-name regex.** Rename "Done" → "Complete/Shipped" and the filter silently stops working. **Fix:** mark done-ness with a column flag/type, not the display name. **Command:** `/impeccable harden`. *(New → Linear.)*
- **[P3] Priority badge on every card, including "low."** Adds a badge to every card even when priority is unremarkable. **Fix:** omit/quiet the "low" badge so high/medium stand out. **Command:** `/impeccable polish`. *(New → Linear.)*
- **[P3] Touch + keyboard interaction needs a device check.** Horizontal-scroll board + touch drag can fight on mobile; the card is both Enter-to-open and a keyboard-sortable (Space to pick up) — verify they don't collide. **Command:** `/impeccable adapt`. *(New → Linear.)*

## Persona Red Flags

**Alex (power user):** very well served — keyboard drag, inline add, filters, WIP limits. Might want bulk task actions, but the core is strong and fast.

**Sam (a11y):** standout for an interactive board — keyboard-movable cards, focusable cards, semantic priority badges, status not by color alone (count + ring + badge). The one gap is the **label-chip contrast** above; also confirm the Enter-to-open vs Space-to-drag keyboard models don't conflict.

**"Sam the solo freelancer":** kanban is familiar enough to use immediately; the only soft spot is a brand-new empty board has no "add your first task" teaching beyond the inline `+` (mitigated by the dashboard onboarding checklist).

## Minor Observations

- The board itself has no loading skeleton (columns/tasks load after the project) — brief empty flash possible.
- Custom label chips are a different chip style than the `Badge` component — minor vocabulary divergence.

## Questions to Consider

- Should "done-ness" be a column property rather than inferred from its name, so filters/automation stay robust to renames?
- Would quieting the "low" priority badge make high/medium read faster across a busy board?
- Is there a moment to teach a first-time user the board (drag a card, set a WIP limit) without a modal wall?
