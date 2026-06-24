import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/time-entries'

export function useTimeEntries(filters) {
  return useQuery({ queryKey: ['time-entries', filters], queryFn: () => api.listTimeEntries(filters) })
}

export function useRunningTimer() {
  return useQuery({ queryKey: ['time-entries', 'running'], queryFn: api.getRunningTimer, refetchInterval: 30_000 })
}

function useInvalidateTime() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['time-entries'] })
    // Time changes feed the Time report (and the project financials rollups).
    qc.invalidateQueries({ queryKey: ['reports'] })
  }
}

export function useStartTimer() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.startTimer, onSuccess: inv })
}
export function useStopTimer() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.stopTimer, onSuccess: inv })
}
export function usePauseTimer() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.pauseTimer, onSuccess: inv })
}
export function useResumeTimer() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.resumeTimer, onSuccess: inv })
}
export function useCreateManualEntry() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.createManualEntry, onSuccess: inv })
}
export function useUpdateEntry() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: ({ id, patch }) => api.updateEntry(id, patch), onSuccess: inv })
}
export function useDeleteEntry() {
  const inv = useInvalidateTime()
  return useMutation({ mutationFn: api.deleteEntry, onSuccess: inv })
}
export function useGenerateInvoiceFromTimeForProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.generateInvoiceFromTimeForProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}
