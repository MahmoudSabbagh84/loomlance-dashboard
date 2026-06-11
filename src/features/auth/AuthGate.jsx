import { Navigate, useLocation } from 'react-router-dom'
import { useUser } from '@/hooks/useAuth'

export function AuthGate({ children }) {
  const { user, isLoading } = useUser()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-fg-muted">
        Loading...
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
