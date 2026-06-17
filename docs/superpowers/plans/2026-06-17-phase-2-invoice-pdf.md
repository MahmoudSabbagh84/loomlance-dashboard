# Invoice PDF Implementation Plan (Phase 2 · Milestone 1)

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a professional, downloadable PDF of any invoice that mirrors the existing on-screen preview, honoring per-business branding for paid tiers.

**Architecture:** A `<InvoiceDocument/>` built with `@react-pdf/renderer` renders the same layout as `InvoicePreview.jsx`, driven by plain data (`{ invoice, client, profile }`) — not the react-hook-form control. A Download button on the invoice detail header dynamically imports the PDF module on click (so the heavy renderer is code-split out of the main bundle and only fetched when used), builds a Blob, and saves it as `<invoice_number>.pdf`. The fast HTML preview stays as the live editor preview; the PDF is the downloadable artifact. Totals are computed with the existing `invoiceTotals` helper so the PDF and the app never disagree.

**Tech Stack:** `@react-pdf/renderer` (v3+, React 18 compatible) · existing `lib/money` totals · `lib/currency` / `lib/date` formatters · `useProfile`.

**Scope note:** Live PDF preview in the editor (re-rendering the document on every keystroke) is deliberately deferred — it's janky and the HTML preview already covers live editing. Server-side PDF regeneration belongs to Phase 3 (`send_invoice`). This milestone delivers an accurate document + client-side Download.

---

### Task 1: Add `@react-pdf/renderer` and the `<InvoiceDocument/>` component

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/features/invoices/InvoicePDF.jsx`

- [ ] **Step 1: Install the renderer**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Create `src/features/invoices/InvoicePDF.jsx`**

A `Document` → `Page` (A4) mirroring `InvoicePreview.jsx`: branded header (logo or business name in accent color, address, tax id), INVOICE block (number, issue/due dates), Bill-to, line-items table, totals (subtotal, discount, tax-by-rate, total), notes/terms/payment, branded footer. Plus `buildInvoiceBlob({ invoice, client, profile })` which returns `pdf(<InvoiceDocument .../>).toBlob()`. `branded = (profile?.subscription_tier ?? 'free') !== 'free'`. Coerce line-item numerics with `Number()` and sort by `position`. Use `invoiceTotals` from `@/lib/money`, `formatCurrency` from `@/lib/currency`, `formatDate` from `@/lib/date`.

- [ ] **Step 3: Build check**

Run: `npm run build` → Expected: PASS (the renderer code-splits into its own chunk via the dynamic import in Task 2; here it's only imported by the not-yet-referenced module, so build stays green).

---

### Task 2: Download button wired into invoice actions

**Files:**
- Create: `src/features/invoices/InvoiceDownloadButton.jsx`
- Modify: `src/features/invoices/InvoiceActions.jsx`

- [ ] **Step 1: Create `InvoiceDownloadButton.jsx`**

A secondary `Button` (Download icon, "PDF"). On click: set loading, `const { buildInvoiceBlob } = await import('./InvoicePDF')` (dynamic → code-split), build the blob from `{ invoice, client: invoice.clients, profile }`, create an object URL, click a temporary `<a download="<number>.pdf">`, revoke the URL. Toast on error. `useProfile()` supplies branding. Always available (any status).

- [ ] **Step 2: Wire into `InvoiceActions.jsx`**

Render `<InvoiceDownloadButton invoice={invoice} />` first in the action row (before Duplicate).

- [ ] **Step 3: Build + lint**

Run: `npm run build && npx eslint . --max-warnings 0` → Expected: PASS, with a separate `@react-pdf/renderer` chunk in the build output.

---

### Task 3: Verify and commit

- [ ] **Step 1: Unit gate** — `npm run build`, `npx eslint . --max-warnings 0`, `npx vitest run` (28 pass).
- [ ] **Step 2: Live-verify (Playwright)** — log in, open an invoice, click PDF, assert a `<invoice_number>.pdf` download fires and is a non-empty `%PDF` file. Clean up any test invoice + reset sequence.
- [ ] **Step 3: Commit** — lint-gated: `feat(invoices): downloadable branded PDF via @react-pdf/renderer`.

---
```
