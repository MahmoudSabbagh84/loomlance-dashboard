import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/kanban-columns'

export function useKanbanColumns(projectId) {
  return useQuery({ queryKey: ['kanban-columns', projectId], queryFn: () => api.listColumns(projectId), enabled: !!projectId })
}
function useInvalidate(projectId) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['kanban-columns', projectId] })
}
export function useCreateColumn(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: api.createColumn, onSuccess: invalidate })
}
export function useUpdateColumn(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: ({ id, patch }) => api.updateColumn(id, patch), onSuccess: invalidate })
}
export function useDeleteColumn(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: api.deleteColumn, onSuccess: invalidate })
}
export function useReorderColumns(projectId) {
  const invalidate = useInvalidate(projectId)
  return useMutation({ mutationFn: (idsInOrder) => api.reorderColumns(projectId, idsInOrder), onSuccess: invalidate })
}
