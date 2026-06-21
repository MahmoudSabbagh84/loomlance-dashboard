import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { contractCreateSchema } from '@/api/schemas/contracts'
import { useCreateContract, useUpdateContract } from '@/hooks/useContracts'
import { useClients } from '@/hooks/useClients'
import { useProjects } from '@/hooks/useProjects'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { useAutosaveForm } from '@/hooks/useAutosave'

const buildPayload = (values) => ({
  ...values,
  project_id: values.project_id || null,
  value: values.value === '' || values.value == null || Number.isNaN(values.value) ? null : Number(values.value),
  hourly_rate: values.hourly_rate === '' || values.hourly_rate == null || Number.isNaN(values.hourly_rate) ? null : Number(values.hourly_rate),
  start_date: values.start_date || null,
  end_date: values.end_date || null,
})

export function ContractFormModal({ open, onClose, contract, defaultClientId }) {
  const isEdit = !!contract
  const create = useCreateContract()
  const update = useUpdateContract()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []
  const { register, handleSubmit, watch, setValue, trigger, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contractCreateSchema),
    defaultValues: {
      client_id: contract?.client_id ?? defaultClientId ?? '',
      project_id: contract?.project_id ?? null,
      title: contract?.title ?? '',
      description: contract?.description ?? '',
      start_date: contract?.start_date ?? '',
      end_date: contract?.end_date ?? '',
      value: contract?.value ?? null,
      hourly_rate: contract?.hourly_rate ?? null,
      currency: contract?.currency ?? 'USD',
      status: contract?.status ?? 'active',
    },
  })
  const selectedClient = watch('client_id')
  const selectedProject = watch('project_id')
  const { data: projects = [] } = useProjects({ clientId: selectedClient, status: 'all' })

  const { status, retry } = useAutosaveForm({
    watch,
    enabled: isEdit,
    commit: async () => {
      if (!(await trigger())) return false
      await update.mutateAsync({ id: contract.id, patch: buildPayload(getValues()) })
    },
  })

  const onCreate = async (values) => {
    try {
      await create.mutateAsync(buildPayload(values))
      toast.success('Contract created')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not create contract')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit contract' : 'New contract'} size="lg">
      <form onSubmit={isEdit ? (e) => e.preventDefault() : handleSubmit(onCreate)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client_id" required>Client</Label>
            <Select
              id="client_id"
              value={selectedClient ?? ''}
              onChange={(e) => setValue('client_id', e.target.value, { shouldDirty: true, shouldValidate: true })}
            >
              <option value="">Select…</option>
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
        <div>
          <Label htmlFor="title" required>Title</Label>
          <Input id="title" {...register('title')} />
          <FieldError>{errors.title?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} {...register('description')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Start date</Label>
            <Input id="start_date" type="date" {...register('start_date')} />
          </div>
          <div>
            <Label htmlFor="end_date">End date</Label>
            <Input id="end_date" type="date" {...register('end_date')} />
            <FieldError>{errors.end_date?.message}</FieldError>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="value">Value</Label>
            <Input id="value" type="number" step="0.01" className="no-spinner" {...register('value', { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="hourly_rate">Hourly rate</Label>
            <Input id="hourly_rate" type="number" step="0.01" className="no-spinner" {...register('hourly_rate', { valueAsNumber: true })} />
            <p className="mt-1 text-xs text-fg-subtle">Pre-fills the rate when time is tagged to this contract.</p>
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register('status')}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="canceled">Canceled</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <div>{isEdit ? <SaveStatus status={status} onRetry={retry} /> : null}</div>
          {isEdit ? (
            <Button type="button" onClick={onClose}>Done</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={isSubmitting}>Create</Button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}
