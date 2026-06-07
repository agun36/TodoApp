import { useMemo, useState } from 'react'
import { UserAvatar } from '../ui/UserAvatar'
import { formatMessageTime } from '../../lib/chatUtils'
import type { DirectConversation } from '../../types'

interface DirectConversationListProps {
  conversations: DirectConversation[]
  teammates: Array<{ id: string; displayLabel: string; avatarUrl?: string | null }>
  selectedConversationId: string | null
  currentUserId?: string | null
  onSelect: (conversationId: string) => void
  onStartChat: (recipientId: string) => Promise<void>
  isStarting: boolean
}

export function DirectConversationList({
  conversations,
  teammates,
  selectedConversationId,
  currentUserId,
  onSelect,
  onStartChat,
  isStarting,
}: DirectConversationListProps) {
  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) =>
      conversation.otherUser.displayLabel.toLowerCase().includes(query),
    )
  }, [conversations, search])

  const availableTeammates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return teammates
      .filter((member) => member.id !== currentUserId)
      .filter((member) => !query || member.displayLabel.toLowerCase().includes(query))
  }, [teammates, search, currentUserId])

  return (
    <aside className="cliq-channels cliq-channels--dms">
      <div className="cliq-channels__head">
        <h2>Chats</h2>
        <button
          type="button"
          className="cliq-channels__new"
          title="New chat"
          onClick={() => setShowNewChat((value) => !value)}
        >
          +
        </button>
      </div>

      {showNewChat && (
        <div className="cliq-channels__create cliq-channels__create--people">
          <p className="cliq-channels__create-label">Message a teammate</p>
          {availableTeammates.length === 0 && (
            <p className="cliq-channels__empty">No teammates available.</p>
          )}
          <ul className="cliq-dm-start-list">
            {availableTeammates.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  className="cliq-dm-start-item"
                  disabled={isStarting}
                  onClick={async () => {
                    await onStartChat(member.id)
                    setShowNewChat(false)
                  }}
                >
                  <UserAvatar
                    label={member.displayLabel}
                    seed={member.id}
                    avatarUrl={member.avatarUrl}
                    className="cliq-avatar cliq-avatar--sm"
                  />
                  <span>{member.displayLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="cliq-channels__search">
        <span className="sr-only">Search chats</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats"
        />
      </label>

      <nav className="cliq-channels__list" aria-label="Direct messages">
        {filteredConversations.length === 0 && (
          <p className="cliq-channels__empty">
            {search ? 'No chats match your search.' : 'No private chats yet. Start one with +.'}
          </p>
        )}
        {filteredConversations.map((conversation) => {
          const active = conversation.id === selectedConversationId
          const preview = conversation.lastMessage?.body ?? 'No messages yet'
          const previewTime = conversation.lastMessage
            ? formatMessageTime(conversation.lastMessage.createdAt)
            : null

          return (
            <button
              key={conversation.id}
              type="button"
              className={`cliq-channel cliq-channel--dm${active ? ' cliq-channel--active' : ''}`}
              onClick={() => onSelect(conversation.id)}
            >
              <UserAvatar
                label={conversation.otherUser.displayLabel}
                seed={conversation.otherUser.id}
                avatarUrl={conversation.otherUser.avatarUrl}
                className="cliq-avatar cliq-avatar--sm"
              />
              <span className="cliq-channel__body">
                <span className="cliq-channel__row">
                  <span className="cliq-channel__name">{conversation.otherUser.displayLabel}</span>
                  {previewTime && <span className="cliq-channel__time">{previewTime}</span>}
                </span>
                <span className="cliq-channel__meta cliq-channel__preview">{preview}</span>
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
