import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { paymentCreateSchema } from '@/api/schemas/invoice-payments'
import { useCreatePayment } from '@/hooks/useInvoicePayments'
import { useUpdateInvoice } from '@/hooks/useInvoices'
import { invoiceTotals } from '@/lib/money'

export function MarkPaidModal({ open, onClose, invoice }) {
  const create = useCreatePayment(invoice.id)
  const update = useUpdateInvoice()
  const totals = invoiceTotals(invoice.invoice_line_items || [])
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: {
      invoice_id: invoice.id,
      amount: totals.total,
      currency: invoice.currency,
      paid_at: new Date().toISOString().slice(0, 10),
      method: 'bank',
      notes: '',
    },
  })

  const onSubmit = async (values) => {
    try {
      await create.mutateAsync({ ...values, amount: Number(values.amount), paid_at: new Date(values.paid_at).toISOString() })
      await update.mutateAsync({ id: invoice.id, patch: { status: 'paid', paid_at: new Date().toISOString() } })
      toast.success('Invoice marked as paid')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Failed to record payment')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark as paid" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="amount" required>Amount</Label>
            <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="paid_at" required>Paid date</Label>
            <Input id="paid_at" type="date" {...register('paid_at')} />
          </div>
        </div>
        <div>
          <Label htmlFor="method">Method</Label>
          <Select id="method" {...register('method')}>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="paypal">PayPal</option>
            <option value="other">Other</option>
            <option value="manual">Manual</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" {...register('notes')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Record payment</Button>
        </div>
      </form>
    </Modal>
  )
}
