import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { useProfile } from '@/hooks/useProfile'
import { useSetProjectBudget } from '@/hooks/useProjectFinancials'

export function BudgetModal({ open, onClose, project }) {
  const { data: profile } = useProfile()
  const setBudget = useSetProjectBudget(project.id)
  const isAdjust = project.budget_amount != null
  const [amount, setAmount] = useState(project.budget_amount != null ? String(project.budget_amount) : '')
  const [currency, setCurrency] = useState(project.budget_currency || profile?.default_currency || 'USD')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const onSave = async () => {
    const n = Number(amount)
    if (amount === '' || Number.isNaN(n) || n < 0) {
      setError('Enter a budget amount of 0 or more.')
      return
    }
    try {
      await setBudget.mutateAsync({ projectId: project.id, amount: n, currency, note })
      toast.success(isAdjust ? 'Budget updated' : 'Budget set')
      setNote('')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not save budget')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isAdjust ? 'Adjust budget' : 'Set a budget'} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <Label htmlFor="budget-amount" required>Amount</Label>
            <Input
              id="budget-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError('')
              }}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="budget-currency">Currency</Label>
            <Select id="budget-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <div>
          <Label htmlFor="budget-note">
            Note <span className="font-normal text-fg-subtle">· optional</span>
          </Label>
          <Textarea
            id="budget-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. scope increase — added a second milestone"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={setBudget.isPending}>
            {isAdjust ? 'Save changes' : 'Set budget'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
