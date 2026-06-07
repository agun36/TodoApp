import { type FormEvent, useMemo, useState } from 'react'
import type { WorkspaceGroup } from '../../types'
import { PROJECT_COLORS } from '../../types'

interface GroupChannelListProps {
  groups: WorkspaceGroup[]
  selectedGroupId: string | null
  canManage: boolean
  isCreating: boolean
  onSelect: (groupId: string) => void
  onCreate: (name: string, color: string) => Promise<void>
  canChatInGroup: (group: WorkspaceGroup) => boolean
}

export function GroupChannelList({
  groups,
  selectedGroupId,
  canManage,
  isCreating,
  onSelect,
  onCreate,
  canChatInGroup,
}: GroupChannelListProps) {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState<string>(PROJECT_COLORS[0])
  const [createError, setCreateError] = useState<string | null>(null)

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return groups
    return groups.filter((group) => group.name.toLowerCase().includes(query))
  }, [groups, search])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = groupName.trim()
    if (!trimmed) return
    setCreateError(null)
    try {
      await onCreate(trimmed, groupColor)
      setGroupName('')
      setShowCreate(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create group')
    }
  }

  return (
    <aside className="cliq-channels">
      <div className="cliq-channels__head">
        <h2>Channels</h2>
        {canManage && (
          <button
            type="button"
            className="cliq-channels__new"
            title="Create group"
            onClick={() => setShowCreate((value) => !value)}
          >
            +
          </button>
        )}
      </div>

      {showCreate && canManage && (
        <form className="cliq-channels__create" onSubmit={handleCreate}>
          <input
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="New group name"
            aria-label="New group name"
          />
          <div className="cliq-channels__colors" role="group" aria-label="Group color">
            {PROJECT_COLORS.slice(0, 6).map((color) => (
              <button
                key={color}
                type="button"
                className={`cliq-channels__color${groupColor === color ? ' cliq-channels__color--active' : ''}`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
                aria-pressed={groupColor === color}
                onClick={() => setGroupColor(color)}
              />
            ))}
          </div>
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={isCreating || !groupName.trim()}
          >
            {isCreating ? 'Creating…' : 'Create'}
          </button>
          {createError && <p className="cliq-channels__error">{createError}</p>}
        </form>
      )}

      <label className="cliq-channels__search">
        <span className="sr-only">Search groups</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search groups"
        />
      </label>

      <nav className="cliq-channels__list" aria-label="Group channels">
        {filteredGroups.length === 0 && (
          <p className="cliq-channels__empty">
            {search ? 'No groups match your search.' : 'No groups yet.'}
          </p>
        )}
        {filteredGroups.map((group) => {
          const active = group.id === selectedGroupId
          const canChat = canChatInGroup(group)
          return (
            <button
              key={group.id}
              type="button"
              className={`cliq-channel${active ? ' cliq-channel--active' : ''}${!canChat ? ' cliq-channel--locked' : ''}`}
              onClick={() => onSelect(group.id)}
            >
              <span
                className="cliq-channel__icon"
                style={{ backgroundColor: group.color }}
                aria-hidden="true"
              >
                #
              </span>
              <span className="cliq-channel__body">
                <span className="cliq-channel__name">{group.name}</span>
                <span className="cliq-channel__meta">
                  {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                  {!canChat ? ' · view only' : ''}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
