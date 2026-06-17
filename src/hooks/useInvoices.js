import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/invoices'
import { replaceLineItems } from '@/api/invoice-line-items'

export function useInvoices(params) {
  return useQuery({
    queryKey: ['invoices', 'list', params],
    queryFn: () => api.listInvoices(params),
    placeholderData: keepPreviousData,
  })
}
export function useInvoice(id) {
  return useQuery({ queryKey: ['invoices', 'detail', id], queryFn: () => api.getInvoice(id), enabled: !!id })
}
export function useNextInvoiceNumber() {
  return useQuery({ queryKey: ['invoice-next-number'], queryFn: api.nextInvoiceNumber, staleTime: 0, gcTime: 0 })
}
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['invoices'] })
}
export function useCreateInvoice() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createInvoice, onSuccess: inv })
}
export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updateInvoice(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoices', 'list'] })
      qc.invalidateQueries({ queryKey: ['invoices', 'detail', id] })
    },
  })
}
export function useReplaceLineItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, items }) => replaceLineItems(invoiceId, items),
    onSuccess: (_, { invoiceId }) => qc.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] }),
  })
}
export function useDeleteInvoice() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deleteInvoice, onSuccess: inv })
}
export function useDuplicateInvoice() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.duplicateInvoice, onSuccess: inv })
}
