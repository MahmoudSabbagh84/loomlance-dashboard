import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as pub from '@/api/publicContract'

export function usePublicContract(token) {
  return useQuery({
    queryKey: ['public-contract', token],
    queryFn: () => pub.getPublicContract(token),
    enabled: !!token,
    retry: false,
  })
}

export function useSignContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: pub.signContract,
    onSuccess: (_, { token }) => qc.invalidateQueries({ queryKey: ['public-contract', token] }),
  })
}

export function useDeclineContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: pub.declineContract,
    onSuccess: (_, { token }) => qc.invalidateQueries({ queryKey: ['public-contract', token] }),
  })
}
