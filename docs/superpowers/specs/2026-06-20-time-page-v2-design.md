# Time Page v2 — Design (DRAFT — brainstorming IN PROGRESS)

> **STATUS: DRAFT / NOT FINISHED.** Brainstorming was paused mid-session on 2026-06-20 (machine switch). Decisions below are LOCKED (user-approved). Remaining sections still need to be brainstormed before this becomes a final spec. **Do not start implementation.** Resume by re-entering `superpowers:brainstorming`, confirming the locked decisions, finishing the open sections, then writing the final spec + invoking `superpowers:writing-plans`.

**Origin:** QA findings **F2** (entries don't show client/contract) and **F3** (generate-invoice lists ALL clients) in `docs/qa-findings.md`. User asked to brainstorm a clearer Time page rather than patch ad-hoc.

## Locked decisions (user-approved)
1. **Structure:** a **"Ready to bill" panel** at the top of `/time` + the existing entries **ledger** below it (with new columns/filters). (Not: group-the-list, not minimal-fixes.)
2. **Contract link:** add a **real entry→contract link** — a new optional `contract_id` on `time_entries`, with a contract picker in the timer popover and the manual/edit form (scoped to the entry's project/client).
3. **Billing model:** **bill per contract** (the billing unit is a contract), not per client.
4. **Untagged time:** time NOT tagged to a contract is handled as a **per-client "No contract" bucket** that bills per client (today's behavior). Nothing is unbillable.

## Section 1 — Goal & Scope (APPROVED)
**Goal:** Make the Time page show *whose* work each entry is, and turn billing into an obvious one-click action per contract — replacing the "pick a client from all clients" modal.

**In scope:**
- Entry→contract link: optional `time_entries.contract_id` + contract picker (timer popover + manual/edit form, scoped to the entry's project/client).
- Ledger: add **Client** and **Contract** columns; add **Client** and **Contract** filters (keep Project).
- **"Ready to bill" panel:** one row per **contract with unbilled, billable, completed time** (contract · client · hours · amount · Generate invoice) PLUS one row per **client with untagged unbilled time** (`{Client} · No contract` · hours · amount · Generate invoice). Only groups with billable unbilled time appear.
- Billing = per contract, per-client fallback for untagged time:
  - Contract row → new RPC bills that contract's unbilled time.
  - "No contract" row → existing per-client RPC, now scoped to untagged (`contract_id is null`) entries only.
- **Remove** the old pick-a-client "Generate invoice" modal — generation happens inline from the panel (with a confirm/preview). This makes F3 moot.

**Out of scope:** changing expenses/recurring billing; multi-currency mixing; reassigning already-billed time; contract creation (uses existing contracts).

## OPEN sections still to brainstorm (resume here)
- **Section 2 — Data model:** exact `time_entries.contract_id` definition (FK `contracts(id)` ON DELETE SET NULL, nullable; index); how the contract picker filters options (contracts where `contract.project_id = entry.project_id` OR `contract.client_id = project's client_id`); whether timer popover contract is optional/secondary (lean: optional, fast-start keeps just project).
- **Section 3 — Billing logic / RPCs:** new `generate_invoice_from_time_for_contract(p_contract_id)` (SECURITY DEFINER, scoped to auth.uid(); invoice client = contract's client_id, project = contract's project_id, currency = profile default; group line items by project+rate via existing `groupTimeForInvoice` logic; stamp entries billed; raise NO_UNBILLED_TIME when empty). Modify existing `generate_invoice_from_time(p_client_id)` to only consider `contract_id is null` entries (so contract billing + no-contract billing don't double-count). Confirm the "Ready to bill" aggregation query (group unbilled billable completed entries by contract_id, plus by client where contract_id is null).
- **Section 4 — UI/components:** `/time` layout (panel + toolbar filters + ledger); `TimeEntriesTable` new Client/Contract columns; new `ReadyToBillPanel` component; contract picker in `TimerWidget` + `TimeEntryFormModal`; inline generate (confirm/preview) replacing `GenerateInvoiceModal`; hooks/api changes (`time-entries.js` SELECT add `contract_id, contracts(title)`; start/manual/update accept contractId; new `generateInvoiceFromTimeForContract`).
- **Section 5 — Testing:** unit (ready-to-bill grouping helper; line-item grouping unchanged) + live MCP verification (tag entries to a contract, generate per-contract invoice, verify untagged per-client path, NO_UNBILLED_TIME, RLS) with ZZ- markers + cleanup.

## Relevant existing code (for the resumer)
- `src/pages/TimePage.jsx` — current page (project+status filters, default-rate, Log time + Generate invoice buttons, table, total).
- `src/features/time/TimeEntriesTable.jsx` — Date/Project/Description/Duration/Rate/Status/actions.
- `src/features/time/GenerateInvoiceModal.jsx` — the modal to remove (lists all clients via `useClients`).
- `src/features/time/TimeEntryFormModal.jsx`, `TimerWidget.jsx` — entry inputs (add contract picker).
- `src/api/time-entries.js` — SELECT already joins `projects(name, client_id, clients(name))`; add `contract_id, contracts(title)`. Has `startTimer/createManualEntry/updateEntry/generateInvoiceFromTime`.
- `src/lib/time.js` — `groupTimeForInvoice` (group by project+rate), `formatDuration`, `hoursFromMinutes`.
- DB: `time_entries` (migration `20260619014123_time_tracking.sql`, RPC `generate_invoice_from_time`); `contracts` table has `client_id`, `project_id` (nullable), `title`, `status`.
