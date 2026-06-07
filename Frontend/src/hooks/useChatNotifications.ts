import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGroups } from '../api/groups'
import { useAuth } from '../context/AuthContext'
import { useChatFocus } from '../context/ChatFocusContext'
import {
  notifyIncomingMessage,
  requestNotificationPermissionOnce,
} from '../lib/chatNotifications'
import { useDirectConversations } from './useDirectMessages'
import { groupsQueryKey } from './useGroups'
import { useUsers } from './useUsers'

interface TrackedMessage {
  key: string
  title: string
  body: string
  tag: string
  fromSelf: boolean
  isFocused: boolean
}

export function useChatNotifications() {
  const { user } = useAuth()
  const { data: usersData } = useUsers()
  const { directConversationId, groupId } = useChatFocus()
  const { data: conversationsData } = useDirectConversations()
  const { data: groupsData } = useQuery({
    queryKey: groupsQueryKey,
    queryFn: ({ signal }) => fetchGroups({ signal }),
    staleTime: 5_000,
    refetchInterval: 5_000,
    enabled: Boolean(user?.id),
  })

  const currentUser = usersData?.currentUser ?? user
  const currentUserId = currentUser?.id
  const availability = currentUser?.availability ?? 'available'
  const baselineSeeded = useRef(false)
  const seenKeys = useRef(new Set<string>())

  useEffect(() => {
    void requestNotificationPermissionOnce()
  }, [])

  useEffect(() => {
    if (!currentUserId) return

    const tracked: TrackedMessage[] = []

    for (const conversation of conversationsData?.conversations ?? []) {
      const message = conversation.lastMessage
      if (!message) continue

      tracked.push({
        key: `dm:${conversation.id}:${message.id}`,
        title: conversation.otherUser.displayLabel,
        body: message.body,
        tag: `dm-${conversation.id}`,
        fromSelf: message.userId === currentUserId,
        isFocused: directConversationId === conversation.id,
      })
    }

    for (const group of groupsData?.groups ?? []) {
      const message = group.lastMessage
      if (!message || message.isSystem) continue

      tracked.push({
        key: `group:${group.id}:${message.id}`,
        title: group.name,
        body: `${message.authorLabel}: ${message.body}`,
        tag: `group-${group.id}`,
        fromSelf: message.userId === currentUserId,
        isFocused: groupId === group.id,
      })
    }

    if (!baselineSeeded.current) {
      for (const entry of tracked) {
        seenKeys.current.add(entry.key)
      }
      baselineSeeded.current = true
      return
    }

    for (const entry of tracked) {
      if (seenKeys.current.has(entry.key)) continue
      seenKeys.current.add(entry.key)
      if (entry.fromSelf || entry.isFocused) continue

      notifyIncomingMessage({
        title: entry.title,
        body: entry.body,
        tag: entry.tag,
        availability,
      })
    }
  }, [
    availability,
    conversationsData,
    currentUserId,
    directConversationId,
    groupId,
    groupsData,
  ])
}
