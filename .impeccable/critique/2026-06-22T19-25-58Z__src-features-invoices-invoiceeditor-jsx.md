---
target: the invoice editor
total_score: 30
p0_count: 1
p1_count: 1
timestamp: 2026-06-22T19-25-58Z
slug: src-features-invoices-invoiceeditor-jsx
---
# Critique — Invoice editor (`src/features/invoices/InvoiceEditor.jsx`)

**Visual basis:** code + the documented design system + detector. The editor is login-gated, so reviewed from source (not pixel-rendered). A login-based visual pass can confirm the two-pane rhythm and the live preview at breakpoints.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | SaveStatus (saving/saved/error/retry) + read-only Lock badge are good; no "not saved — invalid" state |
| 2 | Match System / Real World | 4 | Invoice language is natural (Bill to, line items, terms); live preview mirrors the printed doc |
| 3 | User Control and Freedom | 3 | Sent/paid is read-only (good); but autosave-only, no manual save or undo/revert |
| 4 | Consistency and Standards | 3 | App vocabulary consistent; the preview/PDF unbranded fallback uses the retired `#2D3E50` |
| 5 | Error Prevention | 2 | Controlled selects + read-only + confirms, but stale-client-on-Send, autosave-drop-on-close, partial-pay flip |
| 6 | Recognition Rather Than Recall | 4 | The live preview beside the form is excellent — you see exactly what the client gets |
| 7 | Flexibility and Efficiency | 3 | Autosave, toggleable Tax/Discount columns, generate-from-time/expenses; no editor-level shortcuts |
| 8 | Aesthetic and Minimalist | 3 | Clean two-pane; the left form is a long single stack |
| 9 | Error Recovery | 3 | SaveStatus retry + mapPostgresError toasts; send failures surface |
| 10 | Help and Documentation | 2 | Minimal inline help; field meanings/states largely unexplained |
| **Total** | | **30/40** | **Good — strong bones; the risks are functional, mostly already tracked** |

## Anti-Patterns Verdict

**Does it look AI-generated? No.** The **form + live invoice preview side-by-side** is a craft signal, not a template — it's the standout of the screen. Consistent control vocabulary, tabular numbers, progressive disclosure (Tax/Discount columns appear only when used), read-only issued invoices. This passes the product slop test comfortably.

**Deterministic scan.** `detect.mjs` over `features/invoices` → only `design-system-color` advisories, all in **`InvoicePDF.jsx`** (`#111111`, `#666666`, `#888888`) — **false positives**: the PDF is a separate print render target with its own grayscale, not app chrome. One *real* hit: the live **`InvoicePreview`** (and the PDF's `ACCENT_FALLBACK`) use **`#2D3E50`** — the retired old-brand slate — as the business-name color for unbranded (free-tier) invoices.

**Visual overlays.** Not available (auth-gated); findings are source-based.

## Overall Impression

This is the **most accomplished screen in the app** — the live-preview pattern makes invoicing legible and trustworthy, exactly right for "the data is the hero." It is *not* a design problem; its risks are **functional correctness** around the autosave→send path, and most are already in the go-live backlog. Fix those, retire the one stale color, and this is a genuinely excellent editor.

## What's Working

- **Live invoice preview beside the form (recognition 4/4).** The user sees the exact client-facing document update as they type. This is the screen's signature strength and a real trust-builder for a money tool.
- **Autosave + SaveStatus, no Save button.** Removes friction and the "did I save?" anxiety — modern and on-brand, *when* it's reliable (see issues).
- **Issued invoices are read-only** (Lock badge). You can't accidentally edit a document the client already has — correct error prevention for the domain.
- **Progressive disclosure** — Tax/Discount columns appear only when used; complexity stays hidden until needed.

## Priority Issues

- **[P0] Stale client on Send/Download** — changing a draft's client then sending emails the *previous* client (wrong recipient + Bill-to). Already tracked: **LOO-6**. This is the single most important fix for the editor; re-confirmed here.
- **[P1] Pending autosave dropped on close/navigation** — typing then leaving within the debounce silently loses the last edit, while the user believes it saved. Already tracked: **LOO-15**.
- **[P2] No feedback when autosave drops an invalid field** — because there's no manual Save, an invalid field that won't persist returns the status to idle with no "not saved" signal. Higher-stakes here than elsewhere. Already tracked: **LOO-24**.
- **[P3] Unbranded invoices render the retired `#2D3E50` brand slate** — the live preview's business-name fallback and the PDF's `ACCENT_FALLBACK` both use the old design-era color, so free-tier invoices go out with a stale brand hue. **NEW.** Fix: use a current neutral ink for the unbranded fallback (and keep preview ↔ PDF in agreement). New Linear issue filed.
- **[P2] Totals rounding can drift** between `lib/money.js` (preview/TotalsPanel), the `mock_pay_invoice` SQL, and `stripe-checkout` on mixed tax rates. Already tracked: **LOO-33**.

## Persona Red Flags

**Alex (power user):** efficient — autosave, generate-from-time/expenses, toggleable columns. Gaps: no keyboard shortcuts within the editor; line-item rows are add-one-at-a-time (no paste-from-spreadsheet / bulk add), which a heavy invoicer will miss.

**Riley (stress tester):** the autosave→send race is exactly their kill shot — change client / type fast / leave quickly / send, and the known stale-cache bugs (LOO-6/15) surface. The live preview, by contrast, is honest (reads live form state) and won't mislead them.

**Sam (a11y):** controlled labeled fields + global focus ring are good. The preview's "BILL TO" is uppercase, but that's a legitimate invoice-document convention (not an app-chrome eyebrow). Confirm the read-only/disabled state is conveyed to AT, not by the Lock icon alone.

## Minor Observations

- The left form is one long stack (status, client/project, number/currency/dates, line items, notes/terms/payment, totals); on smaller viewports the live preview drops below — confirm that's the intended single-column order.
- No editor keyboard shortcuts (e.g. add line, save-and-send).
- The preview deliberately renders a white-paper document with print grays — correct for document fidelity; only the `#2D3E50` fallback is stale.

## Questions to Consider

- Should the unbranded invoice fallback be a neutral ink (document-like) rather than any brand color at all — so free-tier invoices look clean rather than "someone else's brand"?
- Would paste-from-spreadsheet line-item entry materially speed up heavy invoicers?
- Is autosave-only the right model for a legally-meaningful document, or should "Send" force a final explicit confirm-and-persist (closing the LOO-6/15 race by design)?
