import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useProjects } from '@/hooks/useProjects'
import { useProfile } from '@/hooks/useProfile'
import { useTaggableContracts } from '@/hooks/useContracts'
import { useCreateManualEntry, useUpdateEntry } from '@/hooks/useTimeEntries'

export function TimeEntryFormModal({ open, onClose, entry }) {
  const { data: projects = [] } = useProjects({ status: 'all' })
  const { data: profile } = useProfile()
  const create = useCreateManualEntry()
  const update = useUpdateEntry()
  const isEdit = !!entry
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      project_id: entry?.project_id ?? '',
      contract_id: entry?.contract_id ?? '',
      date: (entry?.started_at ?? new Date().toISOString()).slice(0, 10),
      hours: entry ? Math.floor((entry.duration_minutes ?? 0) / 60) : 0,
      minutes: entry ? (entry.duration_minutes ?? 0) % 60 : 0,
      description: entry?.description ?? '',
      billable: entry?.billable ?? true,
      hourly_rate: entry?.hourly_rate ?? profile?.default_hourly_rate ?? '',
    },
  })

  const projectId = watch('project_id')
  const contractId = watch('contract_id')
  const clientId = projects.find((p) => p.id === projectId)?.client_id
  const { data: contracts = [] } = useTaggableContracts(projectId, clientId)

  const onContractChange = (e) => {
    const id = e.target.value
    setValue('contract_id', id, { shouldDirty: true })
    const c = contracts.find((x) => x.id === id)
    if (c && c.hourly_rate != null) setValue('hourly_rate', c.hourly_rate, { shouldDirty: true })
  }

  const onSubmit = async (v) => {
    const durationMinutes = Number(v.hours) * 60 + Number(v.minutes)
    if (durationMinutes <= 0) {
      toast.error('Enter a duration')
      return
    }
    const hourlyRate = v.hourly_rate === '' ? null : Number(v.hourly_rate)
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: entry.id,
          patch: { project_id: v.project_id, contract_id: v.contract_id || null, description: v.description, billable: v.billable, hourly_rate: hourlyRate, duration_minutes: durationMinutes },
        })
      } else {
        await create.mutateAsync({
          projectId: v.project_id,
          contractId: v.contract_id || null,
          date: v.date,
          durationMinutes,
          description: v.description,
          billable: v.billable,
          hourlyRate,
        })
      }
      toast.success(isEdit ? 'Entry updated' : 'Time logged')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not save')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit entry' : 'Log time'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="project_id" required>
              Project
            </Label>
            <Select
              id="project_id"
              value={projectId ?? ''}
              onChange={(e) => { setValue('project_id', e.target.value, { shouldDirty: true }); setValue('contract_id', '') }}
            >
              <option value="">Select…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="contract_id">Contract (optional)</Label>
            <Select id="contract_id" value={contractId ?? ''} onChange={onContractChange} disabled={!projectId}>
              <option value="">No contract</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div>
            <Label htmlFor="hours">Hours</Label>
            <Input id="hours" type="number" min="0" className="no-spinner" {...register('hours')} />
          </div>
          <div>
            <Label htmlFor="minutes">Minutes</Label>
            <Input id="minutes" type="number" min="0" max="59" className="no-spinner" {...register('minutes')} />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={2} {...register('description')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="hourly_rate">Hourly rate</Label>
            <Input id="hourly_rate" type="number" step="0.01" className="no-spinner" {...register('hourly_rate')} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" {...register('billable')} /> Billable
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save' : 'Log time'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
