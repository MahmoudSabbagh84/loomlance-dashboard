import { Navigate } from 'react-router-dom'
import { useProfile } from '@/hooks/useProfile'
import { Skeleton } from '@/components/ui/Skeleton'

export function AdminGate({ children }) {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-48" /></div>
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return children
}
