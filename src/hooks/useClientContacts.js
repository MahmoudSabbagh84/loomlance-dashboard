import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/client-contacts'

export function useClientContacts(clientId) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: () => api.listContacts(clientId),
    enabled: !!clientId,
  })
}

function useInvalidate(clientId) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['client-contacts', clientId] })
}

export function useCreateContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: api.createContact, onSuccess: invalidate })
}
export function useUpdateContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: ({ id, patch }) => api.updateContact(id, patch), onSuccess: invalidate })
}
export function useDeleteContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: api.deleteContact, onSuccess: invalidate })
}
export function useSetPrimaryContact(clientId) {
  const invalidate = useInvalidate(clientId)
  return useMutation({ mutationFn: (contactId) => api.setPrimary(contactId, clientId), onSuccess: invalidate })
}
