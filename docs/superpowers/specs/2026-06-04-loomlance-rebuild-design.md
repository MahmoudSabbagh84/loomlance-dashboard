# LoomLance Dashboard — Rebuild Design Spec

**Date:** 2026-06-04
**Owner:** Mahmoud Sabbagh
**Status:** Draft, awaiting review
**Sibling project:** Loomlance Splash (separate codebase, owns signup + Stripe Checkout for subscriptions)

---

## 1. Overview

LoomLance is a SaaS dashboard for tech freelancers covering accounting and project management in one tool: clients, projects with kanban, contracts, invoicing (PDF + email + online payment), time tracking, expenses, and reports. The product is sold via three subscription tiers (Free / Tier 1 / Tier 2) handled by the sibling **Loomlance Splash** project.

This Dashboard codebase owns only the post-login experience. Established users sign in here; signup, pricing comparison, and Stripe subscription Checkout live in Splash. Both projects point at the same Supabase project so auth and subscription state are shared.

The existing prototype (commit `dc40cdd`) is a single-user React+localStorage demo with multiple bugs, dead buttons, a missing kanban feature, and no real data model. This spec describes a phased greenfield rebuild in the same repo: `src/` is replaced; the package.json base (React + Vite + Tailwind + lucide + date-fns) is kept and extended.

### 1.1 Goals

- Make every page that exists today actually work — close the bug/dead-button gaps documented in the project audit
- Add the missing kanban board as a first-class feature, with proper Projects as a distinct entity
- Turn invoicing from a list-of-amounts into a real billing system (line items, multi-currency, manual tax, sequential numbers, PDF, email, pay-online)
- Build a real multi-tenant backend on Supabase with server-enforced subscription tier gating
- Ship the foundation usable at the end of Phase 1, then layer features over 3 more phases

### 1.2 Non-goals (explicitly out of scope)

- Signup, pricing page, plan comparison, and the Stripe subscription Checkout flow — these live in the Splash project
- Multi-user / team collaboration on projects (single-freelancer product; no assignees, no comments, no mentions)
- Subtasks, swimlanes, and multiple boards per project (one board per project is the model)
- Automated tax-rate lookups by jurisdiction (manual rates only in v1; could become a Tier 2 feature later)
- Visual regression testing, an internal admin console, mobile native apps, marketing content
- Hosting freelancer invoices on freelancer-custom domains (use `loomlance.com/i/:token` only)

### 1.3 Tier model (single source of truth: `src/lib/tier.js`)

| Capability | Free | Tier 1 | Tier 2 |
|---|---|---|---|
| Active projects on kanban | 1 | 5 | unlimited |
| Clients | unlimited | unlimited | unlimited |
| Invoices/month | unlimited | unlimited | unlimited |
| Multi-currency, manual tax | ✓ | ✓ | ✓ |
| PDF download, hosted invoice link, email send | ✓ | ✓ | ✓ |
| Stripe Connect pay-online | ✓ | ✓ | ✓ |
| Custom invoice branding (logo, accent, footer) | ✗ | ✓ | ✓ |
| Recurring invoices | ✗ | ✓ | ✓ |
| Time tracking | ✗ | ✓ | ✓ |
| Expenses | ✗ | ✗ | ✓ |
| Reports (Revenue / P&L / Aging / Time) | ✗ | ✗ | ✓ |

Archived projects don't count against the active-projects gate, so a Free user can keep a history of past work.

---

## 2. Data model

