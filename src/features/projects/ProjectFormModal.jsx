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
import { ColorPicker } from '@/components/ui/ColorPicker'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { PROJECT_COLORS } from '@/lib/colors'
import { projectCreateSchema } from '@/api/schemas/projects'
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects'
import { useClients } from '@/hooks/useClients'
import { useAutosaveForm } from '@/hooks/useAutosave'

export function ProjectFormModal({ open, onClose, project, defaultClientId }) {
  const isEdit = !!project
  const create = useCreateProject()
  const update = useUpdateProject()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []

  const { register, handleSubmit, watch, setValue, trigger, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      client_id: project?.client_id ?? defaultClientId ?? '',
      name: project?.name ?? '',
      description: project?.description ?? '',
      color: project?.color ?? PROJECT_COLORS[0],
    },
  })

  const { status, retry } = useAutosaveForm({
    watch,
    enabled: isEdit,
    commit: async () => {
      if (!(await trigger())) return false
      await update.mutateAsync({ id: project.id, patch: getValues() })
    },
  })

  const onCreate = async (values) => {
    try {
      await create.mutateAsync(values)
      toast.success('Project created')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not create project')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit project' : 'New project'} size="md">
      <form onSubmit={isEdit ? (e) => e.preventDefault() : handleSubmit(onCreate)} className="space-y-4">
        <div>
          <Label htmlFor="client_id" required>Client</Label>
          <Select
            id="client_id"
            value={watch('client_id') ?? ''}
            onChange={(e) => setValue('client_id', e.target.value, { shouldDirty: true, shouldValidate: true })}
          >
            <option value="">Select a client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <FieldError>{errors.client_id?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="name" required>Name</Label>
          <Input id="name" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...register('description')} />
        </div>
        <div>
          <Label>Accent color</Label>
          <ColorPicker value={watch('color')} onChange={(c) => setValue('color', c, { shouldDirty: true })} />
          <FieldError>{errors.color?.message}</FieldError>
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
