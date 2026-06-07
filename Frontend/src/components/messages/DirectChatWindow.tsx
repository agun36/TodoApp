import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../ui/UserAvatar'
import {
  formatMessageTime,
  groupMessagesByDate,
  isMessageContinuation,
} from '../../lib/chatUtils'
import { availabilityColor, availabilityLabel } from '../../lib/profileOptions'
import { routes } from '../../lib/routes'
import type { DirectChatMessage, DirectConversation } from '../../types'
import { DirectChatComposer } from './DirectChatComposer'

interface DirectChatWindowProps {
  conversation: DirectConversation
  messages: DirectChatMessage[]
  currentUserId?: string | null
  isLoading: boolean
  isError: boolean
  error: unknown
  isSending: boolean
  onSend: (body: string) => Promise<void>
}

export function DirectChatWindow({
  conversation,
  messages,
  currentUserId,
  isLoading,
  isError,
  error,
  isSending,
  onSend,
}: DirectChatWindowProps) {
  const feedRef = useRef<HTMLDivElement>(null)
  const other = conversation.otherUser
  const grouped = groupMessagesByDate(
    messages.map((message) => ({
      ...message,
      groupId: conversation.id,
      mentions: [],
      kind: 'user' as const,
      isSystem: false,
    })),
  )

  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    feed.scrollTop = feed.scrollHeight
  }, [messages.length, conversation.id])

  return (
    <section className="cliq-chat">
      <header className="cliq-chat__header">
        <div className="cliq-chat__header-main">
          <Link
            to={routes.profileUser(other.id)}
            className="cliq-msg__avatar-link"
            title={`View ${other.displayLabel}'s profile`}
          >
            <UserAvatar
              label={other.displayLabel}
              seed={other.id}
              avatarUrl={other.avatarUrl}
              className="cliq-avatar cliq-avatar--header"
            />
          </Link>
          <div className="cliq-chat__header-copy">
            <h2 className="cliq-chat__title">
              <Link to={routes.profileUser(other.id)} className="cliq-msg__author">
                {other.displayLabel}
              </Link>
            </h2>
            <p className="cliq-chat__subtitle cliq-chat__subtitle--status">
              <span
                className="cliq-chat__status-dot"
                style={{ backgroundColor: availabilityColor(other.availability) }}
                aria-hidden="true"
              />
              {availabilityLabel(other.availability)}
              {other.statusMessage ? ` · ${other.statusMessage}` : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="cliq-chat__feed" ref={feedRef}>
        {isLoading && <p className="cliq-chat__empty">Loading conversation…</p>}
        {isError && (
          <p className="cliq-chat__error">
            {error instanceof Error ? error.message : 'Failed to load messages'}
          </p>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="cliq-chat__welcome">
            <UserAvatar
              label={other.displayLabel}
              seed={other.id}
              avatarUrl={other.avatarUrl}
              className="member-profile__avatar"
            />
            <h3>Private chat with {other.displayLabel}</h3>
            <p>
              This is a direct message thread. Only you and {other.displayLabel} can see messages
              here.
            </p>
          </div>
        )}

        {grouped.map((section) => (
          <div key={section.dateKey} className="cliq-chat__day">
            <div className="cliq-chat__day-line">
              <span>{section.label}</span>
            </div>
            <ul className="cliq-chat__messages">
              {section.messages.map((message, index) => {
                const previous = index > 0 ? section.messages[index - 1] : null
                const continued = isMessageContinuation(previous, message)
                const isMine = message.userId === currentUserId

                return (
                  <li
                    key={message.id}
                    className={[
                      'cliq-msg',
                      isMine ? 'cliq-msg--mine' : '',
                      continued ? 'cliq-msg--continued' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {!continued ? (
                      <Link
                        to={routes.profileUser(message.userId)}
                        className="cliq-msg__avatar-link"
                        title={`View ${message.authorLabel}'s profile`}
                      >
                        <UserAvatar
                          label={message.authorLabel}
                          seed={message.userId}
                          avatarUrl={message.authorAvatarUrl}
                          className="cliq-avatar"
                        />
                      </Link>
                    ) : (
                      <span className="cliq-msg__avatar-spacer" aria-hidden="true" />
                    )}
                    <div className="cliq-msg__content">
                      {!continued && (
                        <div className="cliq-msg__meta">
                          <Link
                            to={routes.profileUser(message.userId)}
                            className="cliq-msg__author"
                          >
                            {message.authorLabel}
                          </Link>
                          <time dateTime={message.createdAt}>
                            {formatMessageTime(message.createdAt)}
                          </time>
                        </div>
                      )}
                      <div
                        className="cliq-msg__bubble"
                        title={continued ? formatMessageTime(message.createdAt) : undefined}
                      >
                        {continued && (
                          <time
                            className="cliq-msg__bubble-time"
                            dateTime={message.createdAt}
                          >
                            {formatMessageTime(message.createdAt)}
                          </time>
                        )}
                        <p className="cliq-msg__text">{message.body}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <DirectChatComposer isSending={isSending} onSend={onSend} />
    </section>
  )
}
