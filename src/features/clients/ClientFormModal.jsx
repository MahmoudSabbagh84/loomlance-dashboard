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
import { clientCreateSchema } from '@/api/schemas/clients'
import { useCreateClient, useUpdateClient } from '@/hooks/useClients'

export function ClientFormModal({ open, onClose, client }) {
  const isEdit = !!client
  const create = useCreateClient()
  const update = useUpdateClient()
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
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

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: client.id, patch: values })
        toast.success('Client updated')
      } else {
        await create.mutateAsync(values)
        toast.success('Client created')
      }
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit client' : 'New client'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}
