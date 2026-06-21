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

### F2 — Time page: entries don't show which client (or contract) they belong to  [P1] ✅ FIXED (Time v2)
- **Where:** `/time` → entries table.
- **Reported:** "we need to also add a column that shows the client and/or contract the times listed belong to, so that when the user presses generate invoice, it's much more easier to navigate"
- **Repro / notes:** `TimeEntriesTable` currently shows Date, Project, Description, Duration, Rate, Status — no client. The user has to know which client a project belongs to.
- **Triage:** `src/features/time/TimeEntriesTable.jsx` + `src/api/time-entries.js` SELECT already joins `projects(name, client_id, clients(name))`, so client name is available with no query change — just add a column. **Contract** is fuzzier: time entries link to project (→ client), not to a contract; a project can have 0..n contracts, so "contract" needs a design decision (see brainstorm). Being taken into the brainstorming redesign below.

### F3 — Generate-invoice (from time) lists ALL clients, not just those with tracked time  [P1] ✅ FIXED (Time v2)
- **Where:** `/time` → Generate invoice modal → client dropdown.
- **Reported:** "the customer list under generate invoice lists ALL the clients … it's best if it shows the clients that have time tracked for their work"
- **Repro / notes:** `GenerateInvoiceModal` populates the select from `useClients()` (all clients) and only filters the preview after a client is picked. Clients with no unbilled billable time still appear and yield an empty preview.
- **Triage:** `src/features/time/GenerateInvoiceModal.jsx` — derive the client option list from the unbilled billable `time_entries` (their `projects.client_id`) instead of all clients. Being taken into the brainstorming redesign below.

> **✅ RESOLVED via Time v2 (2026-06-21).** F2 + F3 were addressed by the **Time page v2 redesign**: per-project "Ready to bill" panel (replaces the pick-a-client modal → F3), Client + Contract columns/filters on the ledger (→ F2), real `time_entries.contract_id` tagging, and contract `hourly_rate` rate pre-fill. Spec: `docs/superpowers/specs/2026-06-20-time-page-v2-design.md` (FINAL); plan: `docs/superpowers/plans/2026-06-21-time-page-v2.md`; built across commits 52bc781→3c1c7c4 + verified live via MCP. **F7** (topbar-timer visual rework) remains separate/open.

