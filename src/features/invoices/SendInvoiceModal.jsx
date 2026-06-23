import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useSendInvoice } from '@/hooks/useInvoices'
import { useProfile } from '@/hooks/useProfile'
import { invokeEdge } from '@/api/edge'
import { emailIsReal } from '@/lib/providers'

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function SendInvoiceModal({ open, onClose, invoice }) {
  const send = useSendInvoice()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const client = invoice.clients
  const [submitting, setSubmitting] = useState(false)
  const [to, setTo] = useState(client?.email || '')
  const [subject, setSubject] = useState(`Invoice ${invoice.invoice_number}`)
  const [body, setBody] = useState(
    `Hi ${client?.name || ''},\n\nHere's invoice ${invoice.invoice_number}. You can view and pay it online using the secure link below.\n\nThank you.`
  )
  const [attachPdf, setAttachPdf] = useState(false)

  const onConfirm = async () => {
    setSubmitting(true)
    try {
      if (emailIsReal) {
        let pdfBase64
        if (attachPdf) {
          const { buildInvoiceBlob } = await import('./InvoicePDF')
          const blob = await buildInvoiceBlob({ invoice, client, profile })
          pdfBase64 = await blobToBase64(blob)
        }
        await invokeEdge('send-invoice', { invoiceId: invoice.id, to, subject, body, ...(pdfBase64 ? { pdfBase64 } : {}) })
        qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoice.id] })
        qc.invalidateQueries({ queryKey: ['invoices', 'list'] })
        toast.success('Invoice emailed')
      } else {
        await send.mutateAsync(invoice.id)
        toast.success('Invoice marked as sent')
      }
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not send invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send invoice" size="lg">
      <div className="space-y-4">
        <p className="rounded-md bg-bg-muted px-3 py-2 text-xs text-fg-muted">
          {emailIsReal
            ? 'This emails the recipient a secure pay-online link. They can view and download the PDF from that page.'
            : 'Email delivery is simulated for now — confirming will mark the invoice sent and give you a shareable link to send manually.'}
        </p>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="body">Message</Label>
          <Textarea id="body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {emailIsReal ? (
          <label className="flex items-start gap-2.5 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={attachPdf}
              onChange={(e) => setAttachPdf(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Also attach the PDF. Off by default — attachments can trip spam filters; the recipient can always download it from the pay page.</span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={submitting || send.isPending}>
            {emailIsReal ? 'Send invoice' : 'Mark as sent'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
