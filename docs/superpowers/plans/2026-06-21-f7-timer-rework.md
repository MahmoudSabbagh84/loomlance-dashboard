# F7 — Topbar Timer Rework (Plan)

> Origin: QA **F7**. Redesign the topbar timer from a clock icon into an always-visible timer with pause/commit/discard and a tracking-state animation. Build task-by-task; lint/test/build green before each commit (scope `time`).

**Goal:** One continuous time entry per work session that the user can **pause** (freeze, excluded from total) and **resume**, then **commit (✓)** to register the accumulated active time toward the project — or **discard (✕)** (with confirmation) if started by mistake. A **breathing red dot** signals tracking (amber when paused), respecting `prefers-reduced-motion`.

## Decisions (locked)
- **True pause, one entry.** Add `time_entries.paused_at` + `paused_seconds`; elapsed/duration exclude paused time.
- **Controls (running/paused state):** Pause⇄Resume toggle · Commit (✓, replaces today's stop) · Discard (✕ → ConfirmDialog → delete entry).
- **Idle state:** compact — a play affordance opening the existing popover (project + optional contract pickers) → Start.
- **Indicator:** breathing red dot while running, solid amber while paused, none idle. `prefers-reduced-motion` → static dot.
- A paused entry still has `ended_at IS NULL`, so it remains "the running timer" (`getRunningTimer`); the UI distinguishes by `paused_at`.

## Active-time math
`activeSeconds(entry, nowMs)` = `max(0, (end − started_at)/1000 − paused_seconds)` where `end` = `ended_at` if finalized, else `paused_at` if paused, else `now`. Pure + unit-tested.

## Tasks
1. **Migration** (`<ts>_timer_pause.sql`): `alter table time_entries add column paused_at timestamptz, add column paused_seconds integer not null default 0;` Apply via MCP + file.
2. **lib/time.js**: add `activeSeconds(entry, nowMs)` + unit tests.
3. **api/time-entries.js**: SELECT adds `paused_at, paused_seconds`; `pauseTimer(id)` (set paused_at=now if running); `resumeTimer(id)` (read paused_at+paused_seconds → paused_seconds += now−paused_at, paused_at=null); update `stopTimer`→commit to compute `duration_minutes` from active seconds (fold a current pause). Discard reuses `deleteEntry`.
4. **hooks/useTimeEntries.js**: `usePauseTimer`, `useResumeTimer` (invalidate time-entries). Reuse `useStopTimer` (commit) + `useDeleteEntry` (discard).
5. **styles/tailwind.css**: `@keyframes breathe` + `.animate-breathe` (opacity pulse), disabled under `prefers-reduced-motion`.
6. **TimerWidget.jsx** rewrite: running/paused pill (elapsed via `activeSeconds`, ticking only while running; dot color by state; Pause/Resume + Commit ✓ + Discard ✕ with ConfirmDialog). Idle popover unchanged (project/contract + Start).
7. **Verify**: unit tests green; live MCP (start→pause→resume→commit → correct duration excludes paused; discard deletes) with `ZZ-` data + cleanup; lint/build. Mark F7 done in qa-findings + phases.
