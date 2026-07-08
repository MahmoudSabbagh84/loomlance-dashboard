# Scope-Creep Change Requests (Design)

**Status:** Approved 2026-07-08 · **Repo:** LoomLance-Dashboard · **Splash promise:** "scope-creep change requests" (drop the "(soon)" marker on ship)

## Summary

The differentiating dev-freelancer feature: when work exceeds the original contract scope, the freelancer raises a structured **change request** (title, description, added price, optional hours×rate, optional added days) on a project. They share a hosted **`/cr/:token`** page; the client **approves or declines** it there. An approved request becomes billable with one click — **"Bill this change"** spins up a draft invoice pre-filled with the change as a line item. Mirrors the existing public-invoice pattern end-to-end, so it inherits the token/RLS/notification conventions.

Validated as the highest-value next feature by both the owner's product judgment and an external technical audit ("moat = depth in the dev workflow, not another integration").

## Decisions (brainstorming, 2026-07-08)

- **Approval → one-click "Bill this change"** (approved record stays; freelancer clicks to create a draft invoice) — over auto-invoice or budget-bump-only. Freelancer keeps timing control; reuses invoicing.
- **Cost = amount + optional hours×rate** (hours×rate auto-computes amount; amount is the billed source of truth). Not full multi-line-item.
- **Attaches to a project** (universal container), with an optional `contract_id` link ("the original scope"). Not contract-only.
- **v1 sharing = the hosted public link** (copy/share), no new email-send function — email can layer on later like invoices.
- **No tier-gating in v1** (ships to everyone; monetization gating is a separate pricing decision).

## Data model

New enum + table (RLS owner-only, same as invoices):

```sql
create type change_request_status as enum ('draft', 'sent', 'approved', 'declined');

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,   -- "the original scope"
  client_id uuid references public.clients(id) on delete set null,       -- derived from project
  title text not null,
  description text not null default '',
  currency text not null,
  amount numeric not null default 0,          -- the billable price (source of truth)
  hours numeric,                              -- optional; when hours+rate set, UI computes amount
  hourly_rate numeric,                        -- optional
  added_days integer,                         -- optional timeline impact (informational, not billed)
  status change_request_status not null default 'draft',
  public_token text unique,                   -- issued on first send (like invoices)
  link_expires_at timestamptz,                -- optional, mirrors invoices
  sent_at timestamptz,
  decided_at timestamptz,
  approver_name text,                         -- typed on approval (lightweight signature)
  decline_reason text,
  billed_invoice_id uuid references public.invoices(id) on delete set null,  -- set by "Bill this change"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- RLS: `select/insert/update/delete` all `using (auth.uid() = user_id)` (owner-only) — identical to invoices; anon never touches the table directly.
- `updated_at` via the shared `set_updated_at()` trigger.
- Index on `public_token`.

## Backend — public RPCs (SECURITY DEFINER, mirror the invoice pattern)

- `get_public_change_request(p_token text) returns jsonb` — joins `change_requests` × `profiles` (business_name, logo, accent, footer) × `clients` (name/company). Returns ONLY display fields + status + an `already_decided` flag. Null on missing/expired/regenerated token. Read-only (no view-stamp needed; a `sent_at` already exists). `set search_path = public`, EXECUTE granted to `anon`+`authenticated` (it's the public read path — same as `get_public_invoice`).
- `respond_to_change_request(p_token text, p_decision text, p_approver_name text, p_reason text) returns jsonb` — the public write:
  - Loads the row by token; null → `{ error: 'not_found' }`.
  - **Idempotent/guarded:** acts only if `status = 'sent'`. If already `approved`/`declined`, returns `{ status, already: true }` (like `mock_pay_invoice`).
  - `p_decision = 'approve'` → status `approved`, stamp `decided_at = now()`, `approver_name`; `'decline'` → status `declined`, stamp `decided_at`, `decline_reason`.
  - Inserts ONE `user_notifications` row for the owner: `kind = 'change_request_approved' | 'change_request_declined'`, `payload {title, ...}`, `link_to = '/projects/' || project_id`.
  - `security definer`, `set search_path = public`, EXECUTE to `anon`+`authenticated`.
- `regenerate_change_request_link(p_change_request_id uuid)` — rotates `public_token` (owner-only, mirrors `regenerate_invoice_link`).
- `send_change_request(p_change_request_id uuid)` — owner-only RPC that atomically stamps `status='sent', sent_at=now()` and issues `public_token = replace(gen_random_uuid()::text, '-', '')` if not already set (server-side token generation; returns the token). This is the single "Send" mechanism.

## Freelancer UI (Dashboard)

- **Project detail page** gains a **"Change requests"** section: list with status `Badge` (Draft/Sent/Approved/Declined + "Billed" when `billed_invoice_id` set), amount (formatted via `formatCurrency`), `added_days`, newest first. Empty state.
- **Create** ("New change request", kit `Modal`): title, description, currency (default from project/client), amount, optional hours + hourly_rate (auto-compute `amount = round2(hours × rate)` when both present), optional added_days. Saves `draft`.
- **Send / share:** a draft's "Send" flips it to `sent` (issues `public_token`), then reveals the **public link** with copy + **regenerate** controls (mirror the invoice link controls). No system email in v1.
- **Bill this change:** on an `approved` request, "Bill this change" calls `createInvoice({...})` — client_id, currency, `status:'draft'`, issue/due dates, `next_invoice_number`, one `line_items` entry `{ description: title, quantity: hours ?? 1, unit_price: hourly_rate ?? amount, tax_rate: 0, discount_rate: 0 }` — sets `billed_invoice_id`, navigates to the invoice editor. Disabled once `billed_invoice_id` is set (no double-billing).
- **Editing rules:** drafts fully editable; `sent` is locked (copy/regenerate link, or delete to withdraw); approved/declined are read-only.
- Hooks: `useChangeRequests(projectId)` / mutations, over `src/api/changeRequests.js` (+ `src/api/publicChangeRequest.js` for the public page). Impeccable pass on all UI.

## Public client page

- Route `/cr/:token` → `PublicChangeRequestPage`, styled like `PublicInvoicePage` (hosted, business-branded, no login). Shows the change (title, description), added cost (amount, or hours×rate broken out), added days if set, proposer's business name.
- **Approve** (typed name required) / **Decline** (optional reason) → `respond_to_change_request`. After a decision, shows the confirmation/decided state. Invalid/expired token → "this link is no longer valid."

## Testing

- **Unit (vitest):** amount derivation (`hours×rate → amount`; direct amount wins) and a pure `changeRequestDecision` guard (only `sent` decidable; already-decided → current state) in `src/lib/` — same pattern as the money/trial helpers.
- **Migration verification (hosted, `begin…rollback`):** create a ZZ draft CR; `get_public_change_request` returns curated JSON (no owner-only leakage); `respond_to_change_request` twice (2nd no-op, returns decided); one notification inserted; `decided_at`/`approver_name` stamped; anon cannot `select change_requests` directly. Roll back — zero residue.
- **Component (vitest):** create form (hours×rate auto-computes; validation), project section (badges, Bill-this-change disabled when billed), public page (renders change, Approve captures name, declined state).
- **E2E (read-only):** owner → project → Change-requests section renders. No client approve/decline in e2e (public write on live data); write paths covered by unit + component tests.

## Out of scope (v1)

Email delivery of requests, tier-gating, multi-line-item change requests, editing after send (delete-and-recreate), partial approval, auto-invoicing on approval, and contract-overage analytics (the `contract_id` link is captured for a Phase 2 that computes "% over original scope").
