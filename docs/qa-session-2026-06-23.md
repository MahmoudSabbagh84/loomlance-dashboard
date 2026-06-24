# QA session notes — 2026-06-23 (evening)

**Scope:** full platform spot-check, splash → dashboard, ahead of go-live.
**Live builds:** dashboard `app.loomlance.com` (latest `e4c20ec`), splash `loomlance.com` (latest `ee803fa`). Hard-refresh (Ctrl/Cmd+Shift+R) before testing.
**Testers:** _(add names)_ · **Started:** _____ · **Browsers/devices:** _(note each tester's browser + desktop/mobile)_

---

## ⚠️ Read first — QA safety
- **Payments are REAL (Stripe Connect/Checkout) unless mock is enabled.** Do **not** pay invoices with a real card. Use Stripe **test mode / test cards**, or confirm `app_config.mock_payments_enabled` is on for this session. Decide this BEFORE anyone clicks "Pay now."
- **The owner uses the app live.** Testers should create their **own** clearly-labelled throwaway data (prefix names with `ZZ-QA-`), not edit real clients/invoices. Don't bulk-delete.
- **Email goes to real inboxes** (SES, `send.loomlance.com`). Send invoices/contact messages only to addresses you control.
- Before real signups: **Terms/Privacy** now exist (`/terms`, `/privacy`) — fine to accept.

## How to log a finding (paste these to me and I'll file them in Linear)
```
[area] short title
Severity: P0 / P1 / P2 / P3
Steps: 1… 2… 3…
Expected: …
Actual: …
Browser/device: …
```
**Severity:** P0 = blocks the task (showstopper) · P1 = major/confusing, fix before launch · P2 = minor, workaround exists · P3 = polish.

---

## ✅ Verify THIS session's fixes are live (regression pass)
- [ ] **Dashboard "Overdue" stat** shows a true overdue count (not all open invoices). _(was wrong; fixed)_
- [ ] **Dashboard StatsRow** leads with Revenue; card reads "Overdue" not "Open invoices".
- [ ] **Invoice editor** saves reliably — create an invoice, add line items, reload → data persists; download/preview shows the items (not blank).
- [ ] **Send invoice → INBOX:** send a test invoice (leave "Attach PDF" OFF) → lands in inbox, renders, pay link works, PDF downloads from the pay page.
- [ ] **Contact form** (splash) → message arrives in inbox, renders.
- [ ] **Expenses:** replacing a receipt that fails doesn't lose the old one; "Billable" with no client/project is blocked; currency is a dropdown.
- [ ] **Modals/drawers:** open one, Tab stays inside it, Esc closes, focus returns.
- [ ] **Splash mobile nav:** on a phone, the hamburger opens Features/Pricing/About/Contact.
- [ ] **Splash:** new heading font + bento features render; `/terms` + `/privacy` load; signup consent links work.

## 🔭 Known open issues — please CONFIRM but don't re-file (already tracked)
- **LOO-6 (P0):** changing a draft invoice's client, then sending, may email the *previous* client. **Test this explicitly** and note if reproduced.
- **LOO-15:** typing then leaving the invoice editor fast may drop the last autosave.
- **LOO-69/70/71/72:** assorted a11y (popover focus, chart screen-reader text, etc.).
- **LOO-57/59/61/65/66/67:** public-page conversion, reports/kanban/list polish.
- Full backlog: Linear team **LOO**, "Go-Live Readiness".

---

## Test plan (walk these flows; tick + note issues inline)

### 1. Auth & onboarding
- [ ] Sign up (splash `/signup`, pick a plan) → confirmation email → confirm → land in dashboard
- [ ] "Remember me" on login persists / doesn't, as expected
- [ ] First-run: onboarding checklist, empty states are welcoming
- [ ] Sign out / sign back in

### 2. Splash site (`loomlance.com`)
- [ ] Desktop nav + **mobile hamburger** reach every page
- [ ] Pricing: monthly/annual toggle, FAQ accordion
- [ ] Contact form: validation, send, success state
- [ ] `/terms`, `/privacy` load and link back
- [ ] Responsive at phone width; no horizontal scroll

### 3. Clients (CRM)
- [ ] Create / edit / archive / delete a `ZZ-QA-` client
- [ ] Add people/contacts; set primary
- [ ] Activity tab populates; row actions work
- [ ] Delete with linked data → confirm dialog warns

### 4. Projects & Kanban
- [ ] Create a project; open its board
- [ ] Add columns/tasks (inline add); set WIP limit → over-limit signal
- [ ] Drag a task between columns (mouse **and** keyboard); reorder
- [ ] Open task drawer: edit, change column, due date, delete
- [ ] Filters (search/priority/due/hide-done)

### 5. Invoices (core revenue flow)
- [ ] Create invoice → pick client/project, line items (qty/price/tax/discount)
- [ ] Live preview + totals correct; autosave status shows
- [ ] Download PDF (matches preview)
- [ ] **Send** → recipient inbox; open the **public pay page** (`/i/:token`)
- [ ] **Change the client on a draft, then send → does it go to the right client?** (LOO-6)
- [ ] Mark paid / partial pay; status + dashboard update
- [ ] Board view + list view; status filters; search

### 6. Time tracking
- [ ] Start/stop the topbar timer; commit/discard
- [ ] Add a manual entry; edit; delete
- [ ] "Ready to bill" → generate an invoice from time

### 7. Expenses
- [ ] Add expense; category, currency (dropdown), billable
- [ ] Upload a receipt; **replace** it; open it
- [ ] "Ready to bill" → generate invoice from expenses

### 8. Contracts & 9. Recurring
- [ ] Create a contract; generate/download PDF; change status
- [ ] Create a recurring template; "Generate now"; pause/resume

### 10. Reports (tier-2)
- [ ] Revenue / P&L / Aging / Time tabs; date presets + custom range
- [ ] Multi-currency tabs; CSV export downloads
- [ ] Charts render in light **and** dark mode

### 11. Settings / Profile
- [ ] Account (name, password), Business (address, tax id)
- [ ] Branding: logo upload, accent color (invalid hex blocked); live preview
- [ ] Payments: Stripe Connect status, PayPal, online-payments toggle
- [ ] Subscription: plan, billing portal, monthly/annual

### 12. Dashboard
- [ ] Stats, Due Soon, Recent Activity, revenue chart, drill-into-month
- [ ] Cmd/Ctrl+K search

### 13. Cross-cutting
- [ ] **Dark mode** across surfaces
- [ ] **Mobile** (real phone): nav, tables scroll, forms usable
- [ ] **Keyboard-only**: tab through a form + a modal
- [ ] Error states: bad input, offline mid-action, very long names
- [ ] Tier gating: free vs tier-1 vs tier-2 features locked/unlocked correctly

---

## 📋 Findings log
_(I'll keep this updated and file each as a Linear issue. Format: # · area · severity · title · status)_

| # | Area | Sev | Title | Linear | Status |
|---|------|-----|-------|--------|--------|
| 1 | Reports / CSV export | P2 | CSV filename should include the selected date range (was `revenue-USD.csv`; Time had no currency) | LOO-82 | ✅ Fixed (`990d62d`, via `/impeccable clarify`) — ships on next dashboard push |
| 2 | Invoices / Send modal | P1 | Additional contacts unreachable when sending; rework as email composer (To/Cc chips + contact suggestions) | LOO-83 | ✅ Built (`c8423cd`, via `/impeccable craft`); fn v8 live, UI ships on next dashboard push |
| 3 | Time tracking / Timer | P2 | Rework topbar timer: remove clock icon, inline controls + Start-timer selection modal | LOO-84 | ✅ Built (`c287774`, via `/impeccable craft`) — ships on next dashboard push |
| 4 | Invoices / Editor | P2 | Bigger status indicator (enlarge/color) + lock fields once sent | LOO-85 | ✅ Built (`ac5df1b`, via `/impeccable craft`); lock-on-sent already existed — ships on next push |
| 5 | Projects / Financials | P2 | Optional project budget + invoiced/expenses/hours rollups (budget-vs-actual) | LOO-86 | ✅ Built (`e252f96`→`31043f6`, brainstorm→spec→plan→Impeccable) — ships on next dashboard push |

**Session wrapped 2026-06-23.** 5 findings: 2 shipped (LOO-82, LOO-83), 1 shaped & paused (LOO-84), 2 captured (LOO-85 to build, LOO-86 to spec). Regression checklist + known-issue confirmations above remain for the next testing pass.
