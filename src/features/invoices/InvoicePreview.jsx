import { useWatch } from 'react-hook-form'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/date'
import { invoiceTotals } from '@/lib/money'
import { INVOICE_DEFAULT_ACCENT } from '@/lib/colors'
import { useProfile } from '@/hooks/useProfile'

export function InvoicePreview({ control, client }) {
  const values = useWatch({ control })
  const { data: profile } = useProfile()
  const totals = invoiceTotals(values?.line_items || [])
  const tier = profile?.subscription_tier ?? 'free'
  const branded = tier !== 'free'

  return (
    <div className="min-h-[800px] rounded-lg border border-border bg-white p-6 text-sm leading-snug text-black">
      <div className="mb-6 flex items-start justify-between">
        <div>
          {branded && profile?.logo_url ? (
            <img src={profile.logo_url} alt="" className="mb-2 h-12" />
          ) : (
            <h2 className="text-xl font-bold" style={{ color: branded ? profile?.invoice_accent_color : INVOICE_DEFAULT_ACCENT }}>
              {profile?.business_name || 'Your Business'}
            </h2>
          )}
          {profile?.address ? <p className="whitespace-pre-line text-xs">{profile.address}</p> : null}
          {profile?.tax_id ? <p className="text-xs">Tax ID: {profile.tax_id}</p> : null}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-semibold tracking-tight">INVOICE</h1>
          <p className="mt-1 text-xs">{values?.invoice_number}</p>
          <p className="text-xs">Issued: {values?.issue_date ? formatDate(values.issue_date) : '—'}</p>
          <p className="text-xs">Due: {values?.due_date ? formatDate(values.due_date) : '—'}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-1 text-xs uppercase text-gray-500">Bill to</p>
        <p className="font-medium">{client?.name}</p>
        {client?.company ? <p>{client.company}</p> : null}
        {client?.address ? <p className="whitespace-pre-line text-xs">{client.address}</p> : null}
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
          {(values?.line_items || []).map((li, i) => {
            const lineTotal = (Number(li.quantity) || 0) * (Number(li.unit_price) || 0)
            return (
              <tr key={i} className="border-b border-gray-200">
                <td className="whitespace-pre-line py-2 pr-2">{li.description || '—'}</td>
                <td className="py-2 text-right tabular-nums">{Number(li.quantity || 0)}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(Number(li.unit_price || 0), values.currency || 'USD')}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(lineTotal, values.currency || 'USD')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-xs tabular-nums">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, values?.currency || 'USD')}</span></div>
        {totals.discount > 0 ? <div className="flex justify-between"><span>Discount</span><span>−{formatCurrency(totals.discount, values?.currency || 'USD')}</span></div> : null}
        {Object.entries(totals.taxByRate).map(([r, a]) => (
          <div key={r} className="flex justify-between"><span>Tax {r}%</span><span>{formatCurrency(a, values?.currency || 'USD')}</span></div>
        ))}
        <div className="flex justify-between border-t border-gray-400 pt-1 font-semibold">
          <span>Total</span><span>{formatCurrency(totals.total, values?.currency || 'USD')}</span>
        </div>
      </div>

      {values?.notes ? <div className="mt-6 text-xs"><p className="font-semibold">Notes</p><p className="whitespace-pre-line">{values.notes}</p></div> : null}
      {values?.terms ? <div className="mt-3 text-xs"><p className="font-semibold">Terms</p><p className="whitespace-pre-line">{values.terms}</p></div> : null}
      {values?.payment_instructions ? <div className="mt-3 text-xs"><p className="font-semibold">Payment</p><p className="whitespace-pre-line">{values.payment_instructions}</p></div> : null}

      {branded && profile?.invoice_footer ? <p className="mt-8 whitespace-pre-line text-center text-xs text-gray-600">{profile.invoice_footer}</p> : null}

      <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-4 text-[10px] text-gray-400">
        <img src="/logo.png" alt="" className="size-3.5" />
        <span>Created with LoomLance</span>
      </div>
    </div>
  )
}
