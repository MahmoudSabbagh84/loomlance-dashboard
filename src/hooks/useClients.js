import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/clients'

export function useClients(params) {
  return useQuery({
    queryKey: ['clients', 'list', params],
    queryFn: () => api.listClients(params),
    placeholderData: keepPreviousData,
  })
}

export function useClient(id) {
  return useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => api.getClient(id),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => api.updateClient(id, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients', 'list'] })
      qc.invalidateQueries({ queryKey: ['clients', 'detail', id] })
    },
  })
}

export function useArchiveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
