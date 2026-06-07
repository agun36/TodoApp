import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { routes } from '../../lib/routes'
import type { GroupMemberEntry, User, WorkspaceGroup, WorkspaceInvite } from '../../types'
import { UserAvatar } from '../ui/UserAvatar'

interface GroupMembersPanelProps {
  group: WorkspaceGroup
  canManage: boolean
  roster: User[]
  pendingInvites: WorkspaceInvite[]
  onClose: () => void
  onAddMembers: (
    groupId: string,
    userIds: string[],
    inviteIds: string[],
  ) => Promise<unknown>
  onRemoveMember: (
    groupId: string,
    payload: { userId?: string; inviteId?: string },
  ) => Promise<unknown>
  onDelete: (groupId: string) => Promise<unknown>
  isAdding: boolean
  isRemoving: boolean
  isDeleting: boolean
}

export function GroupMembersPanel({
  group,
  canManage,
  roster,
  pendingInvites,
  onClose,
  onAddMembers,
  onRemoveMember,
  onDelete,
  isAdding,
  isRemoving,
  isDeleting,
}: GroupMembersPanelProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const memberUserIds = new Set(
    group.members.filter((m) => m.kind === 'member' && m.userId).map((m) => m.userId as string),
  )
  const memberInviteIds = new Set(
    group.members.filter((m) => m.kind === 'invite' && m.inviteId).map((m) => m.inviteId as string),
  )
  const availableMembers = roster.filter((u) => !memberUserIds.has(u.id))
  const availableInvites = pendingInvites.filter((i) => !memberInviteIds.has(i.id))

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  function toggleInvite(inviteId: string) {
    setSelectedInviteIds((current) =>
      current.includes(inviteId) ? current.filter((id) => id !== inviteId) : [...current, inviteId],
    )
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    if (selectedUserIds.length === 0 && selectedInviteIds.length === 0) {
      setError('Select at least one person')
      return
    }
    try {
      const result = await onAddMembers(group.id, selectedUserIds, selectedInviteIds)
      const addedCount =
        (result as { added?: unknown[] }).added?.length ??
        selectedUserIds.length + selectedInviteIds.length
      setSuccess(addedCount > 0 ? `Added ${addedCount} to ${group.name}` : 'Already in this group')
      setSelectedUserIds([])
      setSelectedInviteIds([])
      setShowAdd(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add people')
    }
  }

  async function handleRemove(entry: GroupMemberEntry) {
    setError(null)
    setSuccess(null)
    try {
      await onRemoveMember(group.id, {
        userId: entry.userId ?? undefined,
        inviteId: entry.inviteId ?? undefined,
      })
      setSuccess(`Removed ${entry.displayLabel}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete group "${group.name}"?`)) return
    try {
      await onDelete(group.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group')
    }
  }

  return (
    <aside className="cliq-members">
      <header className="cliq-members__header">
        <div>
          <h3>Members</h3>
          <p>{group.name}</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          Close
        </button>
      </header>

      {canManage && (
        <div className="cliq-members__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setShowAdd((value) => !value)}
          >
            {showAdd ? 'Cancel' : 'Add people'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            Delete group
          </button>
        </div>
      )}

      {showAdd && canManage && (
        <form className="cliq-members__add" onSubmit={handleAdd}>
          {availableMembers.length === 0 && availableInvites.length === 0 ? (
            <p className="cliq-members__hint">
              Everyone is already here. <Link to={routes.users}>Invite more people</Link> first.
            </p>
          ) : (
            <fieldset className="user-card__project-list">
              <legend className="sr-only">Add people to {group.name}</legend>
              {availableMembers.map((member) => (
                <label key={member.id} className="user-card__project-option">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(member.id)}
                    onChange={() => toggleUser(member.id)}
                  />
                  <span>{member.displayEmail ?? member.teamEmail ?? member.email}</span>
                </label>
              ))}
              {availableInvites.map((invite) => (
                <label key={invite.id} className="user-card__project-option">
                  <input
                    type="checkbox"
                    checked={selectedInviteIds.includes(invite.id)}
                    onChange={() => toggleInvite(invite.id)}
                  />
                  <span>{invite.email}</span>
                  <span className="group-card__pending">Pending</span>
                </label>
              ))}
            </fieldset>
          )}
          {(availableMembers.length > 0 || availableInvites.length > 0) && (
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={
                isAdding ||
                (selectedUserIds.length === 0 && selectedInviteIds.length === 0)
              }
            >
              {isAdding ? 'Adding…' : 'Add to group'}
            </button>
          )}
        </form>
      )}

      <ul className="cliq-members__list">
        {group.members.map((entry) => (
          <li key={entry.userId ?? entry.inviteId ?? entry.email} className="cliq-members__item">
            <UserAvatar
              label={entry.displayLabel}
              seed={entry.userId ?? entry.email}
              avatarUrl={entry.avatarUrl}
              className="cliq-avatar cliq-avatar--sm"
            />
            <div className="cliq-members__info">
              <strong>{entry.displayLabel}</strong>
              {entry.isOwner && <span className="user-card__badge">Owner</span>}
              {entry.pending && <span className="group-card__pending">Pending invite</span>}
            </div>
            {canManage && !entry.isOwner && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={isRemoving}
                onClick={() => handleRemove(entry)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="cliq-members__error">{error}</p>}
      {success && <p className="cliq-members__success">{success}</p>}
    </aside>
  )
}
