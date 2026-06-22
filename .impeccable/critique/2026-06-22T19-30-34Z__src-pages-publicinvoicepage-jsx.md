---
target: the public invoice page
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-22T19-30-34Z
slug: src-pages-publicinvoicepage-jsx
---
# Critique — Public invoice page (`src/pages/PublicInvoicePage.jsx` + `PublicInvoiceView`)

**Visual basis:** code + design system + detector (clean). This is the one surface a freelancer's **client** sees and pays on — so it carries the freelancer's reputation and is a conversion surface. Reviewed from source; a real render (it's public — no auth needed!) would sharpen the mobile/conversion findings.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton, paid banner, pay-button spinner, invalid-link state all present |
| 2 | Match System / Real World | 4 | Clean invoice document + plain "Pay now" — speaks the client's language |
| 3 | User Control and Freedom | 3 | Download always available; pay hands off to Stripe; can't double-pay |
| 4 | Consistency and Standards | 3 | Design-system buttons; unbranded fallback uses the retired `#2D3E50` |
| 5 | Error Prevention | 3 | Invalid-link guarded; pay errors toast; paid hides the CTA |
| 6 | Recognition Rather Than Recall | 3 | Whole invoice visible, but the **amount isn't on the Pay CTA** or summarized up top |
| 7 | Flexibility and Efficiency | 3 | Card + PayPal + Download options offered |
| 8 | Aesthetic and Minimalist | 3 | Clean, focused; but **LoomLance chrome leads a client-facing page**, 3 header buttons compete |
| 9 | Error Recovery | 3 | Toast on pay failure; calm "link no longer valid" copy |
| 10 | Help and Documentation | 2 | Payment instructions shown, but no "how to pay" cue or secure-payment reassurance |
| **Total** | | **30/40** | **Good — solid & trustworthy; leaves conversion + mobile polish on the table** |

## Anti-Patterns Verdict

**Does it look AI-generated? No.** It's a focused, calm single-column document with clear pay actions — appropriate and trustworthy. **Detector: clean (0 findings)** on the page. The only code-level drift is the shared `#2D3E50` unbranded fallback (tracked in LOO-55; this view is a third location).

## Overall Impression

This page does the **important things right** — it's clean, the invoice is fully legible, the invalid-link state is calm and non-technical, and the real payment correctly hands off to Stripe. Because it's the client's view of *the freelancer's* professionalism, the biggest opportunities are **conversion and trust polish**, not fixing breakage: surface the amount, make paying effortless on mobile, and make sure the freelancer's brand (not LoomLance's) leads.

## What's Working

- **Calm, legible single-column document** (`max-w-2xl`, centered) — the right shape for "view & pay," not a cluttered dashboard.
- **Graceful invalid-link state** — "This invoice link is no longer valid. Ask the sender for an up-to-date link." Plain, reassuring, no error codes.
- **Correct, safe payment** — real pay hands off to Stripe Checkout; paid state is reflected (incl. the `?paid=1` return), and the CTA hides once paid so a client can't double-pay.

## Priority Issues

- **[P2] The amount isn't surfaced for the payer.** The client must read the document to find the total; "Pay now" carries no figure. **Why it matters:** on a payment page, showing the total prominently and on the button ("Pay $1,240.00") is a direct clarity + conversion win. **Fix:** a total summary near the top and the amount on the Pay CTA. **Command:** `/impeccable layout` + `/impeccable clarify`. *(New → Linear.)*
- **[P2] Pay actions live only in the top header — bad on mobile.** A client scrolls down to read the invoice and loses the CTA; nothing is in the thumb zone. **Why it matters:** mobile clients are the abandonment risk on a pay page. **Fix:** a sticky pay bar (bottom on mobile) showing amount + Pay. **Command:** `/impeccable adapt`. *(New → Linear.)*
- **[P2] LoomLance chrome leads a client-facing page.** The LoomLance logo sits top-left above the freelancer's own invoice/brand. **Why it matters:** on a *paid* tier, the freelancer is paying to look professional to their client; platform branding at the top can undercut that. **Fix:** de-emphasize to a subtle footer "Powered by LoomLance" (or hide on paid tiers); keep attribution on free. **Command:** `/impeccable layout`. *(New → Linear.)*
- **[P3] Unbranded fallback uses the retired `#2D3E50`** — same as LOO-55; this view is a third location (heading + business name). Roll into LOO-55.
- **[P3] Trust & a11y micro-gaps** — no "Secure payment via Stripe" reassurance near Pay now; the issuer logo has `alt=""` (the client can't tell who's billing if images are off). *(New → folded into the Linear polish issue.)*

## Persona Red Flags

**Casey (distracted mobile):** the pay action is at the **top**, unreachable by thumb after scrolling; three header buttons likely wrap on a phone. This is the page's biggest real-world weakness — it's a mobile payment surface.

**Jordan (first-timer / the client):** lands on the page and may not immediately see *what they owe* or *that it's safe to pay* — no up-top total, no security reassurance. The "Bill to" and document are clear, but the payment ask could be more obvious.

**Riley (stress tester):** invalid/expired link handled well; paid state reflected on return; double-pay prevented. Solid against the edges.

## Minor Observations

- Three similarly-weighted header buttons (Download / Pay now / PayPal) — Download is least important; the pay CTA should dominate.
- The document is intentionally a white-paper render (print grays) — correct for fidelity with the PDF; only `#2D3E50` is stale.
- Real screenshot is easy here (public, no auth) — worth a true visual + mobile pass.

## Questions to Consider

- What if the very first thing the client sees is **"You owe $X — Pay now,"** with the document below for detail?
- On a freelancer's *paid* plan, should LoomLance branding appear on the client's page at all, or only as a quiet footer?
- Would a sticky bottom pay bar on mobile measurably lift completion versus the top-only actions?

---

## Visual pass (2026-06-22) — desktop + mobile render of INV-0067 (tier_2)
Rendered the real public page (no auth needed). Confirmed: amount is **not** on the "Pay now" CTA; pay actions are **top-only** (gone after scrolling on the 390px render, large empty void below); the **LoomLance** logo leads above the freelancer's brand; the unbranded heading/business-name renders in the stale **#2D3E50** (LOO-55).
**NEW:** the client page renders on the **dark app theme** by default — a white invoice card on near-black. For an external client's document this should be a stable light/paper presentation regardless of theme. Folded into LOO-57 (#3).
