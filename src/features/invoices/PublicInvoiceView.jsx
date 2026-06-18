import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { invoiceTotals } from '@/lib/money'

export function PublicInvoiceView({ data }) {
  const { issuer, client, line_items: lines = [], currency } = data
  const totals = invoiceTotals(
    lines.map((li) => ({
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      tax_rate: Number(li.tax_rate),
      discount_rate: Number(li.discount_rate),
    }))
  )
  const branded = issuer.tier !== 'free'
  const accent = branded ? issuer.invoice_accent_color : '#2D3E50'

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-border bg-white p-6 text-sm leading-snug text-black shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          {branded && issuer.logo_url ? (
            <img src={issuer.logo_url} alt="" className="mb-2 h-12" />
          ) : (
            <h2 className="text-xl font-bold" style={{ color: accent }}>
              {issuer.business_name || 'Your Business'}
            </h2>
          )}
          {issuer.address ? <p className="whitespace-pre-line text-xs">{issuer.address}</p> : null}
          {issuer.tax_id ? <p className="text-xs">Tax ID: {issuer.tax_id}</p> : null}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: accent }}>
            INVOICE
          </h1>
          <p className="mt-1 text-xs">{data.invoice_number}</p>
          <p className="text-xs">Issued: {data.issue_date ? formatDate(data.issue_date) : '—'}</p>
          <p className="text-xs">Due: {data.due_date ? formatDate(data.due_date) : '—'}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-1 text-xs uppercase text-gray-500">Bill to</p>
        <p className="font-medium">{client.name}</p>
        {client.company ? <p>{client.company}</p> : null}
        {client.address ? <p className="whitespace-pre-line text-xs">{client.address}</p> : null}
      </div>

      <table className="mb-6 w-full text-xs">
        <thead className="border-b border-gray-300">
          <tr>
            <th className="py-2 text-left">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((li, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="whitespace-pre-line py-2 pr-2">{li.description || '—'}</td>
              <td className="py-2 text-right tabular-nums">{Number(li.quantity)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(Number(li.unit_price), currency)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(Number(li.quantity) * Number(li.unit_price), currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-xs tabular-nums">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(totals.subtotal, currency)}</span>
        </div>
        {totals.discount > 0 ? (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>−{formatCurrency(totals.discount, currency)}</span>
          </div>
        ) : null}
        {Object.entries(totals.taxByRate).map(([r, a]) => (
          <div key={r} className="flex justify-between">
            <span>Tax {r}%</span>
            <span>{formatCurrency(a, currency)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-gray-400 pt-1 font-semibold">
          <span>Total</span>
          <span>{formatCurrency(totals.total, currency)}</span>
        </div>
      </div>

      {data.notes ? (
        <div className="mt-6 text-xs">
          <p className="font-semibold">Notes</p>
          <p className="whitespace-pre-line">{data.notes}</p>
        </div>
      ) : null}
      {data.payment_instructions ? (
        <div className="mt-3 text-xs">
          <p className="font-semibold">Payment</p>
          <p className="whitespace-pre-line">{data.payment_instructions}</p>
        </div>
      ) : null}
      {branded && issuer.invoice_footer ? (
        <p className="mt-8 whitespace-pre-line text-center text-xs text-gray-600">{issuer.invoice_footer}</p>
      ) : null}
    </div>
  )
}
