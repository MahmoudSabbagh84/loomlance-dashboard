import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useUser } from '@/hooks/useAuth'
import { updatePassword } from '@/api/auth'

const profileSchema = z.object({
  display_name: z.string().min(1, 'Required').max(120),
})

const passwordSchema = z
  .object({
    new_password: z.string().min(8, 'Min 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, { message: 'Must match', path: ['confirm'] })

export function AccountTab() {
  const { data: profile } = useProfile()
  const { user } = useUser()
  const update = useUpdateProfile()
  const [pwSubmitting, setPwSubmitting] = useState(false)

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: { display_name: profile?.display_name ?? '' },
  })
  const pwForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { new_password: '', confirm: '' },
  })

  const onProfile = async (values) => {
    try {
      await update.mutateAsync(values)
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e.userMessage ?? 'Could not update profile')
    }
  }

  const onPassword = async ({ new_password }) => {
    setPwSubmitting(true)
    try {
      await updatePassword(new_password)
      toast.success('Password updated')
      pwForm.reset()
    } catch (e) {
      toast.error(e.userMessage ?? 'Could not update password')
    } finally {
      setPwSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card as="form" onSubmit={profileForm.handleSubmit(onProfile)} className="space-y-4">
        <h3 className="text-sm font-semibold">Display name</h3>
        <div>
          <Label htmlFor="display_name">Name</Label>
          <Input id="display_name" {...profileForm.register('display_name')} />
          <FieldError>{profileForm.formState.errors.display_name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ''} readOnly disabled />
          <p className="mt-1 text-xs text-fg-muted">Contact support to change your email.</p>
        </div>
        <Button type="submit" loading={profileForm.formState.isSubmitting}>
          Save changes
        </Button>
      </Card>

      <Card as="form" onSubmit={pwForm.handleSubmit(onPassword)} className="space-y-4">
        <h3 className="text-sm font-semibold">Change password</h3>
        <div>
          <Label htmlFor="new_password">New password</Label>
          <Input id="new_password" type="password" autoComplete="new-password" {...pwForm.register('new_password')} />
          <FieldError>{pwForm.formState.errors.new_password?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" {...pwForm.register('confirm')} />
          <FieldError>{pwForm.formState.errors.confirm?.message}</FieldError>
        </div>
        <Button type="submit" loading={pwSubmitting}>
          Update password
        </Button>
      </Card>
    </div>
  )
}
