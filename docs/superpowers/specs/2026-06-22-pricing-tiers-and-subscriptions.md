# Spec — Pricing, tiers & subscriptions (finalized)

> **Status:** ✅ Decisions locked (2026-06-22). Source of truth for the plan/feature matrix that **splash marketing**, **dashboard gating (`tier.js`)**, and **Stripe products/prices** must all match.
> **Origin:** splash QA Track B (F6) + the pricing/features finalization. Replaces the inconsistent `pricing.html`/`signup.html` plan data (which advertised unbuilt features + wrong limits).

## Decisions
- **4 tiers** (3 live + 1 coming-soon): **Solo** (free), **Freelancer** (`tier_1`), **Studio** (`tier_2`), **Agency** (`tier_3`, **Coming soon — not sellable yet**).
- **Project limits match current gating:** Free 1 · Freelancer 5 · Studio unlimited.
- **Free stays lean** — no time tracking / branding / recurring (those start at Freelancer).
- **Unbuilt features shown as "Coming soon" badges**, not as available.
- **Prices (lower-entry):** Freelancer **$19/mo**, Studio **$49/mo**. Solo $0. Agency TBD.
- **Billing:** monthly **+ annual (~2 months free)** → Freelancer **$190/yr** (~$15.83/mo), Studio **$490/yr** (~$40.83/mo).
- **Trial:** **14-day free trial, card required** (Stripe trial; auto-charges after unless cancelled) on Freelancer & Studio. Solo needs no trial (it's free); Agency N/A.

## Internal mapping
| Marketing name | `subscription_tier` | Sellable now? |
|---|---|---|
| Solo | `free` | ✅ (default on signup) |
| Freelancer | `tier_1` | ✅ |
| Studio | `tier_2` | ✅ |
| Agency / Team | `tier_3` | ❌ Coming soon (reserved value; not in gating until built) |

## Feature matrix (built features only; ✓ included)
| Capability (exists today) | Solo / free | Freelancer / tier_1 | Studio / tier_2 |
|---|:--:|:--:|:--:|
| Clients / CRM (unlimited) | ✓ | ✓ | ✓ |
| Contracts (+ PDF) | ✓ | ✓ | ✓ |
| Invoicing + PDF | ✓ | ✓ | ✓ |
| Public invoice page + online pay (Stripe Connect card + PayPal) + cash/bank instructions | ✓ | ✓ | ✓ |
| Active projects | **1** | **5** | **Unlimited** |
| Custom invoice branding (logo/accent/footer) | — | ✓ | ✓ |
| Recurring invoices | — | ✓ | ✓ |
| Time tracking (timer + manual + invoice-from-time) | — | ✓ | ✓ |
| Expenses (+ receipts) | — | — | ✓ |
| Reports (revenue / P&L / aging / time) + CSV | — | — | ✓ |

## Coming-soon (badged; not available — tentative tier placement when built)
- **Freelancer+:** GitHub/GitLab integration, Scope-creep / change-request module, Secure credential vault.
- **Studio+:** Income forecasting.
- **Agency (`tier_3`):** Team members/seats, white-label client portal, subcontractor management, advanced permission controls. (Whole tier is coming-soon.)

## Reconciliation actions (the three sources → make them agree)
> **Applied 2026-06-22 (content-level):** `pricing.html` cards (4 tiers, correct features, coming-soon clocks, $19/$49 + annual, Studio live, Agency added), `signup.html` (planData + plan-option cards + billing-summary), and `tier.js` `UPGRADE_COPY` (marketing names) are all reconciled. The **visual** restyle of the splash still rides with **F1**. Billing wiring is **F6** (not yet built — paid signups still create a free account + plan intent).
1. **Splash `pricing.html`** — rebuild the cards: 4 tiers, correct feature lists (matrix above), "Coming soon" badges on unbuilt items, new prices ($0/$19/$49 + annual), Studio is **live** (drop its "Coming Soon"), Agency is the new **Coming Soon** card. *(Visual rebuild aligns with F1 design-system work; this spec fixes the content/structure.)*
2. **Splash `signup.html`** — update `PlanSelector.planData`: `solo $0 / freelancer $19 / studio $49`; map selection → correct tier; reflect trial; Agency not selectable.
3. **Dashboard `src/lib/tier.js`** — gating for free/tier_1/tier_2 already matches the matrix (no limit/feature change needed). Update `UPGRADE_COPY` wording from "Tier 1/Tier 2" → the **marketing names** ("Freelancer"/"Studio") for consistency. Reserve `tier_3` (Agency) — add when its features ship; not gated now.

## Feeds F6 — Stripe subscription build (next)
- **Stripe Products:** "LoomLance Freelancer", "LoomLance Studio". **Prices (4):** Freelancer monthly ($19) + annual ($190); Studio monthly ($49) + annual ($490). Capture the `price_…` IDs (test + live).
- **Checkout** in `mode: 'subscription'`, `subscription_data.trial_period_days: 14`, card required; one Stripe **Customer** per Supabase user (store `stripe_customer_id`).
- **Webhook** (separate from the Connect webhook): `customer.subscription.created/updated/deleted` + `invoice.paid` → set/clear `profiles.subscription_tier` (`tier_1`/`tier_2`/back to `free`); store `stripe_subscription_id` + status.
- **Customer Portal** for self-service upgrade/downgrade/cancel/card update.
- Agency/`tier_3`: no Stripe product yet (coming soon).

## Open / notes
- Prices, annual rate, and trial length are all easy to change later (just new Stripe Prices + copy).
- `tier_3` is reserved in the data model but intentionally **not** added to `TIER_LIMITS`/gating until the Agency features exist.
- Keep this matrix as the single reference; if a capability ships, update here first, then the 3 sources.
