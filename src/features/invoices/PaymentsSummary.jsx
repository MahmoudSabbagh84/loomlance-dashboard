import { cn } from '@/components/ui/cn'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'
import { invoiceTotals } from '@/lib/money'

const METHOD_LABELS = {
  stripe: 'Card',
  bank: 'Bank transfer',
  cash: 'Cash',
  other: 'Other',
  manual: 'Manual',
}

/**
 * Read-only payment ledger for the invoice detail page.
 *
 * Renders only when there is at least one recorded payment OR
 * the invoice status is `paid` / `partially_paid`.
 */
export function PaymentsSummary({ invoice }) {
  const payments = invoice.invoice_payments || []
  const { status } = invoice

  if (payments.length === 0 && status !== 'paid' && status !== 'partially_paid') return null

  const { total } = invoiceTotals(invoice.invoice_line_items || [])
  const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const balance = Math.round((total - paid) * 100) / 100
  const currency = invoice.currency

  return (
    <section aria-label="Payment summary" className="overflow-hidden rounded-lg border border-border bg-bg-elevated">
      {/* Total / Paid / Balance */}
      <div className="divide-y divide-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-fg-muted">Invoice total</span>
          <span className="text-sm tabular-nums font-medium text-fg">
            {formatCurrency(total, currency)}
          </span>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-fg-muted">Paid</span>
          <span className="text-sm tabular-nums font-medium text-success">
            {formatCurrency(paid, currency)}
          </span>
        </div>

        <div className="flex items-center justify-between bg-bg-muted px-4 py-2.5">
          <span className="text-sm font-semibold text-fg">Balance due</span>
          <span
            className={cn(
              'text-sm tabular-nums font-semibold',
              balance > 0 ? 'text-danger' : 'text-success',
            )}
          >
            {formatCurrency(balance, currency)}
          </span>
        </div>
      </div>

      {/* Individual payment rows */}
      {payments.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-2 text-xs text-fg-muted"
            >
              <span className="shrink-0 tabular-nums">{formatDate(p.paid_at)}</span>
              <span className="text-fg-subtle">
                {METHOD_LABELS[p.method] ?? p.method}
              </span>
              <span className="ml-auto tabular-nums font-medium text-fg">
                {formatCurrency(Number(p.amount), currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
