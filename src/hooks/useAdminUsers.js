import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminUsersAction } from '@/api/admin'

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminUsersAction({ action: 'list' }).then((r) => r.users),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminUserDetail(id) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => adminUsersAction({ action: 'detail', userId: id }),
    enabled: !!id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

function useUserAction(action) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, tier }) => adminUsersAction({ action, userId, tier }),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId] })
      // A tier change writes the DB out-of-band from the affected user's own profile cache.
      // Refetch ['profile'] so that if the acting admin changed their own account, the
      // Subscription tab and every hasFeature() gate pick up the new tier immediately
      // (invalidate forces a refetch regardless of staleTime) instead of showing the old
      // tier until re-login. (A different user logged in elsewhere still refreshes on their
      // next window-focus refetch or re-login — that path is out-of-band by nature.)
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useCompTier() {
  return useUserAction('comp')
}
export function useBanUser() {
  return useUserAction('ban')
}
export function useUnbanUser() {
  return useUserAction('unban')
}
