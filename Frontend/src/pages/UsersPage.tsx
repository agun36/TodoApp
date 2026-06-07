import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { PageHeader } from '../components/layout/PageHeader'
import { AppSelect } from '../components/ui/AppSelect'
import { UserAvatar } from '../components/ui/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { routes } from '../lib/routes'
import type { ManageableProject, User, WorkspaceRole } from '../types'

function TeamMemberCard({
  member,
  currentUserId,
  projects,
  canManage,
  canAssignTeamEmail,
  canAssignRoles,
  onAddToProjects,
  onSetTeamEmail,
  onSetWorkspaceRole,
  isAdding,
  isSettingTeamEmail,
  isSettingRole,
}: {
  member: User
  currentUserId: string
  projects: ManageableProject[]
  canManage: boolean
  canAssignTeamEmail: boolean
  canAssignRoles: boolean
  onAddToProjects: (userId: string, projectIds: string[]) => Promise<unknown>
  onSetTeamEmail: (userId: string, teamEmail: string) => Promise<unknown>
  onSetWorkspaceRole: (userId: string, role: WorkspaceRole) => Promise<unknown>
  isAdding: boolean
  isSettingTeamEmail: boolean
  isSettingRole: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [teamEmailOpen, setTeamEmailOpen] = useState(false)
  const [teamEmailInput, setTeamEmailInput] = useState(member.teamEmail ?? '')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const isSelf = member.id === currentUserId

  function toggleProject(projectId: string) {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    )
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    if (selectedProjectIds.length === 0) {
      setError('Select at least one project')
      return
    }
    try {
      const result = await onAddToProjects(member.id, selectedProjectIds)
      const addedCount = result.added?.length ?? 0
      if (addedCount > 0) {
        setSuccess(`Added to ${addedCount} project${addedCount === 1 ? '' : 's'}`)
        setSelectedProjectIds([])
        setExpanded(false)
      } else {
        setSuccess('Already a member of the selected projects')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to projects')
    }
  }

  async function handleSetTeamEmail(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await onSetTeamEmail(member.id, teamEmailInput.trim())
      setSuccess(teamEmailInput.trim() ? 'Workspace email saved' : 'Workspace email removed')
      setTeamEmailOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workspace email')
    }
  }

  const displayEmail = member.displayEmail ?? member.teamEmail ?? member.email
  const hasSeparateTeamEmail =
    member.teamEmail && member.teamEmail.toLowerCase() !== member.email.toLowerCase()

  return (
    <article className="user-card">
      <UserAvatar
        label={member.name || displayEmail}
        seed={member.id}
        avatarUrl={member.avatarUrl}
        className="user-card__avatar"
      />
      <div className="user-card__body">
        <div className="user-card__header">
          {member.name && <p className="user-card__name">{member.name}</p>}
          <p className="user-card__email">{displayEmail}</p>
          {hasSeparateTeamEmail && (
            <p className="user-card__meta">Signs in with {member.email}</p>
          )}
          {member.isOwner && <span className="user-card__badge">Owner</span>}
          {member.workspaceRole === 'admin' && !member.isOwner && (
            <span className="user-card__badge">Admin</span>
          )}
          {!member.isOwner && member.workspaceRole === 'member' && (
            <span className="user-card__badge user-card__badge--muted">Member</span>
          )}
          {isSelf && <span className="user-card__badge user-card__badge--muted">You</span>}
        </div>

        {canAssignRoles && !member.isOwner && !isSelf && (
          <div className="user-card__role-field">
            <span className="user-card__role-label">Workspace role</span>
            <AppSelect
              value={member.workspaceRole === 'admin' ? 'admin' : 'member'}
              onChange={async (value) => {
                setError(null)
                setSuccess(null)
                try {
                  await onSetWorkspaceRole(member.id, value as WorkspaceRole)
                  setSuccess(
                    value === 'admin'
                      ? `${displayEmail} is now an admin`
                      : `${displayEmail} is now a member`,
                  )
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to update role')
                }
              }}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ]}
              aria-label={`Workspace role for ${displayEmail}`}
              disabled={isSettingRole}
            />
          </div>
        )}

        {(canManage || canAssignTeamEmail) && !isSelf && (
          <div className="user-card__actions">
            {canAssignTeamEmail && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setTeamEmailOpen((value) => !value)
                  setTeamEmailInput(member.teamEmail ?? '')
                  setExpanded(false)
                  setError(null)
                  setSuccess(null)
                }}
              >
                {teamEmailOpen ? 'Cancel' : member.teamEmail ? 'Edit workspace email' : 'Set workspace email'}
              </button>
            )}
            {canManage && projects.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setExpanded((value) => !value)
                  setTeamEmailOpen(false)
                  setError(null)
                  setSuccess(null)
                }}
              >
                {expanded ? 'Cancel' : 'Add to projects'}
              </button>
            )}
          </div>
        )}

        {teamEmailOpen && (
          <form className="user-card__team-email-form" onSubmit={handleSetTeamEmail}>
            <label className="user-card__team-email-label">
              Workspace email
              <input
                type="email"
                value={teamEmailInput}
                onChange={(e) => setTeamEmailInput(e.target.value)}
                placeholder="e.g. ada@company.com"
                aria-label={`Workspace email for ${member.name || member.email}`}
              />
            </label>
            <p className="user-card__meta">
              How this person appears in your workspace. They still sign in with {member.email}.
            </p>
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={isSettingTeamEmail}
            >
              {isSettingTeamEmail ? 'Saving…' : 'Save workspace email'}
            </button>
            {error && <p className="user-card__error">{error}</p>}
            {success && <p className="user-card__success">{success}</p>}
          </form>
        )}

        {expanded && (
          <form className="user-card__project-form" onSubmit={handleAdd}>
            <fieldset className="user-card__project-list">
              <legend className="sr-only">Projects for {displayEmail}</legend>
              {projects.map((project) => (
                <label key={project.id} className="user-card__project-option">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                  />
                  <span
                    className="user-card__project-swatch"
                    style={{ backgroundColor: project.color }}
                    aria-hidden="true"
                  />
                  <span>{project.name}</span>
                </label>
              ))}
            </fieldset>
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={isAdding || selectedProjectIds.length === 0}
            >
              {isAdding ? 'Adding…' : 'Add to projects'}
            </button>
            {error && <p className="user-card__error">{error}</p>}
            {success && <p className="user-card__success">{success}</p>}
          </form>
        )}
      </div>
    </article>
  )
}

