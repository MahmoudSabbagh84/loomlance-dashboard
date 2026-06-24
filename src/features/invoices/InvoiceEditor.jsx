import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { invoiceCreateSchema } from '@/api/schemas/invoices'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { useAutosave } from '@/hooks/useAutosave'
import { updateInvoice } from '@/api/invoices'
import { replaceLineItems } from '@/api/invoice-line-items'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { LineItemsTable } from './LineItemsTable'
import { TotalsPanel } from './TotalsPanel'
import { InvoicePreview } from './InvoicePreview'

// Fields the autosave engine tracks (top-level form keys).
const AUTOSAVE_FIELDS = [
  'client_id', 'project_id', 'invoice_number', 'issue_date', 'due_date',
  'currency', 'notes', 'terms', 'payment_instructions', 'line_items',
]

export function InvoiceEditor({ invoice }) {
  const qc = useQueryClient()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  // Only drafts autosave; sent/paid/void invoices are read-only (a client may already have it).
  const editable = invoice.status === 'draft'

  const defaults = {
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
  }

  const { register, control, watch, setValue, getValues, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(invoiceCreateSchema),
    defaultValues: defaults,
  })
  const selectedClient = watch('client_id')
  const selectedProject = watch('project_id')
  const { data: projects = [] } = useProjects({ clientId: selectedClient, status: 'all' })

  // Persist a validated patch: scalars → updateInvoice; line_items → replaceLineItems.
  const save = async (patch) => {
    const { line_items, ...rest } = patch
    if (Object.keys(rest).length) {
      await updateInvoice(invoice.id, rest)
      qc.setQueryData(['invoices', 'detail', invoice.id], (prev) => {
        if (!prev) return prev
        const next = { ...prev, ...rest }
        // Keep the joined client row in sync when the client changes, so Send
        // (recipient) and Download (PDF) read the NEW client, not the previous one
        // (LOO-6). The clients list holds full rows (select *), matching clients(*).
        if ('client_id' in rest) next.clients = clients.find((c) => c.id === rest.client_id) ?? null
        return next
      })
    }
    if (line_items) {
      const positioned = line_items.map((li, i) => ({ ...li, position: i }))
      await replaceLineItems(invoice.id, positioned)
      // Refresh the detail cache so the Send / Download / PDF path reads the saved
      // line items instead of the stale seed it was loaded with. Without this the
      // editor preview looked correct but invoices went out BLANK.
      qc.setQueryData(['invoices', 'detail', invoice.id], (prev) =>
        prev ? { ...prev, invoice_line_items: positioned } : prev)
    }
    // Keep the list view fresh without thrashing on every keystroke.
    qc.invalidateQueries({ queryKey: ['invoices', 'list'] })
  }

  const { status, retry } = useAutosave({
    watch,
    trigger,
    save,
    fields: AUTOSAVE_FIELDS,
    enabled: editable,
    initial: defaults,
  })

  return (
    <form className="grid gap-6 lg:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-4">
        <div className="flex h-5 items-center justify-end">
          {editable ? (
            <SaveStatus status={status} onRetry={retry} />
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Lock className="size-3.5" /> {invoice.status} — read-only
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client_id" required>Client</Label>
            <Select
              id="client_id"
              value={selectedClient ?? ''}
              disabled={!editable}
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
              disabled={!editable}
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
            <Input id="invoice_number" disabled={!editable} {...register('invoice_number')} />
          </div>
          <div>
            <Label htmlFor="currency" required>Currency</Label>
            <Select id="currency" disabled={!editable} {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="issue_date" required>Issue date</Label>
            <Input id="issue_date" type="date" disabled={!editable} {...register('issue_date')} />
          </div>
          <div>
            <Label htmlFor="due_date" required>Due date</Label>
            <Input id="due_date" type="date" disabled={!editable} {...register('due_date')} />
          </div>
        </div>

        <div>
          <Label>Line items</Label>
          <LineItemsTable
            control={control}
            register={register}
            setValue={setValue}
            getValues={getValues}
            disabled={!editable}
            onItemsChanged={() => setValue('line_items', getValues('line_items'), { shouldDirty: true })}
          />
          <FieldError>{errors.line_items?.message}</FieldError>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} disabled={!editable} {...register('notes')} />
          </div>
          <div>
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" rows={2} disabled={!editable} {...register('terms')} />
          </div>
          <div>
            <Label htmlFor="payment_instructions">Payment instructions</Label>
            <Textarea id="payment_instructions" rows={2} disabled={!editable} {...register('payment_instructions')} />
          </div>
        </div>

        <TotalsPanel control={control} />
      </div>

      <div className="h-fit lg:sticky lg:top-20">
        <InvoicePreview control={control} client={clients.find((c) => c.id === selectedClient)} />
      </div>
    </form>
  )
}