### F4 — Dashboard revenue bar chart: clicking/dragging shows a text-selection rectangle  [P2]
- **Where:** Dashboard (`/` → `DashboardInsights`) → Revenue bar chart.
- **Reported:** "on the dashboard, when pressing on the bar graph for the revenue bar chart, a selection rectangle highlights either the whole table or the range of bars available, let's eliminate that, and note to use brainstorming on this when we get to it, to see what features we can add when pressing on the revenue table"
- **Repro / notes:** Press (and drag) on the revenue chart → the browser draws a selection rectangle over the chart/card, highlighting the bars/SVG as selectable content. Looks like native text/element selection on the SVG, not a chart interaction.
- **Triage:** Two parts.
  - **(a) Eliminate the highlight [P2, trivial]:** `src/features/dashboard/RevenueChart.jsx` / `src/features/dashboard/DashboardInsights.jsx` — the Recharts SVG has no `user-select: none`, so click-drag triggers native selection. Fix = add `user-select-none` (Tailwind `select-none`) to the chart wrapper, and/or `[&_svg]:select-none` on the card. No Recharts API needed. Verify in browser at `http://localhost:5173/`.
  - **(b) Brainstorm click interactions [P3, deferred]:** the user wants a separate brainstorm on what *should* happen when you click the revenue chart (e.g. drill into that month's invoices/payments, filter, set date range). Do via `superpowers:brainstorming` when we reach it — out of scope for the quick (a) fix.

### F5 — Mobile sidebar drawer mispositioned: panel/backdrop trapped behind page, nav links float on top  [P1]
- **Where:** Smaller screens (below `lg`) → Topbar hamburger → open mobile nav drawer (`MobileNav`).
- **Reported:** "on a smaller screen, when opening the sidebar, the background of the sidebar slides behind the dashboard or page, but the pages to select on the sidebar display on top of the screen, we need to fix this visual bug by having the sidebar display properly when selected"
- **Repro / notes:** Shrink the window below the `lg` breakpoint → tap the hamburger. The drawer's solid panel + dark backdrop don't cover the viewport (they sit behind / are clipped to the topbar area), while the nav links still render above the page content — so the menu looks broken/detached.
- **Triage:** Confident root cause = CSS stacking/containing-block bug. `MobileNav` (`src/components/layout/MobileNav.jsx:36`) renders its overlay as `<div className="fixed inset-0 z-50 …">`, but it's mounted **inside** the Topbar `<header>` (`src/components/layout/Topbar.jsx:31,33`) which has `backdrop-blur`. Per spec, an ancestor with `backdrop-filter`/`filter`/`transform` becomes the **containing block for `position: fixed` descendants** — so `fixed inset-0` resolves relative to the 64px-tall header, not the viewport. The panel/backdrop get constrained to the header box while the `z-50` still lifts the links above page content. Fix options (pick at triage): (a) **render the drawer via a React portal to `document.body`** (cleanest — escapes the header stacking context); (b) move `<MobileNav />` out of the `backdrop-blur` header; or (c) drop `backdrop-blur` on the header. Verify in browser at `http://localhost:5173/` with the viewport below `lg`.

### F6 — No consistent back / breadcrumb navigation; users must re-select from the sidebar to go back  [P2]
- **Where:** App-wide; most visible on `/projects` and `/projects/:id` (`ProjectsPage` → `ProjectDetailPage`).
- **Reported:** "there is also a lack of navigation options, meaning, for example on the projects page, when you enter it, there is not option to return you to the previous page you were on, and further if you enter a project, there is not return option to the projects page, so the user has to select the project page again from the sidebar to navigate back, note we need the brainstorming superpower when working on this to cook up some navigation solutions to make the platform more intuitive"
- **Repro / notes:** Open a project from `/projects` → land on `/projects/:id` → there's no on-page "back to Projects" affordance; the only way back is the sidebar. Same gap on other detail/sub-pages — back navigation is ad-hoc, not systematic.
- **Triage:** This is a **UX/navigation design gap**, not a single-line bug — the user explicitly wants a **`superpowers:brainstorming`** session to design intuitive navigation before any build. Current state: no breadcrumb component exists; `ProjectDetailPage` (`src/pages/ProjectDetailPage.jsx:16`) only renders a "Back" link in its *error* state, not on the happy path; `RecurringInvoicesPage.jsx:67` has a one-off "← Invoices" link that could serve as a starting pattern. Brainstorm scope: a reusable breadcrumb and/or contextual back button, browser-history vs. parent-route back semantics, and where it lives in the page shell (`AppShell`/`Topbar` vs. per-page header). **Deferred to brainstorming — do not build mid-QA.**

### F7 — Topbar timer is just a clock icon; rework into an explicit timer + controls + tracking-state animation  [P3 · enhancement]
- **Where:** Topbar timer (`TimerWidget`), rendered in `Topbar` on every page.
- **Reported:** "the 'clock' symbol at the top of the page for time tracking, let's rework it, i was thinking that we have a timer that and a pause/play button next to it, and a dropdown of the projects to track time for, that way it's more clear what this part of the topbar is for, and add some animation to it to give it a visual indicator that the time is tracking or stopped tracking, like a red breathing dot or red/green outline of the time box"
- **Repro / notes:** Today the idle state is just a `Clock` icon (`src/features/time/TimerWidget.jsx:74-82`) — not obviously a timer; you must click it to reveal the project select + Start. Running state shows elapsed + a stop square (`:61-72`). No always-visible project dropdown, no play/pause, no tracking-state animation.
- **Triage:** Enhancement / redesign of `src/features/time/TimerWidget.jsx`. Desired shape: always-visible elapsed display + play/pause control + inline project dropdown + an animated tracking indicator (red breathing dot when running / red-or-green outline of the time box). Notes for the design pass: (1) **"pause" is a new concept** — the data model is start/stop only (`useStartTimer`/`useStopTimer`, single `started_at`); true pause/resume needs either segmented time entries or pause-as-stop-and-resume semantics — decide during design. (2) Animation should respect the existing token system (`--color-danger`/`--color-success`) and `prefers-reduced-motion`. (3) Keep tier gating (`hasFeature(tier, FEATURES.TIME_TRACKING)`) and the topbar height/space constraints. **Candidate for `superpowers:brainstorming`** — and overlaps with the **Time page v2** redesign, so consider folding it into that effort rather than designing the widget in isolation.

### F8 — Clients ("contacts") list: add per-row quick actions  [P3 · enhancement]
- **Where:** Clients list page (`/clients`, `src/pages/ClientsPage.jsx`). NOTE: user said "contacts page" — there is no separate Contacts page; the sidebar labels this route **"Clients"**. (Per-client *contacts* — `client_contacts` — live inside `ClientDetailPage`. Confirm at triage which surface the user means; read as the Clients list here.)
- **Reported:** "on the contacts page, we should add more quickactions on every contact"
- **Repro / notes:** Each row currently shows Name / Company / Email / Tags, and the only action is the name linking to `/clients/:id` (`src/pages/ClientsPage.jsx:70-85`). No inline actions per row.
- **Triage:** Enhancement to the Clients list rows. Add a quick-actions affordance per row — candidates: View, Edit (opens `ClientFormModal`), Email (mailto: `c.email`), New invoice / New project for that client, Delete. Likely an actions `<TD>` (icon buttons or a kebab/Dropdown menu) reusing `Button size="sm"` / existing modal components; confirm the exact action set with the user at triage. Lightweight enough to batch-fix, but the **action set is a small design decision** — worth a quick confirm (and check whether the user also wants the same on the per-client `client_contacts` table). Possible small overlap with **F6 navigation** (a "View" action vs. row-click).

### F9 — Client detail: "Contact" section (Overview) vs empty "Contacts" tab is confusing — rework or remove  [P3 · brainstorming]
- **Where:** Client detail (`/clients/:id`) tabs — Overview vs Contacts (`src/pages/ClientDetailPage.jsx:14-44`).
- **Reported:** "further on the contacts, inside every contact, there is an overview that shows contact and notes, that fine, but there is another tab called Contact, that is empty and gives the ability to add more contacts, that is a bit confusing, we need to rework it or remove it even, tag this for brainstorming superpower"
- **Repro / notes:** The **Overview** tab has a "Contact" section (the client's own email/phone) + Notes (`src/features/clients/tabs/OverviewTab.jsx:7-16`). A separate **Contacts** tab (`src/features/clients/tabs/ContactsTab.jsx`) lists `client_contacts` (additional people at that client, with Add / Delete / Set-primary) and is empty by default ("No contacts yet"). The naming collision ("Contact" heading vs "Contacts" tab) + the empty default state reads as redundant/confusing.
- **Triage:** **Tagged for `superpowers:brainstorming`** (user request) — do not build mid-QA. Core issue is conceptual overlap between the client record's own contact fields and the multi-contact `client_contacts` model. Brainstorm options to weigh: (a) **remove** the Contacts tab and surface `client_contacts` inside Overview (e.g. a "People" card under the existing Contact section); (b) **rename/reframe** the tab (e.g. "People" / "Team") and rename the Overview heading to disambiguate; (c) keep both but make empty-state guidance clearer. Watch the data dependency: `useSetPrimaryContact` / primary-contact logic and anywhere `client_contacts` is consumed (invoices/contracts recipients?) before removing the surface. Relates to **F8** (per-row quick actions) — same Clients area.

### F10 — Client detail → Activity tab is a stale stub: "Activity timeline appears here. (Phase 2.)"  [P2]
- **Where:** Client detail (`/clients/:id`) → Activity tab (`src/features/clients/tabs/ActivityTab.jsx`).
- **Reported:** "under activity under a singular contact, it says coming in Phase 2 … document clearly all the phases we have slated for work in the future … under phases.md … mark what's done and what is slated for the future"
- **Repro / notes:** The Activity tab renders only `Activity timeline appears here. (Phase 2.)` — a placeholder that was never built, and the label is now misleading since Phase 2 shipped long ago. `ActivityTab` takes no props and has no data wiring.
- **Triage:** Two outputs. (1) **Doc:** captured the full phase roadmap (past + future) in `docs/phases.md` (done as part of this finding). (2) **Code (deferred):** the Activity timeline is real future work — either build it (aggregate per-client events: invoices created/paid, contracts, time, expenses, notes) or, short-term, replace the misleading "(Phase 2.)" copy with an honest empty/"planned" state. Tracked as a future item in `phases.md`. Don't fix mid-QA.

### F11 — Contract Edit modal opens empty instead of pre-filled with the selected contract  [P1] ✅ FIXED
- **Where:** Contract detail (`/contracts/:id`) → Edit button → `ContractFormModal` (`src/features/contracts/ContractFormModal.jsx`).
- **Reported:** "when selecting a contract and pressing edit, the edit modal doesn't pre-populate with the information of the selected contract that we are viewing, it appears as if it's brand new and empty"
- **Repro / notes:** Open a contract → click Edit → fields (client, title, dates, value, etc.) appear blank as if creating a new contract. Risk: saving could wipe fields or feel like it creates a duplicate.
- **Triage:** ⚠️ **Not reproducible from static reading — needs live debugging (`systematic-debugging`).** The wiring *looks* correct: `ContractDetailPage.jsx:61` passes `contract={contract}` (and the page already renders `contract.title`, so the object is populated); `getContract` selects `*, clients(name), projects(name)` so all scalar columns are present (`src/api/contracts.js:17`); the modal is conditionally mounted (`{editOpen ? … }`) so it remounts fresh; and `useForm` `defaultValues` read every field from `contract?.…` (`ContractFormModal.jsx:23-36`). Given that, candidate causes to check live: (a) **RHF `defaultValues` capture timing** — confirm `contract` is defined at mount (it should be, behind the `isLoading`/`!contract` guard); (b) **date format** — `start_date`/`end_date` must be `yyyy-MM-dd` for `<input type="date">` (only explains blank *dates*, not all fields); (c) a **stale/duplicate modal instance** or a key/remount quirk; (d) verify the Edit button isn't opening a separate "new" modal. **Architectural note:** the form uses `defaultValues` (not RHF's `values` prop) — fragile if the modal is ever kept mounted; switching to `values={contract}` (or an explicit `reset(contract)` in an effect) would make pre-fill robust. Confirm the exact failure live before fixing.
- **Resolution (implemented 2026-06-20):** confirmed via code analysis that `Input`/`Select`/`Textarea` all `forwardRef`, so text fields + static selects (title, description, dates, value, currency, status) DO pre-fill. The empty appearance = the **Client/Project dropdowns** hitting the **same async-options race as F15**: options from `useClients`/`useProjects` load after mount, so the saved `client_id`/`project_id` had no matching `<option>` and the uncontrolled select rendered blank (with the required Client field blank, the form read as "brand new"). Fix = made both selects **controlled** (`value={watch(...)}` + `setValue`) in `ContractFormModal`.
  - **Spot-check (as requested) found the identical latent bug in 3 more edit modals — all fixed the same way:** `ProjectFormModal` (client), `ExpenseFormModal` (client + project), `RecurringTemplateFormModal` (client + project). Together with F15 (`InvoiceEditor`), **all editor client/project selects are now controlled.** Verified: lint clean · 68/68 tests · build OK.

### F12 — Expenses page needs a Time-v2-style redesign: show project/client, scoped generate-invoice, append-to-existing  [P1]
- **Where:** `/expenses` — `ExpensesTable` + `GenerateExpenseInvoiceModal` (`src/features/expenses/*`).
- **Reported:** "we need a similar re-design for the expenses page, it should show not just the project but the client name, as the column header should show projectname/client, and when pressing generate invoice, it should show only the available expenses and either create an invoice from scratch if none exists for the project or add to the current invoice existing on the project"
- **Repro / notes:** Mirrors the Time page issues (F2/F3). Three parts:
  - **(a) Column [P2]:** Header already reads "Project / Client" (`ExpensesTable.jsx:15`) but the cell shows only ONE: `e.projects?.name || e.clients?.name` (`:27`). User wants both, as "projectname / client".
  - **(b) Generate-invoice client list [P1]:** `GenerateExpenseInvoiceModal` populates the client `<Select>` from `useClients()` = ALL clients (`:17,50-54`), then filters lines after a client is picked. Should offer only clients/projects that actually have eligible (unbilled, billable, matching-currency) expenses — same defect as **F3**.
  - **(c) Append-to-existing invoice [P3 · brainstorming]:** Today generate ALWAYS creates a new draft via `generate_invoice_from_expenses(clientId)` (`:36`, per-**client** RPC). User wants: per **project**, create a new invoice if none exists, else **add the expenses to the project's existing invoice**. This is a new capability + a billing-granularity shift (client → project) — needs design.
- **Triage:**
  - **(a)** needs a query change: `src/api/expenses.js:6-7` SELECT joins `projects(name, client_id)` + `clients(name)`, so for project-linked expenses the **client name isn't fetched through the project** (only the id). Add nested `projects(name, client_id, clients(name))`, then render `project.name` + the client name (direct `clients.name` for client-only expenses) in `ExpensesTable.jsx:27`.
  - **(b)** derive the modal's option list from the eligible `expenses` (their `client_id` / `projects.client_id`), like the planned **F3** fix.
  - **(c)** ⚠️ **`superpowers:brainstorming`** — "append to existing invoice" doesn't exist yet for either expenses or time; needs an RPC/`buildExpenseInvoiceLines` extension + a rule for *which* existing invoice (draft only? status? per-project). **Strongly recommend folding this into the Time page v2 effort** so time + expenses share one consistent "ready-to-bill → new-or-append, per project/contract" model. → relates to **Phase 9** (Time v2); consider a paired **Expenses v2** under it.

### F13 — Reports page bar chart: clicking/dragging shows a text-selection rectangle (same as F4a)  [P2]
- **Where:** `/reports` → bar chart (`src/features/reports/ReportChart.jsx`).
- **Reported:** "on the reports page, the same thing as noted for the dashboard, when pressing on the bar chart i get selection rectangles highlighting the whole barchart or the range of bars available, let's make sure that's removed, it's visually frustrating"
- **Repro / notes:** Press/drag on the Reports chart → native text/element selection draws a rectangle over the chart/bars. Identical behavior to **F4a** on the dashboard revenue chart.
- **Triage:** Same root cause and fix as **F4a** — the Recharts SVG has no `user-select: none` (confirmed: no `select-none`/`user-select` anywhere in `src/features/reports`). Add Tailwind `select-none` to the chart wrapper in `src/features/reports/ReportChart.jsx` (and apply the same to `RevenueChart.jsx` for F4a). **Batch F4a + F13 together** as one "charts: disable text selection" fix — consider a shared chart wrapper so future charts inherit it. Verify in browser at `http://localhost:5173/`.

### F14 — Invoice line-item editor: number-input spinner arrows; make Tax/Discount columns toggleable  [P2] ✅ FIXED
- **Where:** Invoice editor line items (`src/features/invoices/LineItemsTable.jsx`; also used by recurring templates).
- **Reported:** "on the invoice where you edit it, the qty unit price, discount and tax have arrows that are eating from their allocated space, let's remove it, it should be a manual number entry only, and let's make them enable/disable, so they can be added/removed as needed"
- **Resolution (implemented 2026-06-20, post-QA, at user request):**
  - **Arrows:** added a `.no-spinner` utility (`src/styles/tailwind.css`, webkit + firefox) and applied it to all four numeric inputs — manual entry only, no spinners eating space.
  - **Toggleable columns:** per user decision = **Tax % and Discount % only** (Qty/Unit price always shown), toggled via **chips above the table**, **per-invoice**. Hiding a column **zeroes** its values via `setValue` so totals stay correct; columns default ON only if the existing invoice already uses them. Threaded `setValue`/`getValues` into `LineItemsTable` from both call sites (`InvoiceEditor`, `RecurringTemplateFormModal`).
  - Verified: lint clean · 68/68 tests · build OK. Live-check on dev server (:5173). Not committed (user commits/pushes manually).

### F15 — Invoice editor: selected Project (and Client) clears on refresh  [P1] ✅ FIXED
- **Where:** Invoice editor (`src/features/invoices/InvoiceEditor.jsx`) — Client / Project dropdowns.
- **Reported:** "when i select the project the invoice is related to, it needs to be persistent, right now on refresh the selection clears, i dont want that, i want that selection to stick until changed back to empty"
- **Root cause:** async-options race. The Client/Project `<Select>`s were **uncontrolled** (`register`); their `<option>`s load asynchronously (`useProjects`/`useClients`). On mount the saved `invoice.project_id` had no matching option yet, so the browser dropped the value and RHF never re-synced once options arrived. (Client usually looked fine because that query is often warm-cached from the Clients page; the per-client projects query isn't, so the race surfaced on Project.)
- **Resolution (implemented 2026-06-20):** made both selects **controlled** — `value={watch(...) ?? ''}` + `setValue(..., { shouldDirty, shouldValidate })` on change. React now re-applies the saved value as soon as options render, so the selection sticks across refresh until changed back to "—". Note: persistence still requires clicking **Save** (no auto-save). Verified: lint clean · 68/68 tests · build OK. Possible follow-up (not requested): same uncontrolled-select pattern may exist in other editors — spot-check if it recurs.

### F16 — Login often requires multiple attempts; page "refreshes" and clears the form  [P1] ✅ FIXED
- **Where:** `/login` (`src/pages/LoginPage.jsx`), auth-session plumbing (`src/hooks/useAuth.js`, `src/features/auth/AuthGate.jsx`).
- **Reported:** "when logging in … i have to login multiple times to successfully log in, i pressed login and the page refreshed and cleared the input fields for email and password, i did that a few times until it finally went through."
- **Root cause:** stale-cache race in auth state — NOT a native form refresh (`Card as="form"` correctly forwards `onSubmit`; RHF `handleSubmit` prevents default). `useSession` (which owns the `onAuthStateChange` subscription that writes `['session']`) is mounted only inside `AuthGate`, and `AuthGate` wraps the protected routes, **not** `/login`. Sequence: (1) opening the app/a protected URL mounts `AuthGate` once → `getSession()` → `['session']` cached as **`null` with `staleTime: 60_000`**; (2) on `/login` the subscription is inactive, so nothing updates that cache; (3) successful `signInWithPassword` then `navigate('/')` → `AuthGate` reads the still-fresh cached `null` → bounces back to `/login` (looks like a refresh, clears fields). It only "went through" once a stray async `onAuthStateChange` event happened to land in the cache.
- **Resolution (implemented 2026-06-20):** in `LoginPage.onSubmit`, seed the cache from the returned session before navigating — `queryClient.setQueryData(['session'], data.session)` — so `AuthGate` sees the user immediately and deterministically. Verified: lint clean · 68/68 tests · build OK. **Follow-up (optional, not done):** lift the `onAuthStateChange` subscription to app root (outside `AuthGate`) so session state is tracked on public routes too — would also cover sign-out/refresh edge cases; consider during a future auth hardening pass.

## Triage summary

> QA marked **done** 2026-06-20. 13 findings (F1–F13). Grouped by area, ranked by severity, split into three execution tracks. **No code changed yet — awaiting approval on the fix plan.**

### By severity
- **P1 (significant bug / wrong behavior):** F2, F3, F5, F11, F12b
- **P2 (minor bug / polish):** F1, F4a, F6, F10, F12a, F13
- **P3 (enhancement / idea):** F4b, F7, F8, F9, F12c

### By area
| Area | Findings | Notes |
|------|----------|-------|
| Charts | F4a, F13 (selection rect) · F4b (click interactions 🧪) | F4a+F13 share one fix |
| Invoices / PDF | F1 (title collision) | PDF-only render path |
| Navigation / Layout | F5 (mobile drawer P1) · F6 (back/breadcrumb 🧪) | F5 is a real positioning bug |
| Clients / Contacts | F8 (row actions) · F9 (contacts tab 🧪) · F10 (Activity stub) | F10 has a quick copy fix + future build |
| Contracts | F11 (edit modal empty P1) | needs live repro |
| Time | F2, F3 (client/contract + scoped list) · F7 (timer 🧪) | → Time v2 |
| Expenses | F12a/b (column + scoped list) · F12c (append-to-existing 🧪) | → Expenses v2 (paired w/ Time v2) |

### Execution tracks
**Track A — Quick fixes (batchable, well-understood, no design needed).** F1, F4a+F13, F5, F8, F10 (copy only), F12a, F12b. Each is a small, localized change; verify in-browser / via `npm run preview` (F1). Recommend doing these first as one reviewed batch.

> ✅ **Track A IMPLEMENTED 2026-06-20** (lint clean · 68/68 tests · build OK; not yet committed — user commits/pushes manually). Per-finding:
> - **F1** ✅ `InvoicePDF.jsx` — `invoiceTitle` `lineHeight: 1` + number `marginTop: 3→6`. **Visual check pending via `npm run preview`** (react-pdf doesn't render in dev).
> - **F4a + F13** ✅ wrapped `RevenueChart` + `ReportChart` in `<div className="select-none">`. Verify in browser.
> - **F5** ✅ `MobileNav` drawer now rendered via `createPortal(..., document.body)` — escapes the Topbar `backdrop-blur` containing block. Verify below `lg`.
> - **F8** ✅ Clients list rows: Edit (`ClientFormModal`), Email (mailto, when present), Delete (`ConfirmDialog` + `useDeleteClient`). Action set = minimal; New invoice/New project deferred.
> - **F10** ✅ Activity tab copy replaced with honest "planned" empty state.
> - **F12a** ✅ `expenses` SELECT now nests `projects(... clients(name))`; `ExpensesTable` cell shows "Project / Client".
> - **F12b** ✅ `GenerateExpenseInvoiceModal` derives the client list from eligible (unbilled/billable/matching-currency) expenses + empty state.

**Track B — Bug needing live debugging.** F11 (contract Edit modal opens empty). Static reading shows correct wiring, so reproduce live with `systematic-debugging` before fixing; likely fix = RHF `values={contract}`/`reset()` + date formatting. Spot-check the other Edit modals (clients/invoices/recurring/expenses) for the same `defaultValues` pattern.

**Track C — Design work (HARD GATE: brainstorm → spec → plan → build).** Maps to `phases.md`:
- **Phase 8 — Navigation & UX:** F6 (back/breadcrumb), F4b (chart click-through), F10 (real Activity timeline).
- **Phase 9 — Time v2 + Expenses v2:** F2, F3, F7, F12c (shared "ready-to-bill → new-or-append, per project/contract" model). Resume the paused draft spec `docs/superpowers/specs/2026-06-20-time-page-v2-design.md`.
- **Phase 10 — Client/contacts rework:** F9 (Contacts tab vs Overview), F8 (deeper version of row actions).
