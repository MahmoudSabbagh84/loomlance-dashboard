import { invoiceTotals } from './money'

const INVOICED_STATUSES = new Set(['sent', 'viewed', 'paid', 'partially_paid', 'overdue'])
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Pure rollup of one project's financials, in the project's currency.
// Invoices/expenses in a different currency are excluded from sums and counted
// into excludedCount. Time entries have no currency, so their value is always
// counted in the project currency.
export function projectFinancials(
  { invoices = [], expenses = [], timeEntries = [] } = {},
  projectCurrency,
  budgetAmount = null
) {
  let invoiced = 0
  let draftInvoiced = 0
  let paid = 0
  let expensesTotal = 0
  let unbilledExpenses = 0
  let unbilledTime = 0
  let excludedCount = 0

  for (const inv of invoices) {
    if (inv.currency !== projectCurrency) {
      excludedCount += 1
      continue
    }
    const total = invoiceTotals(inv.invoice_line_items || []).total
    if (inv.status === 'draft') draftInvoiced += total
    else if (INVOICED_STATUSES.has(inv.status)) invoiced += total
    for (const p of inv.invoice_payments || []) {
      if (p.currency === projectCurrency) paid += Number(p.amount) || 0
    }
  }

  for (const e of expenses) {
    if (e.currency !== projectCurrency) {
      excludedCount += 1
      continue
    }
    const amt = Number(e.amount) || 0
    expensesTotal += amt
    if (e.billable && !e.invoiced_on_invoice_id) unbilledExpenses += amt
  }

  for (const t of timeEntries) {
    if (t.billable && !t.invoiced_on_invoice_id) {
      unbilledTime += ((Number(t.duration_minutes) || 0) / 60) * (Number(t.hourly_rate) || 0)
    }
  }

  invoiced = round2(invoiced)
  return {
    invoiced,
    draftInvoiced: round2(draftInvoiced),
    paid: round2(paid),
    expenses: round2(expensesTotal),
    unbilledExpenses: round2(unbilledExpenses),
    unbilledTime: round2(unbilledTime),
    unbilledToInvoice: round2(unbilledExpenses + unbilledTime),
    remaining: budgetAmount == null ? null : round2(budgetAmount - invoiced),
    profit: round2(paid - expensesTotal),
    excludedCount,
  }
}
