import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Download, CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePublicInvoice, useMockPay } from '@/hooks/usePublicInvoice'
import { PublicInvoiceView } from '@/features/invoices/PublicInvoiceView'
import { invokeEdge } from '@/api/edge'
import { paymentsAreReal } from '@/lib/providers'
import { invoiceTotals } from '@/lib/money'
import { paypalHref } from '@/lib/paypal'
import { paymentMethods } from '@/lib/payments'
import { formatCurrency } from '@/lib/currency'

export default function PublicInvoicePage() {
  const { token } = useParams()
  const { data, isLoading, refetch } = usePublicInvoice(token)
  const pay = useMockPay()
  const [paid, setPaid] = useState(false)
  const [paying, setPaying] = useState(false)

  // Returning from a real Stripe Checkout lands on /i/:token?paid=1 — reflect it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('paid') === '1') {
      setPaid(true)
      refetch()
    }
  }, [refetch])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">This invoice link is no longer valid</h1>
          <p className="mt-1 text-sm text-fg-muted">Ask the sender for an up-to-date link.</p>
        </div>
      </div>
    )
  }

  const download = async () => {
    const { buildInvoiceBlob } = await import('@/features/invoices/InvoicePDF')
    const invoice = {
      invoice_number: data.invoice_number,
      issue_date: data.issue_date,
      due_date: data.due_date,
      currency: data.currency,
      notes: data.notes,
      terms: data.terms,
      payment_instructions: data.payment_instructions,
      invoice_line_items: data.line_items,
    }
    const profile = { ...data.issuer, subscription_tier: data.issuer.tier }
    const blob = await buildInvoiceBlob({ invoice, client: data.client, profile })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const onPay = async () => {
    setPaying(true)
    try {
      if (paymentsAreReal) {
        const { url } = await invokeEdge('stripe-checkout', { token })
        window.location.href = url // hand off to Stripe Checkout
        return
      }
      await pay.mutateAsync(token)
      setPaid(true)
      await refetch()
    } catch (e) {
      toast.error(e.userMessage || 'Payment could not be completed')
    } finally {
      setPaying(false)
    }
  }

  const isPaid = paid || data.status === 'paid'
  const total = invoiceTotals(
    (data.line_items || []).map((li) => ({
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      tax_rate: Number(li.tax_rate),
      discount_rate: Number(li.discount_rate),
    }))
  ).total
  const paypalUrl = data.paypal_link ? paypalHref(data.paypal_link, total, data.currency) : null
  const methods = isPaid ? [] : paymentMethods({ can_pay: data.can_pay, paypal_link: data.paypal_link })

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="LoomLance" className="size-8" />
          <Button variant="secondary" size="sm" onClick={download}>
            <Download className="size-4" /> Download PDF
          </Button>
        </div>

        {isPaid ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" /> This invoice has been paid. Thank you!
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-bg-elevated">
            {/* Amount zone */}
            <div className="px-5 py-4">
              <p className="mb-3 text-sm font-medium text-fg">Pay this invoice</p>
              <p className="text-xs uppercase tracking-wider text-fg-muted">Amount due</p>
              <p className="mt-0.5 text-2xl font-semibold text-fg tabular-nums">
                {formatCurrency(total, data.currency)}
              </p>
            </div>

            {/* Action zone */}
            {methods.length > 0 ? (
              <div className="border-t border-border px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {methods.includes('card') ? (
                    <Button onClick={onPay} loading={paying || pay.isPending}>
                      <CreditCard className="size-4" /> Pay by card
                    </Button>
                  ) : null}
                  {methods.includes('paypal') && paypalUrl ? (
                    <Button variant="secondary" onClick={() => window.open(paypalUrl, '_blank', 'noopener')}>
                      Pay with PayPal
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : data.payment_instructions ? (
              <div className="border-t border-border px-5 py-4">
                <p className="mb-1.5 text-xs uppercase tracking-wider text-fg-muted">
                  Payment instructions
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-fg">
                  {data.payment_instructions}
                </p>
              </div>
            ) : (
              <div className="border-t border-border px-5 py-4">
                <p className="text-sm text-fg-muted">Contact the sender to arrange payment.</p>
              </div>
            )}
          </div>
        )}

        <PublicInvoiceView data={data} />
      </div>
    </div>
  )
}
