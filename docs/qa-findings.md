# QA Findings — LoomLance Dashboard

> Running log captured during a live QA session on the tier-2 test user. Each finding is logged verbatim as reported, with triage notes added by Claude. **Fixes are planned/applied AFTER QA is marked done**, not mid-session.
>
> Session started: 2026-06-19 · Status: **capturing** (say "QA done" to switch to triage + fix planning)

## Severity legend
- **P0** — broken/blocking (crash, data loss, feature unusable)
- **P1** — significant bug or wrong behavior
- **P2** — minor bug / polish / UX nit
- **P3** — idea / nice-to-have / question

## Findings

<!-- Newest appended at the bottom. Format:
### F<N> — <short title>  [severity TBD]
- **Where:** <page / feature / URL>
- **Reported:** "<your words, verbatim>"
- **Repro / notes:** <steps or context>
- **Triage:** <likely cause, file:line if identifiable, or "needs investigation">
-->

### F1 — Downloaded invoice PDF: "INVOICE" title runs into the invoice number  [P2]
- **Where:** Invoice detail → Download PDF (the generated `.pdf` file). On-site preview and the public `/i/:token` link render correctly.
- **Reported:** "the pdf invoice, the preview on the site and link look fine, but after download, when you open the downloaded one, the big word 'INVOICE' at the top is connected to the invoice number, example 'INV-0035' there isn't a breaker between them when downloaded"
- **Repro / notes:** Open any invoice → Download PDF → open the file. The large "INVOICE" heading and the number below it touch with no vertical gap. Preview looks fine because it's a different render path.
- **Triage:** `src/features/invoices/InvoicePDF.jsx:75-76` — two stacked `<Text>` nodes: `INVOICE` (style `invoiceTitle`, fontSize 20, inherits page `lineHeight: 1.4`) and the number with only `marginTop: 3`. The HTML preview (`InvoicePreview.jsx`) is a separate code path, which is why preview/public page look fine — so the fix is PDF-only. Likely cause: the title's inherited `lineHeight 1.4` + a too-small 3pt gap collapse visually in the real react-pdf renderer. Candidate fix: give `invoiceTitle` an explicit tighter `lineHeight` and/or bump the number's `marginTop` (e.g. 4–6) — verify via `npm run preview` (react-pdf only renders correctly in a prod build, NOT the dev server).

### F2 — Time page: entries don't show which client (or contract) they belong to  [P1]
- **Where:** `/time` → entries table.
- **Reported:** "we need to also add a column that shows the client and/or contract the times listed belong to, so that when the user presses generate invoice, it's much more easier to navigate"
- **Repro / notes:** `TimeEntriesTable` currently shows Date, Project, Description, Duration, Rate, Status — no client. The user has to know which client a project belongs to.
- **Triage:** `src/features/time/TimeEntriesTable.jsx` + `src/api/time-entries.js` SELECT already joins `projects(name, client_id, clients(name))`, so client name is available with no query change — just add a column. **Contract** is fuzzier: time entries link to project (→ client), not to a contract; a project can have 0..n contracts, so "contract" needs a design decision (see brainstorm). Being taken into the brainstorming redesign below.

### F3 — Generate-invoice (from time) lists ALL clients, not just those with tracked time  [P1]
- **Where:** `/time` → Generate invoice modal → client dropdown.
- **Reported:** "the customer list under generate invoice lists ALL the clients … it's best if it shows the clients that have time tracked for their work"
- **Repro / notes:** `GenerateInvoiceModal` populates the select from `useClients()` (all clients) and only filters the preview after a client is picked. Clients with no unbilled billable time still appear and yield an empty preview.
- **Triage:** `src/features/time/GenerateInvoiceModal.jsx` — derive the client option list from the unbilled billable `time_entries` (their `projects.client_id`) instead of all clients. Being taken into the brainstorming redesign below.

> **Note:** Per user request, F2 + F3 (and a broader "make the Time page more intuitive" goal) are being addressed by a **Time page v2 redesign**. Brainstorming is IN PROGRESS but **paused mid-session (2026-06-20, machine switch)** — locked decisions + open sections captured in `docs/superpowers/specs/2026-06-20-time-page-v2-design.md` (DRAFT). Resume there via `superpowers:brainstorming` before any build.

## Triage summary
_(populated when QA is marked done)_
