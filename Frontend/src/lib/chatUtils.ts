import type { GroupChatMessage } from '../types'

export function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return (label.trim().slice(0, 2) || '?').toUpperCase()
}

export function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateDivider(value: string): string {
  const date = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function groupMessagesByDate(messages: GroupChatMessage[]) {
  const groups: Array<{ dateKey: string; label: string; messages: GroupChatMessage[] }> = []

  for (const message of messages) {
    const dateKey = new Date(message.createdAt).toDateString()
    const last = groups[groups.length - 1]
    if (!last || last.dateKey !== dateKey) {
      groups.push({
        dateKey,
        label: formatDateDivider(message.createdAt),
        messages: [message],
      })
      continue
    }
    last.messages.push(message)
  }

  return groups
}

const CONTINUATION_WINDOW_MS = 5 * 60 * 1000

function isSystemMessage(message: GroupChatMessage) {
  return message.isSystem || message.kind === 'system'
}

export function isMessageContinuation(
  previous: GroupChatMessage | null | undefined,
  message: GroupChatMessage,
) {
  if (!previous || isSystemMessage(previous) || isSystemMessage(message)) return false
  if (previous.userId !== message.userId) return false
  const gap =
    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime()
  return gap >= 0 && gap <= CONTINUATION_WINDOW_MS
}

export function avatarColor(seed: string): string {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return palette[Math.abs(hash) % palette.length]
}
