import { Link } from 'react-router-dom'
import { routes } from '../../lib/routes'
import type { GroupChatMessage } from '../../types'

function mentionClassName(mention?: GroupChatMessage['mentions'][number]) {
  if (mention?.kind === 'broadcast') {
    return 'cliq-msg__mention cliq-msg__mention--broadcast'
  }
  return 'cliq-msg__mention'
}

export function MessageBody({ message }: { message: GroupChatMessage }) {
  if (!message.mentions.length) {
    return <p className="cliq-msg__text">{message.body}</p>
  }

  const aliases = [...message.mentions]
    .map((mention) => mention.alias)
    .sort((a, b) => b.length - a.length)
  const parts: Array<{
    type: 'text' | 'mention'
    value: string
    label?: string
    mention?: GroupChatMessage['mentions'][number]
  }> = []
  let cursor = 0
  const text = message.body

  while (cursor < text.length) {
    const atIndex = text.indexOf('@', cursor)
    if (atIndex === -1) {
      parts.push({ type: 'text', value: text.slice(cursor) })
      break
    }

    if (atIndex > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, atIndex) })
    }

    const afterAt = text.slice(atIndex + 1)
    const matched = aliases.find((alias) =>
      afterAt.toLowerCase().startsWith(alias.toLowerCase()),
    )

    if (!matched) {
      parts.push({ type: 'text', value: '@' })
      cursor = atIndex + 1
      continue
    }

    const mention = message.mentions.find((entry) => entry.alias === matched)
    parts.push({
      type: 'mention',
      value: `@${matched}`,
      label: mention?.displayLabel ?? matched,
      mention,
    })
    cursor = atIndex + 1 + matched.length
  }

  return (
    <p className="cliq-msg__text">
      {parts.map((part, index) =>
        part.type === 'mention' ? (
          part.mention?.kind !== 'broadcast' && part.mention?.userId ? (
            <Link
              key={`${part.value}-${index}`}
              to={routes.profileUser(part.mention.userId)}
              className={`${mentionClassName(part.mention)} cliq-msg__mention-link`}
              title={`View ${part.label}'s profile`}
            >
              {part.value}
            </Link>
          ) : (
            <span
              key={`${part.value}-${index}`}
              className={mentionClassName(part.mention)}
              title={
                part.mention?.kind === 'broadcast' && part.mention.notifiedUserIds
                  ? `${part.label} (${part.mention.notifiedUserIds.length} notified)`
                  : part.label
              }
            >
              {part.value}
            </span>
          )
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        ),
      )}
    </p>
  )
}
