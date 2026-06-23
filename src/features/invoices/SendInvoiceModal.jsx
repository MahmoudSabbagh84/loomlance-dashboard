import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { EmailChips } from '@/components/ui/EmailChips'
import { useSendInvoice } from '@/hooks/useInvoices'
import { useProfile } from '@/hooks/useProfile'
import { useClientContacts } from '@/hooks/useClientContacts'
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
  const clientId = invoice.client_id || client?.id
  const { data: contacts = [] } = useClientContacts(clientId)

  const [submitting, setSubmitting] = useState(false)
  const [to, setTo] = useState(client?.email ? [client.email] : [])
  const [cc, setCc] = useState([])
  const [subject, setSubject] = useState(`Invoice ${invoice.invoice_number}`)
  const [body, setBody] = useState(
    `Hi ${client?.name || ''},\n\nHere's invoice ${invoice.invoice_number}. You can view and pay it online using the secure link below.\n\nThank you.`
  )
  const [attachPdf, setAttachPdf] = useState(false)

  // Additional contacts (people under this client) that aren't already a recipient.
  const inUse = (email) => [...to, ...cc].some((e) => e.toLowerCase() === email.toLowerCase())
  const suggestions = contacts.filter((c) => c.email && !inUse(c.email))

  const onConfirm = async () => {
    if (emailIsReal && to.length === 0) {
      toast.error('Add at least one recipient in the To field.')
      return
    }
    setSubmitting(true)
    try {
      if (emailIsReal) {
        // Anyone in both To and Cc → keep only in To.
        const ccClean = cc.filter((e) => !to.some((t) => t.toLowerCase() === e.toLowerCase()))
        let pdfBase64
        if (attachPdf) {
          const { buildInvoiceBlob } = await import('./InvoicePDF')
          const blob = await buildInvoiceBlob({ invoice, client, profile })
          pdfBase64 = await blobToBase64(blob)
        }
        await invokeEdge('send-invoice', {
          invoiceId: invoice.id,
          to,
          cc: ccClean,
          subject,
          body,
          ...(pdfBase64 ? { pdfBase64 } : {}),
        })
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
            ? 'This emails the recipients a secure pay-online link. They can view and download the PDF from that page.'
            : 'Email delivery is simulated for now — confirming will mark the invoice sent and give you a shareable link to send manually.'}
        </p>

        {emailIsReal ? (
          <>
            <div>
              <Label htmlFor="to">To</Label>
              <EmailChips id="to" aria-label="To recipients" value={to} onChange={setTo} />
            </div>
            <div>
              <Label htmlFor="cc">Cc</Label>
              <EmailChips id="cc" aria-label="Cc recipients" value={cc} onChange={setCc} placeholder="Add a Cc…" />
              {suggestions.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-fg-muted">Add a contact:</span>
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCc((prev) => [...prev, c.email])}
                      title={c.email}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                    >
                      <Plus className="size-3" /> {c.name || c.email}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

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
          <Button onClick={onConfirm} loading={submitting || send.isPending} disabled={emailIsReal && to.length === 0}>
            {emailIsReal ? 'Send invoice' : 'Mark as sent'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
