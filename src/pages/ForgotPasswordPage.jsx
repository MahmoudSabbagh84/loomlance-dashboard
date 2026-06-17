import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'
import { AuthShell } from '@/features/auth/AuthShell'
import * as auth from '@/api/auth'

const schema = z.object({ email: z.string().email() })

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setSubmitting(true)
    try {
      await auth.requestPasswordReset(email)
      setSent(true)
    } catch (e) {
      toast.error(e.userMessage || 'Failed to send reset email')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <Card padding="lg" className="shadow-xl shadow-black/20">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mb-5 mt-1 text-sm text-fg-muted">We’ll email you a link to set a new one.</p>
        {sent ? (
          <p className="text-sm">Check your email for the reset link.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            <Button type="submit" className="w-full" loading={submitting}>Send reset link</Button>
          </form>
        )}
        <p className="mt-4 text-sm">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </Card>
    </AuthShell>
  )
}
