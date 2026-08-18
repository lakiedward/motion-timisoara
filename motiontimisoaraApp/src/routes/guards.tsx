import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/api/auth'
import { Button } from '@/components/ui/button'

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  )
}

function ProfileLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-foreground text-base font-medium">{message}</p>
        <Button type="button" onClick={onRetry}>
          Reîncearcă
        </Button>
      </div>
    </div>
  )
}

/** Gate: requires an authenticated user; otherwise redirects to /login with returnUrl. */
export function RequireAuth() {
  const { user, loading, profileError, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (profileError) return <ProfileLoadError message={profileError} onRetry={() => void refresh()} />
  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />
  }
  return <Outlet />
}

/** Gate: requires the user's role to be in `roles`; otherwise redirects home. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading, profileError, refresh } = useAuth()
  if (loading) return <FullScreenLoader />
  if (profileError) return <ProfileLoadError message={profileError} onRetry={() => void refresh()} />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
