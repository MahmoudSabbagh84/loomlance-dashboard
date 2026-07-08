import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/changeRequests'
import * as pub from '@/api/publicChangeRequest'

export function useChangeRequests(projectId) {
  return useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: () => api.listChangeRequests(projectId),
    enabled: !!projectId,
  })
}

function useCRMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests'] }),
  })
}

export function useCreateChangeRequest() {
  return useCRMutation(api.createChangeRequest)
}
export function useUpdateChangeRequest() {
  return useCRMutation(({ id, patch }) => api.updateChangeRequest(id, patch))
}
export function useDeleteChangeRequest() {
  return useCRMutation(api.deleteChangeRequest)
}
export function useSendChangeRequest() {
  return useCRMutation(api.sendChangeRequest)
}
export function useRegenerateChangeRequestLink() {
  return useCRMutation(api.regenerateChangeRequestLink)
}
export function useBillChangeRequest() {
  return useCRMutation(api.billChangeRequest)
}

export function usePublicChangeRequest(token) {
  return useQuery({
    queryKey: ['public-change-request', token],
    queryFn: () => pub.getPublicChangeRequest(token),
    enabled: !!token,
    retry: false,
  })
}
export function useRespondToChangeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: pub.respondToChangeRequest,
    onSuccess: (_, { token }) => qc.invalidateQueries({ queryKey: ['public-change-request', token] }),
  })
}