Supabase Postgres. Every table has `id uuid primary key default gen_random_uuid()`, `user_id uuid references auth.users(id) on delete cascade`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`. Soft delete via `deleted_at timestamptz` where useful. Row-Level Security on every table: read/write only where `user_id = auth.uid()`.

### 2.1 Tables

| Table | Purpose | Key fields beyond audit columns |
|---|---|---|
| `profiles` | One row per auth user. App-level user data. | `display_name`, `business_name`, `default_currency`, `tax_id`, `address`, `logo_url`, `invoice_accent_color`, `invoice_footer`, `stripe_connect_account_id`, `subscription_tier` (enum `free`/`tier_1`/`tier_2`), `subscription_status`, `timezone` |
| `clients` | Companies / people billed. | `name`, `company`, `email`, `phone`, `address`, `notes`, `tags text[]`, `archived_at` |
| `client_contacts` | Multiple contacts per client (B2B). | `client_id`, `name`, `email`, `phone`, `role`, `is_primary boolean` |
| `projects` | Tier-gated unit of work. | `client_id`, `name`, `description`, `status` (`active`/`paused`/`archived`), `color`, `archived_at` |
| `kanban_columns` | Per-project columns. | `project_id`, `name`, `position int`, `wip_limit int` |
| `tasks` | Kanban cards. | `project_id`, `column_id`, `title`, `description`, `position float`, `due_date`, `priority` (`low`/`medium`/`high`), `labels jsonb` (array of `{name: string, color: string}` objects) |
| `contracts` | Agreements. | `client_id`, `project_id` (nullable), `title`, `start_date`, `end_date`, `value`, `currency`, `status`, `description`, `pdf_storage_path` |
| `invoices` | Invoice headers. | `client_id`, `project_id` (nullable), `invoice_number text` (sequential per user, e.g. `INV-0042`), `issue_date`, `due_date`, `currency`, `status` (`draft`/`sent`/`viewed`/`paid`/`overdue`/`void`), `notes`, `terms`, `public_token text` (unguessable), `sent_at`, `viewed_at`, `paid_at`, `pdf_storage_path` |
| `invoice_line_items` | Detail rows. | `invoice_id`, `position int`, `description`, `quantity numeric`, `unit_price numeric`, `tax_rate numeric`, `discount_rate numeric` |
| `invoice_payments` | Payment history (manual + Stripe). | `invoice_id`, `amount`, `currency`, `paid_at`, `method` (`stripe`/`bank`/`cash`/`other`), `stripe_payment_intent_id`, `notes` |
| `expenses` *(Tier 2)* | Receipts & costs. | `project_id`/`client_id` (nullable), `date`, `amount`, `currency`, `category`, `description`, `receipt_storage_path` |
| `time_entries` *(Tier 1+)* | Tracked time. | `project_id`, `task_id` (nullable), `started_at`, `ended_at`, `duration_minutes int`, `description`, `billable boolean`, `hourly_rate numeric`, `invoiced_on_invoice_id` (nullable) |
| `recurring_invoice_templates` *(Tier 1+)* | Template + cadence. | `client_id`, `project_id`, `cadence` (`monthly`/`quarterly`/`yearly`/`weekly`), `next_run_at`, `line_items jsonb`, `currency`, `auto_send boolean`, `active boolean` |
| `invoice_number_sequences` | Internal: per-user gap-free sequence. | `user_id` (PK), `last_number int` |
| `user_notifications` | Bell feed events. | `kind`, `payload jsonb`, `read_at`, `link_to` |
| `usage_events` | Analytics, especially upgrade-prompt clicks. | `kind`, `payload jsonb` |
| `error_logs` | Captured client errors. | `message`, `stack`, `context jsonb` |

### 2.2 Key design choices

- Everything that referenced clients by string in the prototype now references `clients.id`. Renaming a client never breaks historical invoices/contracts.
- `projects` is the central pivot and the only entity that counts toward the tier limit.
- `subscription_tier` lives on `profiles`. It is **never written by the Dashboard**; Splash's Stripe webhook is the sole writer.
- Invoice numbers are gap-free per user via a Postgres function `next_invoice_number(p_user_id uuid)` that locks the user's row in `invoice_number_sequences`, increments, and returns the new value. Required for many tax jurisdictions.
- `public_token` is a 32-char random string used in `/i/:token` hosted invoice URLs. Indexed for fast lookup. Cannot enumerate other invoices.
- Multi-currency is per-invoice (`invoices.currency`). Dashboard aggregates always group by currency — no implicit FX conversion.
- `time_entries.invoiced_on_invoice_id` lets the "Generate invoice from time" flow mark entries as billed so they aren't double-billed.

### 2.3 Server-side gate enforcement

- **RLS on every table**, scoped by `auth.uid()`. Frontend bypass is impossible: the DB returns nothing.
- **Trigger `enforce_project_limit()`** on `BEFORE INSERT ON projects` and on `BEFORE UPDATE OF status` (when un-archiving). Reads `profiles.subscription_tier` for the inserting user, counts non-archived projects, raises exception with code `PROJECT_LIMIT_EXCEEDED` if over.
- **Edge Function gates** for feature-level access (e.g. `generate_recurring_invoice` and the time-tracking + expenses + reports endpoints all check `subscription_tier` and return 403 for users below the required tier). Branding fields are stripped server-side when the PDF is rendered for a Free-tier user, regardless of what `profile.logo_url` contains.
- **Webhook from Splash → Dashboard's Supabase**: Splash's Stripe webhook writes `profiles.subscription_tier` and `profiles.subscription_status`. Dashboard reads these via the `useProfile()` hook; cache invalidates on focus + every 60s so a freshly-upgraded user sees unlocks within ~60s without a refresh.

---

## 3. Architecture & stack

### 3.1 Frontend folder structure

```
src/
├── app/                    Router, providers, global shell
│   ├── App.jsx, main.jsx
│   ├── routes.jsx          All route definitions
│   └── providers.jsx       QueryClient, SupabaseProvider, ThemeProvider, ToastProvider
├── lib/
│   ├── supabase.js         Supabase client; throws on missing env vars
│   ├── queryClient.js      TanStack Query defaults
│   ├── currency.js, date.js, money.js   Pure helpers
│   ├── tier.js             Single source of truth for tier limits + feature matrix
│   └── errors.js           Error code → user-friendly message table
├── api/                    ONE file per entity. Pure functions over Supabase. Only files that import supabase.
│   ├── auth.js
│   ├── clients.js, projects.js, tasks.js, kanban-columns.js
│   ├── contracts.js, invoices.js, invoice-line-items.js, invoice-payments.js
│   ├── expenses.js, time-entries.js, recurring-templates.js
│   ├── notifications.js, usage-events.js
│   └── schemas/            Zod schemas shared with edge functions
├── hooks/                  TanStack Query wrappers. The only place api/ is called.
├── features/               Domain UI. Each owns its components, modals, forms, table cells.
│   ├── clients/, projects/, kanban/, contracts/, invoices/, dashboard/,
│   ├── time/, expenses/, reports/, profile/, billing-portal/
├── components/             Design system + reusable UI. No domain logic.
│   ├── ui/                 Button, Input, Modal, Drawer, Toast, Table, EmptyState, ConfirmDialog, ...
│   ├── layout/             AppShell, Sidebar, Topbar, NotificationBell
│   └── gates/              TierGate, UpgradeCard, UpgradeDialog
├── pages/                  Thin route components. Compose features/.
└── styles/
    ├── tokens.css          CSS custom properties for all theme colors
    └── tailwind.css        @tailwind directives + custom utilities
