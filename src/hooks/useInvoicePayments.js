import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/invoice-payments'

export function useInvoicePayments(invoiceId) {
  return useQuery({ queryKey: ['invoice-payments', invoiceId], queryFn: () => api.listPayments(invoiceId), enabled: !!invoiceId })
}
export function useCreatePayment(invoiceId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
export function useDeletePayment(invoiceId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deletePayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
