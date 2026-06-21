import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/expenses'

export function useExpenses(filters) {
  return useQuery({ queryKey: ['expenses', filters], queryFn: () => api.listExpenses(filters) })
}

function useInvalidateExpenses() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['expenses'] })
}

export function useCreateExpense() {
  const inv = useInvalidateExpenses()
  return useMutation({ mutationFn: api.createExpense, onSuccess: inv })
}
export function useUpdateExpense() {
  const inv = useInvalidateExpenses()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateExpense(id, patch), onSuccess: inv })
}
export function useDeleteExpense() {
  const inv = useInvalidateExpenses()
  return useMutation({ mutationFn: api.deleteExpense, onSuccess: inv })
}
export function useGenerateInvoiceFromExpensesForProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, currency }) => api.generateInvoiceFromExpensesForProject(projectId, currency),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
export function useGenerateInvoiceFromExpensesForClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, currency }) => api.generateInvoiceFromExpensesForClient(clientId, currency),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
