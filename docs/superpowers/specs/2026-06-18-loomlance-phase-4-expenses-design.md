# LoomLance Phase 4 — Expenses Design

**Status:** Approved 2026-06-18
**Phase 4 sub-project 3 of 5** (branding ✅ → time tracking ✅ → **expenses** → recurring → reports). Each sub-project gets its own spec → plan → build cycle.

## 1. Goal

Let Tier 2 freelancers record business expenses (with an optional receipt), categorize them, and push **billable** (reimbursable) expenses onto a client's draft invoice — mirroring the time-tracking generate-invoice flow.

## 2. Scope

### In scope
- `expenses` table (Tier 2), each expense optionally tied to a project and/or client.
- An `/expenses` page: filterable list (project/client, category, date range, billed/unbilled), add/edit/delete, totals (overall + by category).
- Receipt upload to a **private** Supabase Storage bucket (`receipts`), with signed-URL thumbnails/links. Receipt is optional.
- **Categories:** a preset dropdown (Software, Hardware, Travel, Meals, Subscriptions, Office, Contractors, Fees, Other) plus a free-text custom value.
- **Generate invoice from billable expenses** (per client): each unbilled billable expense → one draft-invoice line, atomically via an RPC, stamping the expense billed.
- Tier gating: `/expenses` route requires `FEATURES.EXPENSES` (tier_2). The feature flag already exists in `src/lib/tier.js`.

### Out of scope (later/never)
- Markup % on reimbursable expenses.
- Multi-currency conversion (per-expense currency is stored, but no FX math — see §4).
- Recurring expenses, mileage/per-diem, OCR receipt parsing, approvals.
- Reports on expenses / P&L (that is the Reports sub-project, which will *read* `expenses`).

## 3. Data model (one migration)

