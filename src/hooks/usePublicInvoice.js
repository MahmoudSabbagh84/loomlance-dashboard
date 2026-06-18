import { useQuery, useMutation } from '@tanstack/react-query'
import { getPublicInvoice, mockPayInvoice } from '@/api/publicInvoice'

export function usePublicInvoice(token) {
  return useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => getPublicInvoice(token),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  })
}

export function useMockPay() {
  return useMutation({ mutationFn: (token) => mockPayInvoice(token) })
}
