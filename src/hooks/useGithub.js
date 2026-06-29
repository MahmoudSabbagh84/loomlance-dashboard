import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/github'

export function useGithubInstallation() {
  return useQuery({ queryKey: ['github', 'installation'], queryFn: api.getInstallation })
}
export function useProjectRepo(projectId) {
  return useQuery({
    queryKey: ['github', 'project-repo', projectId],
    queryFn: () => api.getProjectRepo(projectId),
    enabled: !!projectId,
  })
}
export function useGithubIssues(projectId) {
  return useQuery({
    queryKey: ['github', 'issues', projectId],
    queryFn: () => api.listIssueCards(projectId),
    enabled: !!projectId,
  })
}
export function useConnectGithub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.connectInstallation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github', 'installation'] }),
  })
}
export function useLinkRepo(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.linkRepo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github', 'project-repo', projectId] })
      qc.invalidateQueries({ queryKey: ['github', 'issues', projectId] })
    },
  })
}
export function useDisconnectRepo(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.disconnectRepo(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github', 'project-repo', projectId] })
      qc.invalidateQueries({ queryKey: ['github', 'issues', projectId] })
    },
  })
}
