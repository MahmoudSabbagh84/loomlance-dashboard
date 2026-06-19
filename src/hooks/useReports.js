import { useQuery } from '@tanstack/react-query'
import * as api from '@/api/reports'

export function usePaymentsReport(range) {
  return useQuery({ queryKey: ['reports', 'payments', range], queryFn: () => api.fetchPayments(range), enabled: !!range?.from && !!range?.to })
}
export function useExpensesInRange(range) {
  return useQuery({ queryKey: ['reports', 'expenses', range], queryFn: () => api.fetchExpensesInRange(range), enabled: !!range?.from && !!range?.to })
}
export function useOpenInvoices() {
  return useQuery({ queryKey: ['reports', 'open-invoices'], queryFn: api.fetchOpenInvoices })
}
export function useTimeEntriesInRange(range) {
  return useQuery({ queryKey: ['reports', 'time', range], queryFn: () => api.fetchTimeEntriesInRange(range), enabled: !!range?.from && !!range?.to })
}
