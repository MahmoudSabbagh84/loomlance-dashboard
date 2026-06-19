import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { useClients } from '@/hooks/useClients'
import { useProfile } from '@/hooks/useProfile'
import { useExpenses, useGenerateInvoiceFromExpenses } from '@/hooks/useExpenses'
import { buildExpenseInvoiceLines } from '@/lib/expenses'
import { formatCurrency } from '@/lib/currency'

export function GenerateExpenseInvoiceModal({ open, onClose }) {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const [clientId, setClientId] = useState('')
  const gen = useGenerateInvoiceFromExpenses()
  const currency = profile?.default_currency || 'USD'
  const { data: expenses = [] } = useExpenses({ status: 'unbilled' })

  const lines = useMemo(() => {
    const eligible = expenses.filter(
      (e) =>
        e.billable &&
        e.currency === currency &&
        (e.client_id === clientId || e.projects?.client_id === clientId),
    )
    return buildExpenseInvoiceLines(eligible)
  }, [expenses, clientId, currency])

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
    <Modal open={open} onClose={onClose} title="Generate invoice from expenses" size="md">
      <div className="space-y-4">
        <div>
          <Label htmlFor="client">Client</Label>
          <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {clientId ? (
          lines.length ? (
            <div className="rounded-md border border-border">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0">
                  <span>{l.description}</span>
                  <span className="tabular-nums">{formatCurrency(l.amount, currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No billable expenses for this client.</p>
          )
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onGenerate} disabled={!clientId || lines.length === 0} loading={gen.isPending}>
            Create draft invoice
          </Button>
        </div>
      </div>
    </Modal>
  )
}
