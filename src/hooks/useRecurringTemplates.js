import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/recurring-templates'

export function useRecurringTemplates() {
  return useQuery({ queryKey: ['recurring-templates'], queryFn: api.listTemplates })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['recurring-templates'] })
}

export function useCreateTemplate() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.createTemplate, onSuccess: inv })
}
export function useUpdateTemplate() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateTemplate(id, patch), onSuccess: inv })
}
export function useDeleteTemplate() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: api.deleteTemplate, onSuccess: inv })
}
export function useSetTemplateActive() {
  const inv = useInvalidate()
  return useMutation({ mutationFn: ({ id, active }) => api.setActive(id, active), onSuccess: inv })
}
export function useGenerateNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-templates'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
