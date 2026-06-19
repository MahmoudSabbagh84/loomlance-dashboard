import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { useClients } from '@/hooks/useClients'
import { useProfile } from '@/hooks/useProfile'
import { useTimeEntries, useGenerateInvoiceFromTime } from '@/hooks/useTimeEntries'
import { groupTimeForInvoice } from '@/lib/time'
import { formatCurrency } from '@/lib/currency'

export function GenerateInvoiceModal({ open, onClose }) {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const [clientId, setClientId] = useState('')
  const gen = useGenerateInvoiceFromTime()
  const currency = profile?.default_currency || 'USD'
  const { data: entries = [] } = useTimeEntries({ status: 'unbilled' })

  const groups = useMemo(() => {
    const forClient = entries.filter((e) => e.ended_at && e.billable && e.projects?.client_id === clientId)
    return groupTimeForInvoice(forClient)
  }, [entries, clientId])

  const onGenerate = async () => {
    try {
      const id = await gen.mutateAsync(clientId)
      toast.success('Draft invoice created')
      onClose()
      navigate(`/invoices/${id}`)
    } catch (e) {
      toast.error(e.userMessage || 'Could not generate invoice')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate invoice from time" size="md">
      <div className="space-y-4">
        <div>
          <Label htmlFor="client">Client</Label>
          <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {clientId ? (
          groups.length ? (
            <div className="rounded-md border border-border">
              {groups.map((g) => (
                <div
                  key={`${g.projectId}-${g.rate}`}
                  className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0"
                >
                  <span>
                    {g.projectName} · {g.hours}h @ {formatCurrency(g.rate, currency)}
                  </span>
                  <span className="tabular-nums">{formatCurrency(g.amount, currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No unbilled time for this client.</p>
          )
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onGenerate} disabled={!clientId || groups.length === 0} loading={gen.isPending}>
            Create draft invoice
          </Button>
        </div>
      </div>
    </Modal>
  )
}
