import { Link } from 'react-router-dom'
import { UserAvatar } from '../ui/UserAvatar'
import {
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  availabilityColor,
  availabilityLabel,
} from '../../lib/profileOptions'
import { routes } from '../../lib/routes'
import type { User } from '../../types'

interface MemberProfileViewProps {
  user: User
  workspaceName?: string
  isSelf?: boolean
  currentUserId?: string | null
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null
  return (
    <div className="member-profile__field">
      <span className="member-profile__label">{label}</span>
      <span className="member-profile__value">{value}</span>
    </div>
  )
}

export function MemberProfileView({ user, workspaceName, isSelf, currentUserId }: MemberProfileViewProps) {
  const displayLabel = user.name || user.displayEmail || user.teamEmail || user.email
  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === user.language)?.label ?? user.language
  const timezoneLabel =
    TIMEZONE_OPTIONS.find((option) => option.value === user.timezone)?.label ?? user.timezone

  return (
    <div className="member-profile">
      <header className="member-profile__hero">
        <UserAvatar
          label={displayLabel}
          seed={user.id}
          avatarUrl={user.avatarUrl}
          className="member-profile__avatar"
        />
        <div className="member-profile__hero-copy">
          <h2 className="member-profile__name">{displayLabel}</h2>
          {user.designation && <p className="member-profile__designation">{user.designation}</p>}
          <p className="member-profile__status">
            <span
              className="member-profile__status-dot"
              style={{ backgroundColor: availabilityColor(user.availability) }}
              aria-hidden="true"
            />
            {availabilityLabel(user.availability)}
            {user.statusMessage ? ` · ${user.statusMessage}` : ''}
          </p>
          {user.isOwner && <span className="member-profile__badge">Workspace owner</span>}
          {!user.isOwner && user.workspaceRole === 'admin' && (
            <span className="member-profile__badge">Admin</span>
          )}
        </div>
      </header>

      {user.bio && (
        <section className="member-profile__section">
          <h3 className="member-profile__section-title">About</h3>
          <p className="member-profile__bio">{user.bio}</p>
        </section>
      )}

      <section className="member-profile__section">
        <h3 className="member-profile__section-title">Contact</h3>
        <ProfileField label="Workspace email" value={user.displayEmail ?? user.teamEmail ?? user.email} />
        <ProfileField label="Mobile" value={user.phone} />
        <ProfileField label="Extension" value={user.extension} />
      </section>

      <section className="member-profile__section">
        <h3 className="member-profile__section-title">Work</h3>
        <ProfileField label="Department" value={user.department} />
        <ProfileField label="Location" value={user.location} />
        {workspaceName && <ProfileField label="Workspace" value={workspaceName} />}
      </section>

      {(user.timezone || user.language) && (
        <section className="member-profile__section">
          <h3 className="member-profile__section-title">Preferences</h3>
          <ProfileField label="Timezone" value={timezoneLabel} />
          <ProfileField label="Language" value={languageLabel} />
        </section>
      )}

      {!isSelf && currentUserId && (
        <div className="member-profile__actions">
          <Link to={routes.messagesUser(user.id)} className="btn btn--primary btn--sm">
            Message
          </Link>
        </div>
      )}

      {isSelf && (
        <div className="member-profile__actions">
          <Link to={routes.profile} className="btn btn--primary btn--sm">
            Edit my profile
          </Link>
        </div>
      )}
    </div>
  )
}
