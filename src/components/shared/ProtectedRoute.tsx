import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-paperEdge border-t-accent animate-spin" />
      <div className="text-sm text-inkSoft font-medium">{label}</div>
    </div>
  )
}
