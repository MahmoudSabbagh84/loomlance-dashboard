# Brainstorm — Autosave everywhere (drop manual "Save")

> **Status:** 🧪 Brainstorm (needs your approval before a spec → plan → build).
> **Date:** 2026-06-21. **Author:** Claude (manual superpowers flow — plugin not installed on this machine).
> **Trigger:** User: *"changes and adjustments done should be automatically saved across the board"* — manual Save is unintuitive. Surfaced via the invoice client-default bug (an unsaved client change reverted to client #1).

---

## 1. Problem & goal

Today every editor is **explicit-save**: you change fields, then click **Save** (or the change is lost). That's:
- **Unintuitive** — modern apps (Notion, Linear, Google Docs) autosave; users don't expect a Save button.
- **Bug-prone** — the invoice editor let you change the client but silently kept the old value until Save. We just patched the worst instance (client picked at creation), but the underlying "unsaved state is invisible and lossy" pattern is everywhere.

**Goal:** edits persist automatically, with clear "Saving… / Saved" feedback, no manual Save button for routine field edits — **while keeping irreversible actions explicit and never persisting invalid/garbage data.**

**Non-goals (for v1):** real-time multi-device collaboration/merge, offline-first sync, undo history. We just want reliable single-user autosave.

---

## 2. Surfaces in scope (every form)

| Surface | Shape | Notes / risk |
|---|---|---|
| **Invoice editor** (`InvoiceEditor`) | Header fields + **line-items array** + totals | Highest value, highest complexity (array rows, totals, currency). Good **pilot**. |
| Client form | Flat fields | Simple. |
| Project form | Flat + color | Simple. |
| Contract form | Flat + hourly_rate | Simple. |
| Expense form | Flat + receipt upload | Upload stays explicit. |
| Recurring template | Flat | Simple. |
| Profile / Payments tab | Flat + toggle + logo upload | Toggle/instructions should autosave; uploads explicit. |
| People/contacts | Sub-records | Add/remove stays explicit; field edits autosave. |

**Creation stays explicit everywhere** (the `NewInvoiceModal` pattern): you can't autosave a record that doesn't exist yet, and we don't want to spawn empty drafts on every "New" click. Autosave applies to **editing an existing record**.

---

## 3. Design challenges & decisions

### 3.1 Drafts vs. live records — *when is a change safe to persist?*
- **Invoices are already drafts** until you Send, so autosaving a draft invoice is safe. **A sent/paid invoice must NOT be silently editable** — autosave only applies while `status === 'draft'` (sent invoices become read-only or require an explicit "edit anyway").
- For clients/projects/contracts there's no draft concept — edits are live immediately. That's fine (it's what Save does today, just automatic).

### 3.2 Validation — *don't persist garbage*
- Only persist a field once it **passes its Zod validation**. Invalid field → show inline error, **skip** the save for that field, keep the last valid value server-side.
- Required-but-empty (e.g. invoice number cleared) → don't write empty; show error, hold.
- **Decision:** field-level (or section-level) save gated on validity, not all-or-nothing form save.

### 3.3 Debounce & granularity
- Text inputs: **debounce ~600–800ms** after last keystroke (reuse `useDebouncedValue`).
- Selects/toggles/dates: save **immediately** on change (discrete choices, no typing).
- Line-items array: save the **whole line_items set** on any row change (we already have `replaceLineItems`), debounced.
- **Decision:** debounce text, immediate for discrete controls.

### 3.4 Save-status UX
- A small **"Saving… / Saved ✓ / Couldn't save — retry"** indicator in the editor header (replaces the Save button).
- On error: keep the user's input in the field, show the indicator in an error state with a Retry, toast on hard failure.
- **Decision:** one shared `<SaveStatus>` indicator component + a header slot.

### 3.5 Errors / network drops
- Failed save → **retain local value**, mark dirty, auto-retry on next change or via Retry button. Never silently drop.
- **Decision:** optimistic local state is the source of truth for the field until a save confirms.

### 3.6 Optimistic updates + TanStack Query cache
- On successful field save, update the query cache so other views (lists, preview) reflect it without a full refetch.
- Be careful with the **invoice preview** (right pane) — it reads from form state already, so it stays live; the list cache needs `setQueryData`/invalidate.
- **Decision:** optimistic `setQueryData` on save success; invalidate list queries lazily.

### 3.7 Irreversible / outward-facing actions stay explicit
These **never** autosave and remain deliberate button actions:
- **Send invoice** (emails the client) ✋
- **Generate invoice from time/expenses** ✋
- **Mark paid**, **Void**, **Delete** ✋
- **File uploads** (receipts, logo) ✋ (explicit pick/upload)

### 3.8 Concurrency / races
- Debounced saves can overlap. Use a **last-write-wins per field** with an in-flight guard (ignore stale responses), or a single serialized save queue per record.
- **Decision:** serialize saves per record (a tiny mutation queue) to avoid out-of-order writes.

---

## 4. Proposed approach (implementation sketch)

1. **`useAutosave(record, { save, debounceMs })` hook** wrapping react-hook-form:
   - Subscribes to `watch()`, validates changed fields, debounces, calls `save(patch)`, tracks `status: idle|saving|saved|error`.
   - Serializes writes; applies optimistic cache updates.
2. **`<SaveStatus status={…} onRetry/>`** indicator component.
3. **Pilot on `InvoiceEditor`** (richest case): remove the Save button, wire header fields + line-items through autosave, gate on `status==='draft'`. Validate against real live data using a `ZZ-` draft.
4. **Roll out** to client/project/contract/recurring/expense/profile forms once the pattern proves out.
5. **Read-only mode** for non-draft invoices (sent/paid) with an explicit "Edit" affordance if we want to allow post-send edits at all (open question 5.3).

**Phasing:** pilot (invoice editor) → review with you → fan out to the simple forms → profile/uploads last.

---

## 5. Open questions for you

1. **Pilot first?** OK to build autosave on the **invoice editor only**, get your sign-off on the feel, then roll out — rather than converting all forms at once?
2. **Save indicator placement/wording** — "Saved ✓" in the header is my default. Want a timestamp ("Saved 2s ago")?
3. **Sent/paid invoices** — should they be **read-only** after sending (recommended), or editable with a warning? Today the editor lets you edit anything.
4. **Modals** (client/project/contract forms open in modals) — autosave-on-type inside a modal, or keep modals explicit-save and only autosave full-page editors? (Modals have a natural "Done/Close" affordance; autosave there is less obviously a win.)
5. **Creation** — confirm we keep "New X" as an explicit step (the `NewInvoiceModal` pattern) rather than auto-creating empty drafts.

---

## 6. Recommendation

Build a reusable `useAutosave` + `<SaveStatus>`, **pilot on the invoice editor**, keep all destructive/outward actions and record creation explicit, gate invoice autosave on `draft` status, and roll out to the simpler forms after your review. Modals (Q4) I'd lean toward **keeping explicit-save** initially — they already have a clear Done button — and focus autosave on the full-page editors where the Save button is the friction.
