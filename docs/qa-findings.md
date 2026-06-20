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

## Triage summary
_(populated when QA is marked done)_
