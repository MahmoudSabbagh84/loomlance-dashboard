import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/projects'

export function useProjects(params) {
  return useQuery({ queryKey: ['projects', 'list', params], queryFn: () => api.listProjects(params) })
}
export function useProject(id) {
  return useQuery({ queryKey: ['projects', 'detail', id], queryFn: () => api.getProject(id), enabled: !!id })
}
export function useActiveProjectCount() {
  return useQuery({ queryKey: ['projects', 'count', 'active'], queryFn: api.countActiveProjects })
}
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['projects'] })
}
export function useCreateProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.createProject, onSuccess: invalidate })
}
export function useUpdateProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateProject(id, patch), onSuccess: invalidate })
}
export function useArchiveProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.archiveProject, onSuccess: invalidate })
}
export function useUnarchiveProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.unarchiveProject, onSuccess: invalidate })
}
export function useDeleteProject() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: api.deleteProject, onSuccess: invalidate })
}