```

**Route categories** (defined in `app/routes.jsx`):
- **Public**: `/login`, `/forgot-password`, `/reset-password`, `/i/:public_token` (hosted invoice page)
- **Protected**: everything else, wrapped in an `<AuthGate/>` that redirects to `/login` if no session

### 3.2 Layering rules (enforced by lint or convention)

- `api/` is the **only** place that imports `@/lib/supabase`.
- `hooks/` is the **only** place that imports from `api/`.
- `components/`, `features/`, and `pages/` use **only** `hooks/` for data access.
- `lib/` has no React imports — pure functions only, fully testable in isolation.

This makes the data layer mockable for tests, gives one obvious change-site for query renames, and keeps Supabase out of UI files.

### 3.3 Removed from the existing repo

- `src/styles/theme.js` and its `themeClasses` / `combineThemeClasses` helpers — replaced by CSS custom properties on `:root` and `[data-theme="dark"]`, consumed via Tailwind utilities like `bg-[var(--color-bg)]` and standard semantic classes.
- All `window.alert` and `window.confirm` usage — replaced by `sonner` toasts and `<ConfirmDialog/>`.
- The localStorage-based `DataContext` reducer — replaced by TanStack Query against Supabase.
- Hardcoded sample data injection — Phase 1 ships an empty database; the onboarding card guides users through creating their first records.

### 3.4 Key dependencies

| Library | Purpose |
|---|---|
| `@supabase/supabase-js` | Backend client |
| `@tanstack/react-query` | Server state cache + optimistic updates + retries |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Forms + validation shared with API layer |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Kanban drag-and-drop (accessible) |
| `@react-pdf/renderer` | Invoice PDF generation, used identically client-side and in Edge Functions |
| `recharts` | Dashboard + report charts |
| `sonner` | Toast notifications |
| `clsx` + `tailwind-merge` | Class composition |
| `date-fns` | Kept from existing repo |
| `lucide-react` | Kept from existing repo |
| `react-router-dom` | Kept from existing repo |
| **Backend / infra:** | |
| Supabase (Postgres + Auth + Storage + Edge Functions + `pg_cron`) | Backend |
| Resend | Transactional email (invoice send) |
| Stripe Connect Express | Freelancer receives invoice payments from their clients |
| **Dev / test:** | |
| Vitest, @testing-library/react | Unit + component tests |
| Playwright | End-to-end happy paths |
| `supabase test db` | SQL tests for RLS + triggers |

### 3.5 Tier-gate UX component

```jsx
<TierGate
  feature="recurring_invoices"     // looked up in lib/tier.js feature matrix
  variant="action"                 // "nav" | "action" | "inline"
  fallback={<UpgradeCard ... />}   // optional override