```
expenses
  id uuid pk
  user_id uuid not null                 -- RLS scope
  project_id uuid                       -- FK projects(id) on delete set null (nullable)
  client_id  uuid                       -- FK clients(id)  on delete set null (nullable)
  spent_on date not null                -- the expense date
  amount numeric(10,2) not null check (amount >= 0)
  currency text not null                -- defaults to profiles.default_currency on insert (app-side)
  category text not null                -- preset or custom value (trimmed)
  description text
  receipt_path text                     -- path within the `receipts` bucket; nullable
  billable boolean not null default false
  invoiced_on_invoice_id uuid           -- FK invoices(id) on delete set null; NULL ⇒ unbilled
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

- **Indexes:** `(user_id, spent_on desc)`, `(project_id)`, `(client_id)`.
- **RLS:** 4 policies (select/insert/update/delete), all `user_id = auth.uid()`. `set_updated_at` trigger (BEFORE UPDATE).
- **No new `profiles` column.** Currency defaults from `profiles.default_currency` at insert time (set by the API/form), not a DB default.

**FK choices (deliberately different from `time_entries`):** `project_id` and `client_id` are both `ON DELETE SET NULL` — deleting a project or client must **not** erase the expense ledger, because expenses are accounting records kept for P&L (unlike time entries, which cascade with their project). `invoiced_on_invoice_id` is `ON DELETE SET NULL` (voiding/deleting the generated invoice frees the expense to be billed again).

**Client resolution for billing:** an expense bills under a client if its `client_id` is set to that client, **or** its `project_id` belongs to a project whose `client_id` is that client. The generate-invoice RPC resolves both paths.

### 3.1 Storage — `receipts` bucket (private)

- New **private** bucket `receipts` (financial documents — unlike the public `branding-logos` bucket).
- Canonical own-folder RLS, path prefixed by user id (`{user_id}/{timestamp}-{filename}`):
  - `for insert to authenticated with check ((storage.foldername(name))[1] = (select auth.uid()::text))`
  - `for select to authenticated using (...)` and `for delete to authenticated using (...)` with the same predicate.
- Because the bucket is private, the UI fetches **signed URLs** on demand to show thumbnails / open receipts.
- **Upload gotcha (carried forward from branding):** use a plain `.upload(path, file, { contentType })` with a **unique timestamped path — NO `upsert: true`** (upsert triggers an existence-check SELECT that RLS denies → 400). Delete via the Storage API `.remove([paths])`, never a direct `delete from storage.objects` (blocked by the `protect_delete` trigger).

## 4. Currency handling

- Each expense stores its own `currency` (defaulted to `profiles.default_currency` in the form, editable) so a foreign-currency cost is recorded accurately for the ledger.
- **Invoice generation bills only matching currency:** the RPC includes only unbilled billable expenses whose `currency = profiles.default_currency` (the invoice currency). Non-matching expenses stay unbilled and are excluded from the preview. No FX conversion is performed.

## 5. Components

### 5.1 API + hooks (`src/api/expenses.js`, `src/hooks/useExpenses.js`)
- `listExpenses({ projectId, clientId, category, from, to, status })` — `status ∈ all|unbilled|billed`; joins `projects(name, client_id)` and `clients(name)`.
- `createExpense(payload)`, `updateExpense(id, patch)`, `deleteExpense(id)`.
- `uploadReceipt(file)` → validates then uploads, returns `receipt_path` (plain upload, unique timestamped path, no upsert).
- `removeReceipt(path)` → Storage API `.remove([path])`.
- `getReceiptUrl(path)` → a signed URL (short TTL) for thumbnail/open.
- `generateInvoiceFromExpenses(clientId)` → calls the RPC (§6).
- `validateReceiptFile(file)` (in `src/lib/expenses.js` or `src/api/expenses.js`) — PDF/PNG/JPG/WebP, ≤5MB; unit-tested.
- Hooks wrap each with TanStack Query and invalidate the expenses list on mutation.

### 5.2 `/expenses` page (`src/pages/ExpensesPage.jsx` + `src/features/expenses/*`)
- Tier-gated: if not `hasFeature(tier, FEATURES.EXPENSES)` → `<UpgradeCard feature={FEATURES.EXPENSES} target="tier_2" />` (page guard + sidebar lock = defense in depth).
- Header: **Add expense** button (`ExpenseFormModal`) and **Generate invoice** button (`GenerateExpenseInvoiceModal`).
- Toolbar filters: project, client, category, date range, billed/unbilled toggle.
- `ExpensesTable`: date, category, description, project/client, amount, billable, receipt (thumbnail or 📎 → opens signed URL), billed badge; row actions edit/delete. Footer shows the filtered **total** and **totals by category**.
- `ExpenseFormModal`: project (optional), client (optional), date, amount, currency (default from profile), category (preset combobox + custom text), description, billable toggle, optional receipt upload/remove with preview.
- `GenerateExpenseInvoiceModal`: a **client** select (only clients with unbilled billable, matching-currency expenses) → preview of the one-line-per-expense list (description, amount) → **Generate** → RPC → navigate to `/invoices/:id`.

### 5.3 Routing / nav
- New protected route `/expenses` (alongside the others, under `AuthGate`/`AppShell`). The Sidebar already lists **Expenses** as a Tier-2-locked item (free/tier_1 → `UpgradeDialog`). The page also guards itself.

## 6. Invoice generation (atomic RPC)

`generate_invoice_from_expenses(p_client_id uuid) returns uuid` — `SECURITY DEFINER`, `set search_path = public`, scoped to `auth.uid()`:
1. `v_user = auth.uid()`; if null → raise `UNAUTHORIZED`.
2. `v_currency = profiles.default_currency` for `v_user`.
3. Select the caller's `expenses` where `billable` and `invoiced_on_invoice_id is null` and `currency = v_currency`, and the expense resolves to `p_client_id` (`client_id = p_client_id` **OR** `project_id` belongs to a project with `client_id = p_client_id and user_id = v_user`). If none → raise `NO_BILLABLE_EXPENSES`.
4. `next_invoice_number(v_user)` → number; insert a `draft` invoice (`user_id`, `client_id = p_client_id`, `currency = v_currency`, issue_date today, due_date +30).
5. Insert one `invoice_line_items` row per expense: `description = coalesce(nullif(trim(description), ''), category)`, `quantity = 1`, `unit_price = amount`, `tax_rate = 0`, `discount_rate = 0`, `position` ordered by `spent_on`.
6. `update expenses set invoiced_on_invoice_id = <new id>` for the selected expenses.
7. Return the new invoice id.

Atomic (single function) so an expense is never stamped without an invoice and vice-versa. New error code `NO_BILLABLE_EXPENSES` → "No billable expenses for this client." added to `lib/errors.js`.

## 7. Error handling
- `generate_invoice_from_expenses` with no eligible expenses → `NO_BILLABLE_EXPENSES` toast.
- Receipt upload validation failure → friendly toast (type/size).
- Standard `mapPostgresError` / toast elsewhere.

## 8. Testing
- **Unit:** `validateReceiptFile` (type/size accept & reject), and an expense→line-items mapping helper in `src/lib/expenses.js` (one line per expense; `description` fallback to category; totals overall and totals-by-category).
- **Live (tier-2 test user, self-cleaning markers):** add an expense with a receipt → it appears with a thumbnail (signed URL opens); add a billable expense tied to a client (or to a project under that client) → **Generate invoice** → draft invoice opens with one line per expense → expense now shows "billed" and drops from unbilled; a foreign-currency billable expense is excluded from the preview. Then delete the seeded expenses, the generated invoice, and the uploaded receipt objects (Storage API `.remove`).

## 9. Decisions made during brainstorming
- **Billable + invoiceable** (full scope), mirroring time tracking: a `billable` flag + `invoiced_on_invoice_id`, with an atomic per-client RPC.
- **Categories: preset list + free-text custom** (stored as trimmed text).
- **One line per expense, no markup** when generating an invoice (transparent pass-through).
- **Per-expense `currency` stored; RPC bills only matching currency** (no FX conversion).
- **Receipts in a private bucket** with signed-URL access; upload optional.
- **`project_id`/`client_id` ON DELETE SET NULL** (preserve the expense ledger) — intentionally unlike `time_entries`' cascade.
