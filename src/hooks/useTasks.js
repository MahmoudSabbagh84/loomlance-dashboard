import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/tasks'

export function useTasks(projectId) {
  return useQuery({ queryKey: ['tasks', projectId], queryFn: () => api.listTasks(projectId), enabled: !!projectId })
}

export function useCreateTask(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}

export function useUpdateTask(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] })
      const prev = qc.getQueryData(['tasks', projectId])
      qc.setQueryData(['tasks', projectId], (old) =>
        (old || []).map((t) => (t.id === id ? { ...t, ...patch } : t))
      )
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', projectId], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}

export function useDeleteTask(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}

export function useArchiveDoneInColumn(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveDoneInColumn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })
}
