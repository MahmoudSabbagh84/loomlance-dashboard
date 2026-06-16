import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import * as auth from '@/api/auth'

const schema = z.object({
  password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords must match', path: ['confirm'] })

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ password }) => {
    setSubmitting(true)
    try {
      await auth.updatePassword(password)
      toast.success('Password updated')
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(e.userMessage || 'Failed to update password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-md rounded-lg border border-border bg-bg-elevated p-6">
        <h1 className="text-xl font-semibold mb-6">Set a new password</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="password" required>New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="confirm" required>Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
            <FieldError>{errors.confirm?.message}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={submitting}>Update password</Button>
        </form>
      </div>
    </div>
  )
}
