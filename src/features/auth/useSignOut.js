import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as auth from '@/api/auth'

export function useSignOut() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  return async () => {
    try {
      await auth.signOut()
      qc.clear()
      navigate('/login', { replace: true })
    } catch (e) {
      toast.error(e.userMessage || 'Sign out failed')
    }
  }
}
