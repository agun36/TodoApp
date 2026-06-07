import type { GroupMemberEntry, GroupMentionRosterEntry, MentionScope } from '../types'

export interface MentionContext {
  start: number
  query: string
}

export const BROADCAST_MENTION_OPTIONS: GroupMentionRosterEntry[] = [
  {
    kind: 'broadcast',
    scope: 'all',
    userId: null,
    displayLabel: 'all',
    aliases: ['all', 'channel'],
    description: 'Notify everyone in this channel',
  },
  {
    kind: 'broadcast',
    scope: 'available',
    userId: null,
    displayLabel: 'available',
    aliases: ['available'],
    description: 'Notify members who are Available',
  },
  {
    kind: 'broadcast',
    scope: 'here',
    userId: null,
    displayLabel: 'here',
    aliases: ['here'],
    description: 'Notify members who are active right now',
  },
]

export function getMentionContext(text: string, caret: number): MentionContext | null {
  const beforeCaret = text.slice(0, caret)
  const atIndex = beforeCaret.lastIndexOf('@')
  if (atIndex === -1) return null

  const query = beforeCaret.slice(atIndex + 1)
  if (query.includes('\n')) return null

  const charBeforeAt = atIndex > 0 ? beforeCaret[atIndex - 1] : ' '
  if (charBeforeAt && !/[\s([{]/.test(charBeforeAt)) return null

  return { start: atIndex, query }
}

function matchesMentionQuery(entry: GroupMentionRosterEntry, normalized: string) {
  if (!normalized) return true
  return entry.aliases.some((alias) => alias.toLowerCase().includes(normalized))
    || entry.displayLabel.toLowerCase().includes(normalized)
    || (entry.description?.toLowerCase().includes(normalized) ?? false)
}

export function filterMentionRoster(
  roster: GroupMentionRosterEntry[],
  query: string,
  excludeUserId?: string | null,
) {
  const normalized = query.trim().toLowerCase()
  const broadcasts = roster.filter(
    (entry) => entry.kind === 'broadcast' && matchesMentionQuery(entry, normalized),
  )
  const users = roster.filter((entry) => {
    if (entry.kind === 'broadcast') return false
    if (excludeUserId && entry.userId === excludeUserId) return false
    return matchesMentionQuery(entry, normalized)
  })

  return [...broadcasts, ...users]
}

export function buildRosterFromMembers(
  members: GroupMemberEntry[],
): GroupMentionRosterEntry[] {
  const users = members
    .filter((member) => member.kind === 'member' && member.userId)
    .map((member) => {
      const aliases = new Set<string>()
      const add = (value?: string | null) => {
        const trimmed = value?.trim()
        if (trimmed) aliases.add(trimmed)
      }

      add(member.displayLabel)
      add(member.name)
      add(member.teamEmail)
      add(member.email)

      const label = member.displayLabel?.trim()
      if (label?.includes(' ')) {
        add(label.split(/\s+/)[0])
      }
      if (member.email?.includes('@')) {
        add(member.email.split('@')[0])
      }

      return {
        kind: 'user' as const,
        userId: member.userId as string,
        displayLabel: member.displayLabel,
        avatarUrl: member.avatarUrl ?? null,
        aliases: [...aliases].sort((a, b) => b.length - a.length),
      }
    })

  return [...BROADCAST_MENTION_OPTIONS, ...users]
}

export function mergeRoster(
  primary: GroupMentionRosterEntry[],
  fallback: GroupMentionRosterEntry[],
) {
  const source = primary.length > 0 ? primary : fallback
  const users = source.filter((entry) => entry.kind !== 'broadcast')
  const hasBroadcasts = source.some((entry) => entry.kind === 'broadcast')
  return hasBroadcasts ? source : [...BROADCAST_MENTION_OPTIONS, ...users]
}

export function mentionEntryKey(entry: GroupMentionRosterEntry) {
  if (entry.kind === 'broadcast') return `broadcast:${entry.scope}`
  return entry.userId ?? entry.displayLabel
}

export function broadcastScopeLabel(scope?: MentionScope) {
  if (scope === 'all') return 'Everyone in channel'
  if (scope === 'available') return 'Available members'
  if (scope === 'here') return 'Active members'
  return 'Channel mention'
}
