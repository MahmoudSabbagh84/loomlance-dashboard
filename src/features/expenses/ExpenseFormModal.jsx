import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useProjects } from '@/hooks/useProjects'
import { useClients } from '@/hooks/useClients'
import { useProfile } from '@/hooks/useProfile'
import { useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses'
import { uploadReceipt, removeReceipt } from '@/api/expenses'
import { EXPENSE_CATEGORIES } from '@/lib/expenses'

export function ExpenseFormModal({ open, onClose, expense }) {
  const { data: projects = [] } = useProjects({ status: 'all' })
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const { data: profile } = useProfile()
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const isEdit = !!expense
  const [file, setFile] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      spent_on: (expense?.spent_on ?? new Date().toISOString()).slice(0, 10),
      amount: expense?.amount ?? '',
      currency: expense?.currency ?? profile?.default_currency ?? 'USD',
      category: expense?.category ?? 'Software',
      description: expense?.description ?? '',
      project_id: expense?.project_id ?? '',
      client_id: expense?.client_id ?? '',
      billable: expense?.billable ?? false,
    },
  })

  const onSubmit = async (v) => {
    const amount = Number(v.amount)
    if (!(amount >= 0) || v.amount === '') {
      toast.error('Enter an amount')
      return
    }
    if (!v.category.trim()) {
      toast.error('Pick a category')
      return
    }
    try {
      let receiptPath = expense?.receipt_path ?? null
      if (file) {
        if (isEdit && expense?.receipt_path) await removeReceipt(expense.receipt_path)
        receiptPath = await uploadReceipt(file)
      }
      const payload = {
        spent_on: v.spent_on,
        amount,
        currency: v.currency.trim() || 'USD',
        category: v.category.trim(),
        description: v.description,
        project_id: v.project_id || null,
        client_id: v.client_id || null,
        billable: v.billable,
        receipt_path: receiptPath,
      }
      if (isEdit) {
        await update.mutateAsync({ id: expense.id, patch: payload })
      } else {
        await create.mutateAsync(payload)
      }
      toast.success(isEdit ? 'Expense updated' : 'Expense added')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not save')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit expense' : 'Add expense'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="spent_on">Date</Label>
            <Input id="spent_on" type="date" {...register('spent_on')} />
          </div>
          <div>
            <Label htmlFor="amount" required>Amount</Label>
            <Input id="amount" type="number" step="0.01" min="0" {...register('amount')} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" {...register('currency')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category" required>Category</Label>
            <Input id="category" list="expense-categories" {...register('category', { required: true })} />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" {...register('billable')} /> Billable to client
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="project_id">Project</Label>
            <Select id="project_id" {...register('project_id')}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="client_id">Client</Label>
            <Select id="client_id" {...register('client_id')}>
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={2} {...register('description')} />
        </div>
        <div>
          <Label htmlFor="receipt">Receipt {isEdit && expense?.receipt_path ? '(replaces existing)' : '(optional)'}</Label>
          <Input
            id="receipt"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Add expense'}</Button>
        </div>
      </form>
    </Modal>
  )
}
