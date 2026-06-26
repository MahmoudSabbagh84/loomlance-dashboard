import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, CheckCircle2, Ban, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUpdateInvoice, useDuplicateInvoice, useDeleteInvoice } from '@/hooks/useInvoices'
import { MarkPaidModal } from './MarkPaidModal'
import { InvoiceDownloadButton } from './InvoiceDownloadButton'
import { SendInvoiceModal } from './SendInvoiceModal'

export function InvoiceActions({ invoice }) {
  const navigate = useNavigate()
  const update = useUpdateInvoice()
  const dup = useDuplicateInvoice()
  const del = useDeleteInvoice()
  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canMarkSent = invoice.status === 'draft'
  const canMarkPaid = ['sent', 'viewed', 'overdue', 'partially_paid'].includes(invoice.status)
  const canVoid = ['sent', 'viewed', 'overdue'].includes(invoice.status)
  const canDelete = invoice.status === 'draft'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InvoiceDownloadButton invoice={invoice} />
      {canMarkSent ? (
        <Button size="sm" onClick={() => setSendOpen(true)}>
          <Send className="size-4" /> Send
        </Button>
      ) : null}
      {canMarkPaid ? (
        <Button size="sm" onClick={() => setMarkPaidOpen(true)}><CheckCircle2 className="size-4" /> Record payment</Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        loading={dup.isPending}
        onClick={async () => {
          try { const inv = await dup.mutateAsync(invoice.id); toast.success('Duplicated'); navigate(`/invoices/${inv.id}`) }
          catch (e) { toast.error(e.userMessage) }
        }}
      >
        <Copy className="size-4" /> Duplicate
      </Button>
      {canVoid ? (
        <Button size="sm" variant="secondary" onClick={() => setConfirmVoid(true)}><Ban className="size-4" /> Void</Button>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</Button>
      ) : null}

      {markPaidOpen ? <MarkPaidModal open onClose={() => setMarkPaidOpen(false)} invoice={invoice} /> : null}
      {sendOpen ? <SendInvoiceModal open onClose={() => setSendOpen(false)} invoice={invoice} /> : null}

      <ConfirmDialog
        open={confirmVoid}
        title="Void this invoice?"
        body="Voiding marks it canceled but preserves the invoice number for your records. This cannot be undone."
        confirmLabel="Void"
        variant="danger"
        onCancel={() => setConfirmVoid(false)}
        onConfirm={async () => {
          try { await update.mutateAsync({ id: invoice.id, patch: { status: 'void' } }); toast.success('Invoice voided'); setConfirmVoid(false) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={update.isPending}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft?"
        body="Draft invoices can be deleted. Sent or paid invoices must be voided instead."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try { await del.mutateAsync(invoice.id); toast.success('Deleted'); navigate('/invoices', { replace: true }) }
          catch (e) { toast.error(e.userMessage) }
        }}
        loading={del.isPending}
      />
    </div>
  )
}
