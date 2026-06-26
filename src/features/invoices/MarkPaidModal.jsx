import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { paymentCreateSchema } from '@/api/schemas/invoice-payments'
import { useCreatePayment, useInvoicePayments } from '@/hooks/useInvoicePayments'
import { useUpdateInvoice } from '@/hooks/useInvoices'
import { invoiceTotals } from '@/lib/money'
import { formatCurrency } from '@/lib/currency'

const round2 = (n) => Math.round(n * 100) / 100

export function MarkPaidModal({ open, onClose, invoice }) {
  const { data: payments, isLoading } = useInvoicePayments(invoice.id)
  const paymentsReady = !isLoading && payments !== undefined

  const total = invoiceTotals(invoice.invoice_line_items || []).total
  const alreadyPaid = round2((payments ?? []).reduce((s, p) => s + Number(p.amount), 0))
  const balance = round2(total - alreadyPaid)

  return (
    <Modal open={open} onClose={onClose} title="Record payment" size="sm">
      {paymentsReady ? (
        <MarkPaidForm
          invoice={invoice}
          onClose={onClose}
          total={total}
          alreadyPaid={alreadyPaid}
          balance={balance}
        />
      ) : (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-fg-muted">
          <Loader2 className="size-4 animate-spin" />
          Loading payment details…
        </div>
      )}
    </Modal>
  )
}

// Form mounts only after payments are loaded, so `balance` is the correct mount-time
// default for the amount field — no async setValue, no race against user input.
function MarkPaidForm({ invoice, onClose, total, alreadyPaid, balance }) {
  const create = useCreatePayment(invoice.id)
  const update = useUpdateInvoice()

  const { register, handleSubmit, formState: { isSubmitting, errors }, setError } = useForm({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: {
      invoice_id: invoice.id,
      amount: balance,
      currency: invoice.currency,
      paid_at: new Date().toISOString().slice(0, 10),
      method: 'bank',
      notes: '',
    },
  })

  const onSubmit = async (values) => {
    if (Number(values.amount) > balance + 0.005) {
      setError('amount', { message: `Cannot exceed balance of ${formatCurrency(balance, invoice.currency)}` })
      return
    }
    try {
      await create.mutateAsync({
        ...values,
        amount: Number(values.amount),
        paid_at: new Date(values.paid_at).toISOString(),
      })
      const paidAfter = round2(alreadyPaid + Number(values.amount))
      const fullyPaid = paidAfter >= total - 0.005
      await update.mutateAsync({
        id: invoice.id,
        patch: {
          status: fullyPaid ? 'paid' : 'partially_paid',
          paid_at: fullyPaid ? new Date().toISOString() : null,
        },
      })
      toast.success(fullyPaid ? 'Invoice marked as paid' : 'Partial payment recorded')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Failed to record payment')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

      {/* Payment breakdown — total / already paid / balance due */}
      <div className="rounded-md border border-border bg-bg-muted px-3 py-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-fg-muted">Invoice total</span>
          <span className="tabular-nums text-fg">{formatCurrency(total, invoice.currency)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-fg-muted">Already paid</span>
          <span className="tabular-nums text-fg-muted">{formatCurrency(alreadyPaid, invoice.currency)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="font-medium text-fg">Balance due</span>
          <span className="tabular-nums font-semibold text-fg">{formatCurrency(balance, invoice.currency)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="amount" required>Amount to record</Label>
          <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          {errors.amount ? (
            <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
          ) : null}
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
  )
}
