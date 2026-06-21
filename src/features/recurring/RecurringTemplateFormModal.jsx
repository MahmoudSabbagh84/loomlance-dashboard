import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { LineItemsTable } from '@/features/invoices/LineItemsTable'
import { TotalsPanel } from '@/features/invoices/TotalsPanel'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/useRecurringTemplates'
import { CADENCES, validateTemplateLineItems } from '@/lib/recurring'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'

const EMPTY_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0 }

export function RecurringTemplateFormModal({ open, onClose, template }) {
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const { data: projects = [] } = useProjects({ status: 'all' })
  const { data: profile } = useProfile()
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const isEdit = !!template

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      title: template?.title ?? '',
      client_id: template?.client_id ?? '',
      project_id: template?.project_id ?? '',
      currency: template?.currency ?? profile?.default_currency ?? 'USD',
      cadence: template?.cadence ?? 'monthly',
      next_run_at: (template?.next_run_at ?? new Date().toISOString()).slice(0, 10),
      end_date: template?.end_date ?? '',
      due_days: template?.due_days ?? 30,
      notes: template?.notes ?? '',
      line_items: template?.line_items?.length
        ? template.line_items.map((li) => ({
            description: li.description ?? '',
            quantity: Number(li.quantity ?? 1),
            unit_price: Number(li.unit_price ?? 0),
            tax_rate: Number(li.tax_rate ?? 0),
            discount_rate: Number(li.discount_rate ?? 0),
          }))
        : [{ ...EMPTY_LINE }],
    },
  })

  const onSubmit = async (v) => {
    const line_items = (v.line_items || []).map((li) => ({
      description: li.description,
      quantity: Number(li.quantity) || 0,
      unit_price: Number(li.unit_price) || 0,
      tax_rate: Number(li.tax_rate) || 0,
      discount_rate: Number(li.discount_rate) || 0,
    }))
    try {
      validateTemplateLineItems(line_items)
    } catch (e) {
      toast.error(e.userMessage || 'Check the line items')
      return
    }
    if (!v.client_id) {
      toast.error('Pick a client')
      return
    }
    const payload = {
      title: v.title,
      client_id: v.client_id,
      project_id: v.project_id || null,
      currency: v.currency,
      cadence: v.cadence,
      next_run_at: v.next_run_at,
      end_date: v.end_date || null,
      due_days: Number(v.due_days) || 30,
      notes: v.notes,
      line_items,
      active: template?.active ?? true,
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: template.id, patch: payload })
      } else {
        await create.mutateAsync(payload)
      }
      toast.success(isEdit ? 'Template updated' : 'Template created')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not save')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit recurring template' : 'New recurring template'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="e.g. Acme monthly retainer" {...register('title')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="client_id" required>Client</Label>
            <Select id="client_id" {...register('client_id', { required: true })}>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="project_id">Project (optional)</Label>
            <Select id="project_id" {...register('project_id')}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="cadence">Cadence</Label>
            <Select id="cadence" {...register('cadence')}>
              {CADENCES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="next_run_at">Starts on</Label>
            <Input id="next_run_at" type="date" {...register('next_run_at')} />
          </div>
          <div>
            <Label htmlFor="end_date">End date</Label>
            <Input id="end_date" type="date" {...register('end_date')} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="due_days">Due in (days)</Label>
            <Input id="due_days" type="number" min="0" {...register('due_days')} />
          </div>
        </div>
        <div>
          <Label>Line items</Label>
          <LineItemsTable control={control} register={register} setValue={setValue} getValues={getValues} />
        </div>
        <TotalsPanel control={control} />
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} {...register('notes')} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create template'}</Button>
        </div>
      </form>
    </Modal>
  )
}
