import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useSendInvoice } from '@/hooks/useInvoices'

export function SendInvoiceModal({ open, onClose, invoice }) {
  const send = useSendInvoice()
  const client = invoice.clients
  const [to, setTo] = useState(client?.email || '')
  const [subject, setSubject] = useState(`Invoice ${invoice.invoice_number}`)
  const [body, setBody] = useState(
    `Hi ${client?.name || ''},\n\nPlease find invoice ${invoice.invoice_number} attached. You can view and pay it online via the link below.\n\nThank you.`
  )

  const onConfirm = async () => {
    try {
      await send.mutateAsync(invoice.id)
      toast.success('Invoice marked as sent')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not send invoice')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send invoice" size="lg">
      <div className="space-y-4">
        <p className="rounded-md bg-bg-muted px-3 py-2 text-xs text-fg-muted">
          Email delivery is simulated for now — confirming will mark the invoice sent and give you a shareable link to
          send manually.
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
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={send.isPending}>
            Mark as sent
          </Button>
        </div>
      </div>
    </Modal>
  )
}
