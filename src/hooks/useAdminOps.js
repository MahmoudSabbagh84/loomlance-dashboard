import { useQuery } from '@tanstack/react-query'
import { fetchAdminOps } from '@/api/admin'

export function useAdminOps() {
  return useQuery({
    queryKey: ['admin', 'ops'],
    queryFn: fetchAdminOps,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
