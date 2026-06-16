import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { clientContactCreateSchema } from '@/api/schemas/client-contacts'
import { useCreateContact, useUpdateContact } from '@/hooks/useClientContacts'

export function ContactFormModal({ open, onClose, clientId, contact }) {
  const isEdit = !!contact
  const create = useCreateContact(clientId)
  const update = useUpdateContact(clientId)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientContactCreateSchema),
    defaultValues: {
      client_id: clientId,
      name: contact?.name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      role: contact?.role ?? '',
      is_primary: contact?.is_primary ?? false,
    },
  })

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync({ id: contact.id, patch: values })
      } else {
        await create.mutateAsync(values)
      }
      toast.success(isEdit ? 'Contact updated' : 'Contact added')
      onClose()
    } catch (e) {
      toast.error(e.userMessage || 'Save failed')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit contact' : 'Add contact'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="cname" required>Name</Label>
          <Input id="cname" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cemail">Email</Label>
            <Input id="cemail" type="email" {...register('email')} />
          </div>
          <div>
            <Label htmlFor="cphone">Phone</Label>
            <Input id="cphone" {...register('phone')} />
          </div>
        </div>
        <div>
          <Label htmlFor="crole">Role</Label>
          <Input id="crole" placeholder="e.g. CTO, Accounts Payable" {...register('role')} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_primary')} />
          Primary contact
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save' : 'Add'}</Button>
        </div>
      </form>
    </Modal>
  )
}
