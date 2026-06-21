import { useParams, useNavigate } from 'react-router-dom'
import { useInvoice } from '@/hooks/useInvoices'
import { Skeleton } from '@/components/ui/Skeleton'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { InvoiceEditor } from '@/features/invoices/InvoiceEditor'
import { InvoiceActions } from '@/features/invoices/InvoiceActions'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { ShareLinkPanel } from '@/features/invoices/ShareLinkPanel'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: invoice, isLoading, error } = useInvoice(id)

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !invoice) return <p>Invoice not found. <button onClick={() => navigate('/invoices')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Invoices', to: '/invoices' }, { label: invoice.invoice_number }]} />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight tabular-nums">{invoice.invoice_number}</h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InvoiceActions invoice={invoice} />
        </div>
      </div>
      {invoice.status !== 'draft' ? <ShareLinkPanel invoice={invoice} /> : null}
      <InvoiceEditor invoice={invoice} />
    </div>
  )
}
