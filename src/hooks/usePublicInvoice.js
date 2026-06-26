import { useQuery } from '@tanstack/react-query'
import { getPublicInvoice } from '@/api/publicInvoice'

export function usePublicInvoice(token) {
  return useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => getPublicInvoice(token),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  })
}
