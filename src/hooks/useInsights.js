import { useQuery } from '@tanstack/react-query'
import { fetchInsights } from '@/features/dashboard/insights'

export function useInsights() {
  return useQuery({ queryKey: ['dashboard', 'insights'], queryFn: fetchInsights, staleTime: 60_000 })
}
