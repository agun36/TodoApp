import { NavLink, useLocation } from 'react-router-dom'
import { availabilityColor, availabilityLabel } from '../../lib/profileOptions'
import { routes } from '../../lib/routes'
import { UserAvatar } from '../ui/UserAvatar'
import { useAuth } from '../../context/AuthContext'
import { BrandLogo } from './BrandLogo'

interface AppSidebarProps {
  children?: React.ReactNode
}

const NAV_ITEMS = [
  { to: routes.dashboard, label: 'Dashboard', end: true },
  { to: routes.todos, label: 'My todos', end: true },
  { to: routes.tasks, label: 'Tasks', end: false },
  { to: routes.users, label: 'Team', end: false },
  { to: routes.meetings, label: 'Meetings', end: false },
  { to: routes.messages, label: 'Messages', end: false },
  { to: routes.groups, label: 'Groups', end: false },
] as const

function NavIcon({ label }: { label: string }) {
  if (label === 'My todos') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 6h10M9 12h10M9 18h10M5 6h.01M5 12h.01M5 18h.01"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (label === 'Tasks') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (label === 'Dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (label === 'Meetings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (label === 'Groups') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <path d="M2 20c0-2.5 2.7-4 6-4M22 20c0-2.5-2.7-4-6-4M12 20c0-2.5-2.7-4-6-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (label === 'Messages') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.75" fill="none" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 11h5M16 15h5M16 19h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function AppSidebar({ children }: AppSidebarProps) {
  const { user, workspace, logout } = useAuth()
  const location = useLocation()
  const displayLabel = user?.name || user?.displayEmail || user?.email || '?'
  const isOwner = user?.isOwner ?? workspace?.ownerId === user?.id
  const onTeamPage = location.pathname === routes.users
  const statusColor = availabilityColor(user?.availability)
  const statusText = availabilityLabel(user?.availability)

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <BrandLogo />
        <nav className="app-sidebar__nav" aria-label="Main">
          {NAV_ITEMS.filter(({ ownerOnly }) => !ownerOnly || isOwner).map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`
              }
            >
              <NavIcon label={label} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {isOwner && !onTeamPage && (
          <NavLink to={routes.users} className="app-sidebar__team-mgmt">
            <span className="app-sidebar__team-mgmt-title">Team management</span>
            <span className="app-sidebar__team-mgmt-hint">Invite people & add to projects</span>
          </NavLink>
        )}
      </div>

      {children && <div className="app-sidebar__body">{children}</div>}

      <div className="app-sidebar__footer">
        <NavLink
          to={routes.profile}
          className={({ isActive }) =>
            `app-sidebar__user${isActive ? ' app-sidebar__user--active' : ''}`
          }
          aria-label="Edit profile"
        >
          <span className="app-sidebar__avatar-wrap">
            <UserAvatar
              label={displayLabel}
              seed={user?.id}
              avatarUrl={user?.avatarUrl}
              className="app-sidebar__avatar"
            />
            <span
              className="app-sidebar__status-dot"
              style={{ backgroundColor: statusColor }}
              title={statusText}
              aria-label={`Status: ${statusText}`}
            />
          </span>
          <div className="app-sidebar__user-info">
            {user?.name && <span className="app-sidebar__user-name">{user.name}</span>}
            <span className="app-sidebar__user-email">
              {user?.displayEmail && user.displayEmail !== user.email
                ? user.displayEmail
                : user?.email}
            </span>
            <span className="app-sidebar__user-role">
              {statusText} · {isOwner ? 'Workspace owner' : 'Workspace member'}
            </span>
          </div>
        </NavLink>
        <button type="button" className="btn btn--sidebar" onClick={() => logout()}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