export function UsersPage() {
  const { user } = useAuth()
  const {
    data,
    isLoading,
    isError,
    error,
    inviteUser,
    setMemberTeamEmail,
    setMemberWorkspaceRole,
    revokeInvite,
    addUserToProjects,
    isInviting,
    isSettingTeamEmail,
    isSettingRole,
    isRevoking,
    isAddingToProjects,
  } = useUsers()

  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null)
  const [lastWhatsAppLink, setLastWhatsAppLink] = useState<string | null>(null)

  const currentUser = data?.currentUser ?? user
  const isOwner =
    data?.currentUser?.isOwner ??
    (data?.workspace?.ownerId != null &&
      (currentUser?.id === data.workspace.ownerId || user?.id === data.workspace.ownerId))
  const canManageWorkspace =
    data?.canManageWorkspace ?? (isOwner || currentUser?.workspaceRole === 'admin')
  const manageableProjects = data?.manageableProjects ?? []
  const canManageMembers = canManageWorkspace || manageableProjects.length > 0
  const pendingInvites = data?.invites ?? []
  const teamMembers = data?.users ?? []
  const billing = data?.billing
  const workspaceName = data?.workspace?.name

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    const trimmed = inviteEmail.trim()
    if (!trimmed) return
    try {
      const result = await inviteUser({
        email: trimmed,
        phone: invitePhone.trim() || undefined,
      })
      setInviteEmail('')
      setInvitePhone('')
      setLastInviteLink(result.invite.inviteUrl ?? null)
      setLastWhatsAppLink(result.invite.whatsappUrl ?? null)
      if (result.invite.emailSent) {
        setInviteSuccess(`Invite emailed to ${trimmed}. You can also share the link or WhatsApp.`)
      } else {
        setInviteSuccess(
          `${result.message} After they join, set their workspace email on their team card.`,
        )
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    }
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Workspace"
        title="Team"
        description={
          canManageWorkspace
            ? 'Invite people, assign roles, add them to projects, then assign tasks on the Tasks page.'
            : 'People in this workspace. Add teammates to your projects so you can assign tasks.'
        }
      />

      {!canManageWorkspace && !isLoading && (
        <div className="team-member-notice">
          <p>
            You are signed in as a <strong>workspace member</strong>. Inviting people and adding
            them to projects workspace-wide requires a <strong>workspace admin</strong>.
          </p>
          <p>
            You can still add people to <strong>your own projects</strong> on the{' '}
            <Link to={routes.tasks}>Tasks</Link> page → edit a project → Team members.
          </p>
        </div>
      )}

      {canManageWorkspace && (
        <section className="team-workflow" aria-label="Admin workflow">
          <ol className="team-workflow__steps">
            <li>
              <strong>Invite</strong> — send an invite to their personal email
            </li>
            <li>
              <strong>Assign role</strong> — make someone an <strong>Admin</strong> or keep them as <strong>Member</strong>
            </li>
            <li>
              <strong>Set workspace email</strong> — after they join, assign how they appear in your team
            </li>
            <li>
              <strong>Add to projects</strong> — use “Add to projects” on each person’s card
            </li>
            <li>
              <strong>Groups</strong> — organize people on the{' '}
              <Link to={routes.groups}>Groups</Link> page
            </li>
            <li>
              <strong>Assign tasks</strong> — create and assign work on the{' '}
              <Link to={routes.tasks}>Tasks</Link> page
            </li>
          </ol>
        </section>
      )}

      {canManageWorkspace && billing && (
        <p className="team-billing-hint">
          <strong>{workspaceName ?? 'Your workspace'}</strong> — {billing.plan} plan: up to{' '}
          {billing.freeMemberLimit} members free (members are never billed; only you upgrade).
        </p>
      )}

      {canManageWorkspace && (
        <section className="team-panel">
          <h2 className="team-panel__title">Invite to workspace</h2>
          <p className="team-panel__hint">
            Send the invite to their personal email (Gmail, etc.). After they join, assign a workspace
            email on their team card so they are easy to recognize.
          </p>
          <form className="team-invite" onSubmit={handleInvite}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Personal email (invite sent here)"
              aria-label="Personal email for invite"
            />
            <input
              type="tel"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              placeholder="WhatsApp +234… (optional)"
              aria-label="WhatsApp phone"
            />
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={isInviting || !inviteEmail.trim()}
            >
              {isInviting ? 'Inviting…' : 'Send invite'}
            </button>
          </form>
          {inviteError && <p className="team-panel__error">{inviteError}</p>}
          {inviteSuccess && <p className="team-panel__success">{inviteSuccess}</p>}
          {(lastInviteLink || lastWhatsAppLink) && (
            <div className="team-invite-share">
              {lastInviteLink && (
                <a href={lastInviteLink} className="btn btn--ghost btn--sm" target="_blank" rel="noreferrer">
                  Copy invite link
                </a>
              )}
              {lastWhatsAppLink && (
                <a
                  href={lastWhatsAppLink}
                  className="btn btn--primary btn--sm team-invite-share__whatsapp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Send via WhatsApp
                </a>
              )}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="team-invites">
              <h3 className="team-invites__title">Pending invites</h3>
              <ul className="team-invites__list">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="team-invites__item">
                    <span>{invite.email}</span>
                    {invite.inviteUrl && (
                      <a
                        href={invite.whatsappUrl || invite.inviteUrl}
                        className="btn btn--ghost btn--sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {invite.whatsappUrl ? 'WhatsApp' : 'Link'}
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={isRevoking}
                      onClick={() => revokeInvite(invite.id)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {canManageMembers && (
        <p className="team-assign-hint">
          After adding someone to a project, assign work on the{' '}
          <Link to={routes.tasks}>Tasks</Link> page.
        </p>
      )}

      {isLoading && <div className="state-message">Loading team…</div>}

      {isError && (
        <div className="alert alert--error">
          {error instanceof Error ? error.message : 'Failed to load team'}
        </div>
      )}

      {!isLoading && !isError && teamMembers.length > 0 && (
        <div className="users-grid">
          {teamMembers.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              currentUserId={user?.id ?? currentUser?.id ?? ''}
              projects={manageableProjects}
              canManage={canManageMembers}
              canAssignTeamEmail={canManageWorkspace}
              canAssignRoles={isOwner}
              onAddToProjects={addUserToProjects}
              onSetTeamEmail={(userId, teamEmail) => setMemberTeamEmail({ userId, teamEmail })}
              onSetWorkspaceRole={(userId, role) => setMemberWorkspaceRole({ userId, role })}
              isAdding={isAddingToProjects}
              isSettingTeamEmail={isSettingTeamEmail}
              isSettingRole={isSettingRole}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && teamMembers.length === 0 && (
        <div className="state-message">No team members yet.</div>
      )}
    </AppLayout>
  )
}
