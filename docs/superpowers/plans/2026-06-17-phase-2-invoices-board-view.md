# Invoices Board View Implementation Plan (Phase 2 · Milestone 4 — list polish)

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a table ↔ board view toggle to the Invoices page; the board groups invoices into columns by status (kanban-by-status), read-only with click-to-open.

**Architecture:** `<InvoicesBoard/>` takes the invoice rows and buckets them into fixed status columns. `InvoicesPage` gains a `view` state (`'table' | 'board'`) persisted in `localStorage`. In board mode it fetches all statuses at a higher page size (status pills + pagination hidden); table mode is unchanged. Read-only (no drag-to-change-status — status transitions have side effects like `sent_at`/payment capture, out of scope here).

**Tech Stack:** existing `useInvoices` (returns `{rows,total}` with `clients(name)`), `cn`, `lib/date`, lucide icons.

**Why these are already done (so NOT in scope):** Contracts + Invoices already have search, status filter, pagination, and empty states (verified in code). This milestone adds only the missing board view + toggle.

---

### Task 1: Board component

**Files:**
- Create: `src/features/invoices/InvoicesBoard.jsx`

- [ ] **Step 1:** Fixed `COLUMNS` = draft, sent, viewed, overdue, paid, void (each with a status-colored dot matching `InvoiceStatusBadge`). Bucket `invoices` by `status`. Render a horizontal, `overflow-x-auto` row of `w-64` columns; each has a header (dot + label + count) and a soft-bg track of cards. Card = `invoice_number` (bold, tabular), client name, "Due {formatDate(due_date)}"; `onClick={() => onOpen(inv.id)}`. Empty column shows a subtle "—".

---

### Task 2: View toggle + data wiring on InvoicesPage

**Files:**
- Modify: `src/pages/InvoicesPage.jsx`

- [ ] **Step 1:** `view` state initialized from `localStorage.getItem('invoices-view')` (default `'table'`); `setViewPersist` writes back (try/catch for private mode). `isBoard = view === 'board'`.
- [ ] **Step 2:** Query params by mode: `useInvoices({ search: debounced, status: isBoard ? undefined : (status||undefined), page: isBoard ? 0 : page, pageSize: isBoard ? 200 : 25 })`.
- [ ] **Step 3:** Toolbar row (`justify-between`): status pills on the left (hidden in board mode), and on the right a search `Input` + a 2-button segmented toggle (List / LayoutGrid icons, active = `bg-bg-muted text-fg`).
- [ ] **Step 4:** Body: loading skeleton unchanged; empty state unchanged; otherwise `isBoard ? <InvoicesBoard invoices={data.rows} onOpen={(id)=>navigate('/invoices/'+id)} /> : <Table.../> + <Pagination/>` (pagination only in table mode).

---

### Task 3: Verify and commit

- [ ] **Step 1:** Gate — `npm run build`, `eslint --max-warnings 0`, `vitest run` (28 pass).
- [ ] **Step 2:** Live-verify (dev :5173): seed 3–4 invoices across statuses (MCP); toggle to Board → columns show invoices bucketed by status with correct counts; click a card → opens that invoice; toggle persists across reload; toggle back to Table works. Clean up seeded invoices (own markers). 0 errors.
- [ ] **Step 3:** Commit (lint-gated): `feat(invoices): table/board view toggle (kanban-by-status)`.

---
```
