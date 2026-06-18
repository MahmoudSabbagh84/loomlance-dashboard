import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, CreditCard, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePublicInvoice, useMockPay } from '@/hooks/usePublicInvoice'
import { PublicInvoiceView } from '@/features/invoices/PublicInvoiceView'

export default function PublicInvoicePage() {
  const { token } = useParams()
  const { data, isLoading, refetch } = usePublicInvoice(token)
  const pay = useMockPay()
  const [paid, setPaid] = useState(false)

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
    try {
      await pay.mutateAsync(token)
      setPaid(true)
      await refetch()
    } catch (e) {
      toast.error(e.userMessage || 'Payment could not be completed')
    }
  }

  const isPaid = paid || data.status === 'paid'

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="LoomLance" className="size-8" />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={download}>
              <Download className="size-4" /> Download PDF
            </Button>
            {data.can_pay && !isPaid ? (
              <Button size="sm" onClick={onPay} loading={pay.isPending}>
                <CreditCard className="size-4" /> Pay now
              </Button>
            ) : null}
          </div>
        </div>
        {isPaid ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> This invoice has been paid. Thank you!
          </div>
        ) : null}
        <PublicInvoiceView data={data} />
      </div>
    </div>
  )
}
