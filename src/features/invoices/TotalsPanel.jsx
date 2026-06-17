import { useWatch } from 'react-hook-form'
import { invoiceTotals } from '@/lib/money'
import { formatCurrency } from '@/lib/currency'

export function TotalsPanel({ control }) {
  const lines = useWatch({ control, name: 'line_items' }) || []
  const currency = useWatch({ control, name: 'currency' }) || 'USD'
  const totals = invoiceTotals(lines)
  return (
    <div className="space-y-1 rounded-lg border border-border bg-bg-elevated p-4 text-sm tabular-nums">
      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, currency)}</span></div>
      {totals.discount > 0 ? (
        <div className="flex justify-between text-fg-muted"><span>Discount</span><span>−{formatCurrency(totals.discount, currency)}</span></div>
      ) : null}
      {Object.entries(totals.taxByRate).map(([rate, amount]) => (
        <div key={rate} className="flex justify-between text-fg-muted"><span>Tax {rate}%</span><span>{formatCurrency(amount, currency)}</span></div>
      ))}
      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
        <span>Total</span><span>{formatCurrency(totals.total, currency)}</span>
      </div>
    </div>
  )
}
