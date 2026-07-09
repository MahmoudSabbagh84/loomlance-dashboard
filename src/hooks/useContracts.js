import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/contracts'

export function useContracts(params) {
  return useQuery({
    queryKey: ['contracts', 'list', params],
    queryFn: () => api.listContracts(params),
    placeholderData: keepPreviousData,
  })
}
export function useContract(id) {
  return useQuery({ queryKey: ['contracts', 'detail', id], queryFn: () => api.getContract(id), enabled: !!id })
}
export function useTaggableContracts(projectId, clientId) {
  return useQuery({
    queryKey: ['contracts', 'taggable', projectId, clientId],
    queryFn: () => api.listTaggableContracts({ projectId, clientId }),
    enabled: !!projectId && !!clientId,
  })
}
function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['contracts'] })
}
export function useCreateContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createContract, onSuccess: inv })
}
export function useUpdateContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateContract(id, patch), onSuccess: inv })
}
export function useDeleteContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deleteContract, onSuccess: inv })
}
export function useUploadContractPdf() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, file }) => api.uploadContractPdf(id, file), onSuccess: inv })
}
export function useSendContract() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (contract) => api.sendContractForSignature(contract), onSuccess: inv })
}
export function useRegenerateContractLink() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.regenerateContractLink, onSuccess: inv })
}
