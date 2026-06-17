import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/notifications'

export function useNotifications(params) {
  return useQuery({ queryKey: ['notifications', params], queryFn: () => api.listNotifications(params) })
}
export function useUnreadCount() {
  return useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: api.unreadCount, refetchInterval: 60_000 })
}
export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.markRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
}
export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.markAllRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
}