>
  {children}
</TierGate>
```

Three variants:

1. **`nav`** — Locked sidebar items show a 🔒 icon + muted color. Click opens `<UpgradeDialog/>` with feature description + tier comparison + "See plans" link to Splash.
2. **`action`** — A button (e.g. "New Project" at the project limit) stays clickable, but click opens an inline `<UpgradeCard/>` explaining the exact action being blocked.
3. **`inline`** — A section renders but controls are disabled with a "Tier 1 feature" pill + "Learn more" link.

Server still enforces. The frontend gate is UX; the Postgres trigger or Edge Function rejection is the security boundary. If the two disagree (e.g. webhook lag), backend wins — the server's success response triggers a `profile` cache invalidation that unlocks UI without a manual refresh.

---

## 4. Page-by-page overview

### 4.1 Navigation

Sidebar (collapsible): Dashboard, Projects, Clients, Contracts, Invoices, Time *(Tier 1+)*, Expenses *(Tier 2)*, Reports *(Tier 2)*. Tier-locked items render with a lock icon — click → `<UpgradeDialog/>`.

Topbar: global search (Cmd+K), notifications bell, theme toggle, account menu (Profile / Subscription / Logout).

### 4.2 Pages

- **`/login`** — Email + password (Supabase Auth). "Forgot password" via Supabase reset email. "Don't have an account?" links to Splash signup. No signup form here.
- **`/`** (Dashboard) — Stats row + revenue chart + due-soon + top clients + recent activity. Onboarding checklist for brand-new users. See §6.
- **`/projects`** — Card grid; one card per project (client name, # open tasks, last activity, accent color). Filter by client + status + search. "New Project" button (tier-gated).
- **`/projects/:id`** — Kanban board for the project. See §5.
- **`/clients`** — Sortable/searchable table (name, company, # active projects, total billed, last invoice). Click row → detail.
- **`/clients/:id`** — Header + tabs: **Overview** (stats + notes + tags), **Contacts** (multiple), **Projects**, **Contracts**, **Invoices** (with totals + aging), **Activity** (timeline of state changes).
- **`/contracts`** — Sortable/filterable table (title, client, project, value, status, dates). FK-correct client refs, search, filters, pagination, currency-grouped totals.
- **`/contracts/:id`** — Editable detail + PDF upload slot (Supabase Storage) for signed scans + linked-invoices section.
- **`/invoices`** — Table view + kanban-style status view toggle (Draft / Sent / Paid / Overdue). Filters: client, project, status, date range, currency. Per-row quick actions: Edit, Send, Copy link, Mark paid, Download PDF, Duplicate, Void.
- **`/invoices/:id`** — Invoice editor (line items, tax, totals) with live PDF preview pane. See §7.
- **`/i/:public_token`** *(public, no auth)* — Hosted invoice page client opens from email. Renders the PDF inline, "Pay Now" button if Stripe Connect is set up, "Download PDF" button. Logs `viewed_at` on first open.
- **`/time`** *(Tier 1+)* — Timer button + list of entries with edit. Filter by project + date range. "Generate invoice from unbilled time" action.
- **`/expenses`** *(Tier 2)* — Table with category, receipt thumbnail (Supabase Storage), filter by project + date range + category. Totals by category.
- **`/reports`** *(Tier 2)* — Tabs: **Revenue** (by month / client / project), **P&L** (revenue − expenses), **Aging** (invoices by days outstanding), **Time** (billable vs non-billable by project). All filterable by date range. CSV export.
- **`/profile`** — Tabs: **Account**, **Business**, **Invoice branding** *(Tier 1+)*, **Payments** (Stripe Connect), **Subscription** (read-only display + "Manage" link → Splash billing portal), **Data** (Export all to JSON, Delete account).

### 4.3 Every list page has

- A designed empty state (illustration + one-sentence "what is this" + primary CTA)
- Search + filter + sort + pagination (server-side via Supabase query params)
- A mobile-card view at small screen widths (no horizontal table scroll on phones)

---

## 5. Kanban design

### 5.1 Board model

One board per Project. Columns are per-project so different workflows are possible. Defaults on project create: `To Do`, `In Progress`, `Review`, `Done`. User can rename/reorder/add/delete columns and set an optional WIP limit per column.

### 5.2 Card (task) shape

- Title (required)
- Description (plain textarea in v1; rich text deferred)
- Due date (optional)
- Priority (`low`/`medium`/`high`)
- Labels — free-form tags stored as `[{name, color}]` array; used for filtering
- Position (float; periodic renumber to avoid float drift)
- *(Tier 1+)* Linked time entries — card shows total tracked hours and a "Start timer" button

### 5.3 Interactions

- **Drag-drop** via `@dnd-kit` — between columns (mutates `column_id`) and within columns (mutates `position`). Optimistic update via TanStack Query; rollback on server error.
- **Inline add** — "+ Add task" at column bottom opens an inline title input. Enter saves; no modal for the fast path.
- **Detail edit** — clicking a card opens a right-side **drawer** (not a centered modal) so the board stays visible. Esc closes. Focus trapped while open.
- **Quick filters** — by label, priority, due-soon, hide-done.
- **Search** — Cmd+F focuses a filter input that hides non-matching cards in place.
- **Bulk move** — shift-click cards to multi-select, then drag to a column.
- **Clear Done** — archives all cards in "Done" (soft delete) to keep the board clean without losing history.

### 5.4 Mobile / tablet

Columns horizontally scroll with CSS scroll-snap. Drag-on-touch is fragile, so tapping a card also offers a "Move to…" action sheet as a reliable fallback.

### 5.5 Tier-gate UX at the project limit

- Free user (1 project) clicks "New Project" → modal opens with the create form **disabled**, replaced by an `<UpgradeCard/>`: "You're on Free (1 project). Upgrade to Tier 1 for 5 projects, or Tier 2 for unlimited." Buttons: "See plans" (→ Splash) and "Maybe later".
- Same UX on attempted un-archive over the limit.
- Server-side: the Postgres trigger raises `PROJECT_LIMIT_EXCEEDED`; the API hook translates the error code into the same upgrade modal so tampering doesn't sneak past.
- Archived projects don't count.

### 5.6 Explicit non-scope (kanban v1)

Subtasks, checklists on cards, assignees, comments, mentions, multiple boards per project, swimlanes, card attachments. The description field + label filtering + Tier 2 expenses cover the realistic single-freelancer use cases.

---

## 6. Dashboard

### 6.1 Widget layout (top to bottom, responsive to single column on mobile)

1. **Greeting strip** — "Good morning, {name}" + today's date.
2. **Stats row (4 KPI cards):**
   - **Revenue this month** — sum of `invoice_payments.amount` where `paid_at` in current calendar month, grouped by currency.
   - **Outstanding** — sum of `invoices` with status `sent`/`viewed`/`overdue`, grouped by currency.
   - **Overdue** — count + total amount; red accent if > 0.
   - **Active projects** — count out of tier limit (e.g. "4 / 5"). Tier 2 shows count only.
3. **Revenue chart** — 12-month bar chart of paid invoices grouped by month, with currency selector if multi-currency. Hover for breakdown by client. Recharts.
4. **Due-soon panel (left, 2/3 width)** — next 5 things needing attention: invoices due ≤7 days, contracts ending ≤30 days, tasks due ≤3 days. Click-through to item.
5. **Top clients by revenue (right, 1/3 width)** — last 90 days. Horizontal bar list.
6. **Recent activity (full width)** — chronological feed of state changes (paid invoices, project status moves, contracts ending). Last 10 events.

### 6.2 First-login onboarding

Instead of zero-state widgets, brand-new users see an onboarding card with 4 checkboxes:

- [ ] Add your first client
- [ ] Create your first project
- [ ] Build a kanban board
- [ ] Send your first invoice

Each item links to the relevant page; the card disappears when all four are checked. Driven by simple existence queries — no separate onboarding state table.

---

## 7. Invoice system

### 7.1 Editor (`/invoices/:id`)

- **Header fields:** client (searchable dropdown of `clients`; auto-fills address + email + currency from client default), project (optional, scoped to selected client), issue date, due date, currency, invoice number (auto-suggested via `next_invoice_number()`, editable).
- **Line items table** (add/remove rows, drag to reorder): description, quantity, unit price, tax rate %, discount %. Per-line total auto-calculated.
- **Totals panel (sticky):** subtotal, total discounts, total tax (grouped by rate so the PDF shows "VAT 20%: €100, VAT 5%: €10"), grand total. All in the invoice's currency.
- **Footer:** notes (visible on invoice), terms (e.g. "Net 30; 1.5% late fee"), payment instructions text.
- **Live PDF preview pane** on the right — the same `<InvoicePDF/>` component used for download. Updates as the user types. Toggle to hide on small screens.

### 7.2 Numbering

`INV-0001`, `INV-0002`, … — sequential per user via Postgres function `next_invoice_number(p_user_id uuid)` reading `invoice_number_sequences`. Gap-free for tax purposes. User can override on a specific invoice; the next auto-suggest still increments from the highest stored.

### 7.3 State machine

```
draft ──> sent ──> viewed ──> paid
   └──> void           │
        ▲              ↓
        └────── overdue (auto via daily cron when due_date < today AND status IN ('sent','viewed'))
