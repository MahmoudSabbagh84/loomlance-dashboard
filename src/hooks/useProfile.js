import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/profiles'
import { useUser } from './useAuth'

export function useProfile() {
  const { user } = useUser()
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: api.getMyProfile,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateMyProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
