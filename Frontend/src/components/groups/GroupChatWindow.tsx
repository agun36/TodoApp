import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGroupMessages } from '../../hooks/useGroupMessages'
import type { WorkspaceGroup } from '../../types'
import { UserAvatar } from '../ui/UserAvatar'
import {
  formatMessageTime,
  groupMessagesByDate,
  isMessageContinuation,
} from '../../lib/chatUtils'
import { buildRosterFromMembers, mergeRoster } from '../../lib/mentionUtils'
import { routes } from '../../lib/routes'
import { GroupChatComposer } from './GroupChatComposer'
import { MessageBody } from './MessageBody'

interface GroupChatWindowProps {
  group: WorkspaceGroup
  currentUserId?: string | null
  canManage: boolean
  onOpenMembers: () => void
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" fill="none" />
      <path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 11h5M16 15h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" fill="none" />
      <path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function GroupChatWindow({
  group,
  currentUserId,
  canManage,
  onOpenMembers,
}: GroupChatWindowProps) {
  const feedRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, isError, error, sendMessage, isSending } = useGroupMessages(
    group.id,
    true,
  )

  const messages = data?.messages ?? []
  const roster = mergeRoster(data?.roster ?? [], buildRosterFromMembers(group.members))
  const grouped = groupMessagesByDate(messages)
  const hasMentionTargets = roster.some((entry) => entry.kind === 'user')

  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    feed.scrollTop = feed.scrollHeight
  }, [messages.length, group.id])

  return (
    <section className="cliq-chat">
      <header className="cliq-chat__header">
        <div className="cliq-chat__header-main">
          <span
            className="cliq-channel__icon cliq-channel__icon--lg"
            style={{ backgroundColor: group.color }}
            aria-hidden="true"
          >
            #
          </span>
          <div className="cliq-chat__header-copy">
            <h2 className="cliq-chat__title">#{group.name}</h2>
            <p className="cliq-chat__subtitle">
              {group.memberCount} {group.memberCount === 1 ? 'participant' : 'participants'}
            </p>
          </div>
        </div>
        <div className="cliq-chat__header-actions">
          <button
            type="button"
            className="cliq-chat__icon-btn"
            title="View members"
            onClick={onOpenMembers}
          >
            <MembersIcon />
            <span className="sr-only">Members</span>
          </button>
          {canManage && (
            <button
              type="button"
              className="cliq-chat__icon-btn"
              title="Add people"
              onClick={onOpenMembers}
            >
              <UserPlusIcon />
              <span className="sr-only">Add people</span>
            </button>
          )}
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
            <span
              className="cliq-channel__icon cliq-channel__icon--hero"
              style={{ backgroundColor: group.color }}
              aria-hidden="true"
            >
              #
            </span>
            <h3>Welcome to #{group.name}</h3>
            <p>
              This is the beginning of the <strong>#{group.name}</strong> channel. Share updates,
              ask questions, and use <strong>@name</strong>, <strong>@all</strong>,{' '}
              <strong>@available</strong>, or <strong>@here</strong> to notify teammates.
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
                if (message.isSystem || message.kind === 'system') {
                  return (
                    <li key={message.id} className="cliq-system-msg">
                      <div className="cliq-system-msg__pill">
                        <span>{message.body}</span>
                        <time dateTime={message.createdAt}>
                          {formatMessageTime(message.createdAt)}
                        </time>
                      </div>
                    </li>
                  )
                }

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
                        <MessageBody message={message} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <GroupChatComposer
        roster={roster}
        currentUserId={currentUserId}
        disabled={!hasMentionTargets}
        isSending={isSending}
        onSend={sendMessage}
      />
    </section>
  )
}
