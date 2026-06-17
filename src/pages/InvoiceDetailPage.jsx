import { useParams, useNavigate } from 'react-router-dom'
import { useInvoice } from '@/hooks/useInvoices'
import { Skeleton } from '@/components/ui/Skeleton'
import { InvoiceEditor } from '@/features/invoices/InvoiceEditor'
import { InvoiceActions } from '@/features/invoices/InvoiceActions'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: invoice, isLoading, error } = useInvoice(id)

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !invoice) return <p>Invoice not found. <button onClick={() => navigate('/invoices')} className="text-primary underline">Back</button></p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight tabular-nums">{invoice.invoice_number}</h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InvoiceActions invoice={invoice} />
        </div>
      </div>
      <InvoiceEditor invoice={invoice} />
    </div>
  )
}
