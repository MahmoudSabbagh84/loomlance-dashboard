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
import { projectCreateSchema } from '@/api/schemas/projects'
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects'
import { useClients } from '@/hooks/useClients'

export function ProjectFormModal({ open, onClose, project, defaultClientId }) {
  const isEdit = !!project
  const create = useCreateProject()
  const update = useUpdateProject()
  const { data: clientsPage } = useClients({ pageSize: 200 })
  const clients = clientsPage?.rows ?? []

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      client_id: project?.client_id ?? defaultClientId ?? '',
      name: project?.name ?? '',
      description: project?.description ?? '',
      color: project?.color ?? '#2D3E50',
    },
  })

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: project.id, patch: values })
        toast.success('Project updated')
      } else {
        await create.mutateAsync(values)
        toast.success('Project created')
      }
      onClose()
    } catch (e) {
      if (e.code === 'PROJECT_LIMIT_EXCEEDED') {
        toast.error(e.userMessage)
      } else {
        toast.error(e.userMessage || 'Save failed')
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit project' : 'New project'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Label htmlFor="color">Accent color</Label>
          <input id="color" type="color" {...register('color')} className="h-10 w-20 rounded border border-border" />
          <FieldError>{errors.color?.message}</FieldError>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
