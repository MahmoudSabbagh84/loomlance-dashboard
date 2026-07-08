import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useCreateChangeRequest } from '@/hooks/useChangeRequests'
import { deriveAmount } from '@/lib/changeRequest'
import { formatCurrency } from '@/lib/currency'

const EMPTY = { title: '', description: '', amount: '', hours: '', hourly_rate: '', added_days: '' }

export function ChangeRequestModal({ open, project, onClose }) {
  const create = useCreateChangeRequest()
  const [form, setForm] = useState(EMPTY)
  const currency = project.budget_currency || 'USD'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const num = (v) => (v === '' || v == null ? null : Number(v))
  const effectiveAmount = deriveAmount({
    amount: num(form.amount),
    hours: num(form.hours),
    hourly_rate: num(form.hourly_rate),
  })

  const submit = () => {
    if (!form.title.trim()) return toast.error('Title is required')
    if (!(effectiveAmount > 0)) return toast.error('Enter an amount, or hours and a rate')
    create.mutate(
      {
        project_id: project.id,
        client_id: project.client_id,
        title: form.title.trim(),
        description: form.description.trim(),
        currency,
        amount: effectiveAmount,
        hours: num(form.hours),
        hourly_rate: num(form.hourly_rate),
        added_days: num(form.added_days),
      },
      {
        onSuccess: () => {
          toast.success('Change request created')
          setForm(EMPTY)
          onClose()
        },
        onError: (e) => toast.error(e.userMessage || e.message),
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="New change request">
      <div className="space-y-4">
        <div>
          <Label htmlFor="cr-title" required>Title</Label>
          <Input id="cr-title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Extra API endpoints" />
        </div>
        <div>
          <Label htmlFor="cr-desc">What's changing</Label>
          <Textarea id="cr-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe the out-of-scope work the client is approving." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cr-hours">Hours (optional)</Label>
            <Input id="cr-hours" type="number" min="0" value={form.hours} onChange={(e) => set('hours', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cr-rate">Rate (optional)</Label>
            <Input id="cr-rate" type="number" min="0" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cr-amount">Amount</Label>
            <Input id="cr-amount" type="number" min="0"
              value={num(form.hours) != null && num(form.hourly_rate) != null ? effectiveAmount : form.amount}
              onChange={(e) => set('amount', e.target.value)}
              disabled={num(form.hours) != null && num(form.hourly_rate) != null} />
          </div>
          <div>
            <Label htmlFor="cr-days">Added days (optional)</Label>
            <Input id="cr-days" type="number" min="0" value={form.added_days} onChange={(e) => set('added_days', e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-fg-muted">
          Client will be billed <span className="font-semibold text-fg">{formatCurrency(effectiveAmount, currency)}</span>
          {num(form.hours) != null && num(form.hourly_rate) != null ? ` (${form.hours}h × ${formatCurrency(num(form.hourly_rate), currency)})` : ''}.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} onClick={submit}>Create</Button>
        </div>
      </div>
    </Modal>
  )
}
