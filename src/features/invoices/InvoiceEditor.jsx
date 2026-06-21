import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { invoiceCreateSchema } from '@/api/schemas/invoices'
import { useUpdateInvoice, useReplaceLineItems } from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { LineItemsTable } from './LineItemsTable'
import { TotalsPanel } from './TotalsPanel'
import { InvoicePreview } from './InvoicePreview'

export function InvoiceEditor({ invoice }) {
  const update = useUpdateInvoice()
  const replaceLines = useReplaceLineItems()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []

  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(invoiceCreateSchema),
    defaultValues: {
      client_id: invoice.client_id,
      project_id: invoice.project_id,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      currency: invoice.currency,
      notes: invoice.notes ?? '',
      terms: invoice.terms ?? '',
      payment_instructions: invoice.payment_instructions ?? '',
      line_items: (invoice.invoice_line_items || []).sort((a, b) => a.position - b.position).map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
        tax_rate: Number(li.tax_rate),
        discount_rate: Number(li.discount_rate),
        position: li.position,
      })),
    },
  })
  const selectedClient = watch('client_id')
  const selectedProject = watch('project_id')
  const { data: projects = [] } = useProjects({ clientId: selectedClient, status: 'all' })

  const onSubmit = async (values) => {
    try {
      const { line_items, ...rest } = values
      rest.project_id = rest.project_id || null
      await update.mutateAsync({ id: invoice.id, patch: rest })
      await replaceLines.mutateAsync({ invoiceId: invoice.id, items: line_items.map((li, i) => ({ ...li, position: i })) })
      toast.success('Invoice saved')
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client_id" required>Client</Label>
            <Select
              id="client_id"
              value={selectedClient ?? ''}
              onChange={(e) => setValue('client_id', e.target.value, { shouldDirty: true, shouldValidate: true })}
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <FieldError>{errors.client_id?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="project_id">Project (optional)</Label>
            <Select
              id="project_id"
              value={selectedProject ?? ''}
              onChange={(e) => setValue('project_id', e.target.value, { shouldDirty: true })}
            >
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="invoice_number" required>Number</Label>
            <Input id="invoice_number" {...register('invoice_number')} />
          </div>
          <div>
            <Label htmlFor="currency" required>Currency</Label>
            <Select id="currency" {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="issue_date" required>Issue date</Label>
            <Input id="issue_date" type="date" {...register('issue_date')} />
          </div>
          <div>
            <Label htmlFor="due_date" required>Due date</Label>
            <Input id="due_date" type="date" {...register('due_date')} />
          </div>
        </div>

        <div>
          <Label>Line items</Label>
          <LineItemsTable control={control} register={register} setValue={setValue} getValues={getValues} />
          <FieldError>{errors.line_items?.message}</FieldError>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>
          <div>
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" rows={2} {...register('terms')} />
          </div>
          <div>
            <Label htmlFor="payment_instructions">Payment instructions</Label>
            <Textarea id="payment_instructions" rows={2} {...register('payment_instructions')} />
          </div>
        </div>

        <TotalsPanel control={control} />

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save</Button>
        </div>
      </div>

      <div className="h-fit lg:sticky lg:top-20">
        <InvoicePreview control={control} client={clients.find((c) => c.id === selectedClient)} />
      </div>
    </form>
  )
}
