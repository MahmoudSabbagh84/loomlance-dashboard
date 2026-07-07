import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAppConfig, updateAppConfig } from '@/api/config'

export function useAppConfig() {
  return useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, staleTime: 60 * 1000 })
}

export function useUpdateAppConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAppConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-config'] }),
  })
}
