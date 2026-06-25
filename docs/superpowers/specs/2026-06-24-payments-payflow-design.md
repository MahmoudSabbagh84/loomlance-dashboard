# Payments & Invoice Pay-Flow Rework — Design Spec

- **Date:** 2026-06-24
- **Status:** Approved in brainstorm → ready for implementation plan
- **Linear:** LOO-91 (+ invoice pay-flow)

## Summary

Replace the master "Accept online payments" toggle with a **per-provider, connected = offered** model, and redesign the hosted invoice pay page so the **client clearly picks** among whatever methods the freelancer offers. Cash/bank instructions are always available as the baseline.

## Decisions (from brainstorm)

1. **Drop the master toggle** (`profiles.online_payments_enabled`). A provider is offered purely by being connected: Stripe connected (`stripe_connect_account_id`) → card offered; `paypal_link` set → PayPal offered. Disconnect / clear = off. This removes the "greyed-but-clickable" bug **by construction**.
2. **No per-provider enable flag** — connect/disconnect *is* the switch (YAGNI).
3. **Cash/bank instructions always shown** on invoices (baseline).
4. **Pay page = explicit client choice:** a "Pay this invoice" card with the amount + one button per offered method; the client picks. No online method offered → show the payment instructions instead.
5. **Edge case verified at design time:** of 5 profiles, **0** were "online-off but provider-connected" → dropping the column surprises no one. No data migration beyond the column drop.

## Architecture / components

- **Migration:** drop `profiles.online_payments_enabled`.
- **`paymentMethods(issuer)`** — pure helper → ordered list of available online methods, e.g. `['card', 'paypal']` (empty when none). Inputs: `stripe_connect_account_id`, `paypal_link`. Unit-tested. Used by the pay page to decide what to render.
- **`PaymentsTab`** — remove the master toggle + `setOnline`; reframe as **"How clients can pay you"** with three always-live blocks: Payment instructions (existing autosave card), Stripe (connect/manage + badge), PayPal (link + honor-system note). Helper line: *"Clients always see your payment instructions. Connect Stripe or PayPal to also let them pay online — they choose how."*
- **`PublicInvoicePage`** — replace the two header buttons with a **"Pay this invoice"** card near the top: amount due + a button per `paymentMethods` entry (**Pay by card** / **Pay with PayPal**); when the list is empty, render the payment instructions prominently. "Download PDF" stays in the header. Keep the existing `paymentsAreReal` mock-vs-real branching and the paid-state banner. Built via Impeccable.
- **Public-invoice data source** — the `can_pay` / PayPal fields the page consumes must derive from connection state, **not** the dropped master flag. Locate the public-invoice RPC / `usePublicInvoice` source and update its derivation (confirm exact RPC name in the plan).

## Data flow

1. Freelancer connects Stripe and/or sets a PayPal link in `PaymentsTab` (no master toggle).
2. Invoice sent → public page loads issuer connection state → `paymentMethods(issuer)`.
3. Pay page renders the available method buttons; client picks one → existing Stripe Checkout (`stripe-checkout`) or PayPal link (or mock-pay in dev).
4. No methods → instructions shown; freelancer marks paid manually.

## Error handling / edge cases

- No online method + no instructions → the card shows a neutral "Contact the sender to arrange payment" line (don't render an empty card).
- `online_payments_enabled` removal: 0 affected accounts (verified). Drop is safe.
- PayPal stays honor-system (no auto-reconcile) — copy makes that clear on both ends (unchanged).

## Testing

- **Unit:** `paymentMethods(issuer)` — card only / paypal only / both / none.
- **Manual:** connect both → pay page shows both; disconnect Stripe → only PayPal; clear PayPal → only card; none → instructions only. Settings page has no greyed/disabled-but-clickable controls.

## Build phases (→ writing-plans)

1. Migration: drop `profiles.online_payments_enabled`.
2. `paymentMethods` helper + unit tests.
3. `PaymentsTab` rework (remove toggle; three live blocks) — Impeccable.
4. `PublicInvoicePage` "Pay this invoice" card + instructions fallback — Impeccable.
5. Update the public-invoice RPC/source so availability derives from connection state.
6. Verify — lint / tests / build; manual matrix above.

## Open questions

None — resolved in brainstorm.
