import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { TagInput } from '@/components/ui/TagInput'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { clientCreateSchema } from '@/api/schemas/clients'
import { useCreateClient, useUpdateClient } from '@/hooks/useClients'
import { useAutosaveForm } from '@/hooks/useAutosave'

export function ClientFormModal({ open, onClose, client }) {
  const isEdit = !!client
  const create = useCreateClient()
  const update = useUpdateClient()
  const { register, handleSubmit, control, watch, trigger, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      name: client?.name ?? '',
      company: client?.company ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      address: client?.address ?? '',
      notes: client?.notes ?? '',
      tags: client?.tags ?? [],
    },
  })

  // Edit mode autosaves; create stays an explicit step.
  const { status, retry } = useAutosaveForm({
    watch,
    enabled: isEdit,
    commit: async () => {
      if (!(await trigger())) return false
      await update.mutateAsync({ id: client.id, patch: getValues() })
    },
  })

  const onCreate = async (values) => {
    try {
      await create.mutateAsync(values)
      toast.success('Client created')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Could not create client')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit client' : 'New client'} size="lg">
      <form onSubmit={isEdit ? (e) => e.preventDefault() : handleSubmit(onCreate)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" required>Name</Label>
            <Input id="name" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input id="company" {...register('company')} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" rows={2} {...register('address')} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} {...register('notes')} />
        </div>
        <div>
          <Label>Tags</Label>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => <TagInput value={field.value} onChange={field.onChange} />}
          />
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
