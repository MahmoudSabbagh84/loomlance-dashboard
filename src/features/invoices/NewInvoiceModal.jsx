import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { useCreateInvoice, useNextInvoiceNumber } from '@/hooks/useInvoices'
import { useProjects } from '@/hooks/useProjects'

// Pick the client (and optional project) explicitly at creation. Previously a new invoice
// silently defaulted to the first client, so an unsaved editor left it bound to client #1
// (and the Send "To" inherited that wrong email).
export function NewInvoiceModal({ open, onClose, clients, profile, onCreated }) {
  const create = useCreateInvoice()
  const nextNum = useNextInvoiceNumber()
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [error, setError] = useState('')
  const { data: projects = [] } = useProjects({ clientId: clientId || undefined, status: 'all' })

  const reset = () => {
    setClientId('')
    setProjectId('')
    setError('')
  }
  const handleClose = () => {
    reset()
    onClose()
  }

  const onConfirm = async () => {
    if (!clientId) {
      setError('Select a client')
      return
    }
    try {
      const number = await nextNum.refetch().then((r) => r.data)
      const inv = await create.mutateAsync({
        client_id: clientId,
        project_id: projectId || null,
        invoice_number: number,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        currency: profile?.default_currency || 'USD',
        payment_instructions: profile?.default_payment_instructions || '',
        line_items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, position: 0 }],
      })
      reset()
      onCreated(inv.id)
    } catch (e) {
      toast.error(e.userMessage || 'Could not create draft invoice')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="New invoice" size="md">
      <div className="space-y-4">
        <div>
          <Label htmlFor="new-invoice-client" required>Client</Label>
          <Select
            id="new-invoice-client"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setProjectId('')
              setError('')
            }}
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <FieldError>{error}</FieldError>
        </div>
        <div>
          <Label htmlFor="new-invoice-project">Project (optional)</Label>
          <Select
            id="new-invoice-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!clientId}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={onConfirm} loading={create.isPending}>Create draft</Button>
        </div>
      </div>
    </Modal>
  )
}