```

- `paid` is set by (a) manual "Mark paid" (creates a `manual` `invoice_payments` row) or (b) Stripe webhook (creates a `stripe` row).
- `void` replaces `delete` for sent invoices to preserve the gap-free sequence.

### 7.4 PDF

`@react-pdf/renderer` defines one `<InvoicePDF/>` component used three places:

1. Live preview in the editor
2. "Download PDF" button — generates and streams the file from the browser
3. Edge Function regenerates server-side on email send and on hosted-page open, so the PDF always reflects current data

Branding (logo, accent color, footer) is applied **only if `profile.subscription_tier !== 'free'`**; otherwise default LoomLance branding. This check runs server-side too — the Free user cannot bypass branding by tampering with the client.

### 7.5 Hosted invoice page (`/i/:public_token`, public)

Renders the PDF inline. "Pay Now" button shown only if the freelancer has a connected Stripe account. "Download PDF" button. Marks `viewed_at` server-side on first open (idempotent: subsequent views don't overwrite). Freelancer sees a "viewed" event in their notification bell.

### 7.6 Email send (Resend)

- "Send Invoice" button on the editor opens a confirmation modal: editable recipient (defaults to client email + any `client_contacts.is_primary` rows), subject (templated), body (templated), checkbox to attach PDF (default on).
- On confirm: Edge Function `send_invoice` calls Resend with the PDF attached + hosted link in the body, writes `sent_at`, flips status `draft → sent`.
- From address: `invoices@send.loomlance.com`. (Tier 2 "send from your own domain" deferred.)

### 7.7 Stripe Connect (freelancer receives money from clients)

- In `/profile → Payments`, freelancer clicks "Connect Stripe" → Stripe Connect Express onboarding → callback writes `profile.stripe_connect_account_id`.
- Hosted invoice "Pay Now" → server creates a Stripe Checkout session on the freelancer's connected account using `on_behalf_of`. Application fee = 0 (LoomLance does not take a cut).
- Webhook handler for `checkout.session.completed`: find invoice by `metadata.invoice_id`, insert `invoice_payments` row with method `stripe`, set `invoices.paid_at = now()`, status → `paid`. Idempotent on Stripe event id.
- `payment_failed`/`charge.dispute.created` → notification; status stays `sent`.

### 7.8 Recurring invoices (Tier 1+)

`recurring_invoice_templates` table holds template + cadence + next-run date. A daily `pg_cron` job calls an Edge Function that:

1. Finds templates with `active = true AND next_run_at <= now()`.
2. Generates an invoice from the template's `line_items` jsonb.
3. Increments `next_run_at` by cadence.
4. If `auto_send = true`, calls `send_invoice` immediately; otherwise leaves the invoice in `draft`.

### 7.9 Multi-currency

Per-invoice currency. Dashboard / report aggregates **always group by currency** — no implicit FX conversion (rates move, conversion is misleading for accounting). If a user has invoices in EUR and USD, dashboard shows two rows in the relevant cards.

---

## 8. Error handling, notifications, testing

### 8.1 Errors

- **Global error boundary** at root → friendly fallback page ("Something broke. We've logged it.") + reload button. Errors logged to `error_logs` and a Sentry hook stub for later.
- **Network errors** handled by TanStack Query: 3x retry with exponential backoff on GETs, 0 retries on mutations. Mutation failures bubble to a toast.
- **Specific server error codes** (`PROJECT_LIMIT_EXCEEDED`, `INVOICE_NUMBER_TAKEN`, `STRIPE_NOT_CONNECTED`, etc.) mapped to user-friendly messages via `src/lib/errors.js`.
- **Form validation** via Zod schemas shared client/server. Inline field errors, not toasts.
- **Optimistic updates** only for ordering-style mutations (kanban drag, task position). Mutations that move money (mark paid, void invoice) wait for server confirmation.

### 8.2 Notifications

- **Toasts (`sonner`)** — transient: success / info / error. Replaces every `window.alert/confirm`.
- **`<ConfirmDialog/>`** — destructive actions (delete, void, "Mark all paid"). No more silent bulk operations.
- **Notification bell (topbar)** — persistent feed in `user_notifications`. Sources: invoice viewed by client, invoice paid, invoice now overdue, task due tomorrow, contract ending in N days, Stripe Connect setup incomplete.

### 8.3 Background jobs

`pg_cron` running daily at 06:00 in each user's timezone (or 06:00 UTC for v1, refined later):

- Mark sent/viewed invoices as `overdue` when past due date
- Generate recurring invoices from due templates
- Insert "due soon" / "overdue" notifications

### 8.4 Testing matrix

| Layer | What's tested | How |
|---|---|---|
| Pure helpers (`lib/`, `api/schemas/`) | Currency math, date helpers, Zod schemas, tier limits | Vitest. Highest coverage here. |
| `api/` functions | Each Supabase call returns shape hooks expect; error mapping | Vitest with mocked Supabase client |
| Hooks | Cache behavior, optimistic rollbacks | `@testing-library/react-hooks`. Light coverage. |
| Components | Invoice editor totals, kanban drag-to-column, tier-gate variants | `@testing-library/react`. Behavior tests, not snapshots. |
| Database | RLS policies, tier-limit trigger, invoice number sequence, hosted-page token lookup | `supabase test db` against local Supabase. **Non-negotiable** — security boundary. |
| End-to-end | Login → create-client-project-invoice-send → hosted-page-pay (Stripe test mode) | Playwright. ~6-10 scenarios. CI on main + PRs. |

Visual regression and PDF visual output are checked manually.

---

## 9. Phase plan

Each phase ends in a usable, deployable build.

### 9.1 Phase 1 — Foundation (~2 weeks)

A logged-in user can manage clients, run kanban boards on projects, write basic invoices and contracts. Tier gates enforced. No PDF, email, or Stripe Connect yet.

- New `src/` skeleton (`app/`, `api/`, `hooks/`, `features/`, `components/`, `lib/`)
- Supabase project + all tables + RLS + tier-limit trigger + invoice number sequence
- Auth: login screen, password reset, "no account?" link to Splash
- App shell: sidebar, topbar (notifications bell as read-only), theme toggle (CSS vars, no FOUC)
- Design system primitives: `Button`, `Input`, `Modal`, `Drawer`, `Toast`, `ConfirmDialog`, `EmptyState`, `Table`, `TierGate`, `UpgradeCard`, `UpgradeDialog`
- **Clients**: list (search/sort/pagination) + detail with tabs + multiple contacts + tags
- **Projects**: card grid, create/archive, tier-gate on create
- **Kanban**: per-project board with `dnd-kit`, default + custom columns, inline add task, drawer for task edit, filters
- **Invoices (basic)**: list + status switcher, editor with line items + multi-currency + manual tax + live HTML preview (no PDF yet), state machine, sequential numbering
- **Contracts**: list + detail + CRUD + PDF upload to Supabase Storage
- **Dashboard**: stats row + due-soon panel + recent activity (revenue chart deferred)
- **Profile**: account, business, subscription tab (read-only)
- **Tests**: Vitest on helpers + schemas; SQL tests on RLS + tier triggers; one Playwright happy-path
- **Deploy**: Vite build → Vercel; Supabase already hosted

### 9.2 Phase 2 — Polish & PDF (~1 week)

Invoices look professional. Lists feel fast. Dashboard is informative.

- `@react-pdf/renderer` `<InvoicePDF/>` used in: editor preview, Download PDF, server-side Edge Function regeneration
- Invoice list view toggle: table ↔ kanban-by-status
- Search/filter/sort/pagination on Contracts + Invoices (Clients already done in Phase 1)
- Dashboard revenue chart (Recharts), top clients widget, multi-currency grouping
- Designed empty states with illustrations on every list page
- Notification bell starts surfacing real events
- Background jobs: daily overdue marker, daily due-soon notifier
- Onboarding card on first-login dashboard
- Global search (Cmd+K) — minimal: clients, projects, invoices by title/number
- Mobile pass: tables → cards on small screens, kanban horizontal scroll w/ snap, modal/drawer sizing

### 9.3 Phase 3 — Send & Pay (~2 weeks)

Invoices leave LoomLance. Money comes back. End-to-end loop closed.

- Resend integration + Edge Function `send_invoice` + Send modal with editable recipients/subject/body templates
- Hosted invoice page (`/i/:public_token`) — public route, PDF inline + Download + Pay + viewed-tracker
- Stripe Connect Express onboarding in `/profile → Payments`
- Pay Now → Stripe Checkout on freelancer's connected account; webhook handler creates `invoice_payments` row + flips status `paid`
- "Mark Paid (manual)" modal with method/notes/date
- Notifications: invoice viewed, invoice paid, payment failed
- Tests: Playwright scenario covering full Splash-signup → Dashboard-login → create-send-pay; webhook idempotency test

### 9.4 Phase 4 — Tier 1 + Tier 2 features (~2-3 weeks)

Paid tiers feel meaningfully different from free.

**Tier 1 unlocks:**
- **Invoice branding**: `/profile → Branding` tab — logo upload, accent color picker, footer text; PDF + hosted page honor these only for tier_1+
- **Recurring invoices**: `recurring_invoice_templates` UI; daily Edge Function generates due ones; auto-send option; `/invoices/recurring`
- **Time tracking**: `/time` + topbar timer; manual + timer entries; "Generate invoice from unbilled time" creates an invoice with line items from grouped entries

**Tier 2 unlocks:**
- **Expenses**: `/expenses` with category, receipt upload, filters, totals
- **Reports**: `/reports` with Revenue / P&L / Aging / Time tabs; CSV export

**Refinements:**
- Notification preferences (which events ping the bell)
- Data export (`/profile → Data` → JSON download of everything)
- Account deletion (irreversible, confirmed)
- Analytics events firing on upgrade-prompt clicks (`usage_events` table)

---

## 10. Open questions / decisions deferred

- **Splash schema lock-in**: the `profiles.subscription_tier` enum values (`free`/`tier_1`/`tier_2`) and the columns Splash's Stripe webhook writes must match exactly between projects. To be confirmed when Splash work begins.
- **Email "from" domain**: defaulting to `invoices@send.loomlance.com`. Per-user custom-domain sending is deferred (would need per-user SPF/DKIM via Resend).
- **Timezone handling for cron**: Phase 1/2 use 06:00 UTC for overdue/due-soon jobs. Per-user timezone is desirable but not blocking.
- **Hosted page payment for non-Stripe-Connect freelancers**: out of scope. Freelancers without Stripe Connect just have a "Download PDF" hosted page; they handle payment off-platform.
- **Currency conversion in reports**: deliberately not built. A future Tier 2 enhancement could let users pin a reporting currency and use a fixed rate they enter — but Phase 4 ships without it.
- **Onboarding for users created in Splash before this Dashboard ships**: assumed Splash has not launched yet and the two projects ship together. If not, a backfill of `profiles` rows for existing auth users may be needed.
