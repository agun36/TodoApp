import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ChatNotificationListener } from '../chat/ChatNotificationListener'
import { useAuth } from '../../context/AuthContext'
import { ChatFocusProvider } from '../../context/ChatFocusContext'
import { routes } from '../../lib/routes'

export function ProtectedRoute() {
  const { isAuthenticated, needsOnboarding } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={routes.login} replace />
  }

  if (needsOnboarding && location.pathname !== routes.onboarding) {
    return <Navigate to={routes.onboarding} replace />
  }

  if (!needsOnboarding && location.pathname === routes.onboarding) {
    return <Navigate to={routes.dashboard} replace />
  }

  return (
    <ChatFocusProvider>
      <ChatNotificationListener />
      <Outlet />
    </ChatFocusProvider>
  )
}

export function GuestRoute() {
  const { isAuthenticated, needsOnboarding } = useAuth()

  if (isAuthenticated) {
    return <Navigate to={needsOnboarding ? routes.onboarding : routes.dashboard} replace />
  }

  return <Outlet />
}
