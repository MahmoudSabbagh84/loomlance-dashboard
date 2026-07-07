import { useQuery } from '@tanstack/react-query'
import { fetchAdminMetrics } from '@/api/admin'

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: fetchAdminMetrics,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
