import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { GuestRoute, ProtectedRoute } from './components/routing/RouteGuards'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { DashboardPage } from './pages/DashboardPage'
import { TodosPage } from './pages/TodosPage'
import { TasksPage } from './pages/TasksPage'
import { UsersPage } from './pages/UsersPage'
import { ProfilePage } from './pages/ProfilePage'
import { GroupsPage } from './pages/GroupsPage'
import { MessagesPage } from './pages/MessagesPage'
import { MeetingsPage } from './pages/MeetingsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { InvitePage } from './pages/InvitePage'
import { routes } from './lib/routes'

function LegacyRedirect({ to }: { to: string }) {
  return <Navigate to={to} replace />
}

function LegacyProfileRedirect() {
  const { userId } = useParams()
  return <Navigate to={userId ? routes.profileUser(userId) : routes.profile} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path={routes.dashboard}>
          <Route index element={<DashboardPage />} />
          <Route path="todos" element={<TodosPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
        </Route>

        <Route path={routes.onboarding} element={<OnboardingPage />} />

        <Route path="/" element={<LegacyRedirect to={routes.dashboard} />} />
        <Route path="/tasks" element={<LegacyRedirect to={routes.tasks} />} />
        <Route path="/users" element={<LegacyRedirect to={routes.users} />} />
        <Route path="/profile" element={<LegacyRedirect to={routes.profile} />} />
        <Route path="/profile/:userId" element={<LegacyProfileRedirect />} />
        <Route path="/groups" element={<LegacyRedirect to={routes.groups} />} />
        <Route path="/messages" element={<LegacyRedirect to={routes.messages} />} />
        <Route path="/meetings" element={<LegacyRedirect to={routes.meetings} />} />
      </Route>

      <Route element={<GuestRoute />}>
        <Route path={routes.login} element={<LoginPage />} />
        <Route path={routes.signup} element={<SignupPage />} />
      </Route>

      <Route path="/invite/:token" element={<InvitePage />} />

      <Route path="*" element={<Navigate to={routes.dashboard} replace />} />
    </Routes>
  )
}
