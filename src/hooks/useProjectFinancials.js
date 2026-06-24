import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/projects'
import { projectFinancials } from '@/lib/projectFinancials'

export function useProjectFinancials(projectId, projectCurrency, budgetAmount) {
  return useQuery({
    queryKey: ['projects', 'financials', projectId],
    queryFn: () => api.fetchProjectFinancialsData(projectId),
    enabled: !!projectId,
    select: (data) => projectFinancials(data, projectCurrency, budgetAmount ?? null),
  })
}

export function useBudgetHistory(projectId) {
  return useQuery({
    queryKey: ['projects', 'budget-history', projectId],
    queryFn: () => api.fetchBudgetHistory(projectId),
    enabled: !!projectId,
  })
}

export function useSetProjectBudget(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.setProjectBudget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', 'detail', projectId] })
      qc.invalidateQueries({ queryKey: ['projects', 'financials', projectId] })
      qc.invalidateQueries({ queryKey: ['projects', 'budget-history', projectId] })
    },
  })
}
