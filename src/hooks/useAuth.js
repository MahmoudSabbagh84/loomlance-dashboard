import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as auth from '@/api/auth'

export function useSession() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['session'], queryFn: auth.getSession, staleTime: 60_000 })

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChange((_event, session) => {
      qc.setQueryData(['session'], session)
      qc.invalidateQueries({ queryKey: ['profile'] })
    })
    return unsubscribe
  }, [qc])

  return q
}

export function useUser() {
  const { data: session, isLoading } = useSession()
  return { user: session?.user ?? null, isLoading }
}
