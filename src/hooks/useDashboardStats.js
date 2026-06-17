import { useQuery } from '@tanstack/react-query'
import { fetchDashboardStats } from '@/features/dashboard/dashboardStats'

export function useDashboardStats() {
  return useQuery({ queryKey: ['dashboard', 'stats'], queryFn: fetchDashboardStats, staleTime: 60_000 })
}
