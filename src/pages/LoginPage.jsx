import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { Card } from '@/components/ui/Card'
import { AuthShell } from '@/features/auth/AuthShell'
import * as auth from '@/api/auth'
import { setRememberMe } from '@/lib/authStorage'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Min 6 characters'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: true },
  })

  const onSubmit = async (values) => {
    setSubmitting(true)
    try {
      // Decide session storage (localStorage vs sessionStorage) before the
      // sign-in so supabase writes the session to the right place.
      setRememberMe(values.rememberMe)
      const data = await auth.signInWithPassword(values)
      // Seed the session cache so AuthGate sees the user immediately instead of
      // reading a stale unauthenticated value and bouncing back to /login.
      queryClient.setQueryData(['session'], data.session)
      const to = location.state?.from || '/'
      navigate(to, { replace: true })
    } catch (e) {
      toast.error(e.userMessage || 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-7 text-center">
          <img src="/logo.png" alt="" className="mx-auto mb-4 size-14" />
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-primary">Loom</span>
            <span className="text-fg-muted">Lance</span>
          </h1>
          <p className="mt-2 text-sm text-fg-muted">Weave it all together</p>
        </div>

        <Card padding="lg" as="form" onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 shadow-xl shadow-black/20">
          <div>
            <Label htmlFor="email" required>Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="password" required>Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <label className="flex items-center gap-2 pt-0.5 text-sm text-fg-muted select-none">
            <input
              type="checkbox"
              className="size-4 rounded border-border text-primary focus:ring-primary"
              {...register('rememberMe')}
            />
            Remember me on this device
          </label>

          <Button type="submit" className="w-full" loading={submitting}>
            <LogIn className="size-4" />
            Sign in
          </Button>

          <div className="flex items-center justify-between pt-1 text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
            <a
              href={import.meta.env.VITE_SPLASH_URL || 'https://loomlance.com'}
              className="text-fg-muted hover:text-fg"
            >
              Don’t have an account?
            </a>
          </div>
        </Card>
    </AuthShell>
  )
}
