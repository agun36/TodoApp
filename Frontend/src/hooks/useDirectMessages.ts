import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchDirectConversations,
  fetchDirectMessages,
  openDirectConversation,
  sendDirectMessage,
} from '../api/messages'
import type { DirectMessagesResponse } from '../types'

export const directConversationsQueryKey = ['directConversations'] as const

export function directMessagesQueryKey(conversationId: string) {
  return ['directMessages', conversationId] as const
}

export function useDirectConversations() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: directConversationsQueryKey,
    queryFn: ({ signal }) => fetchDirectConversations({ signal }),
    staleTime: 5_000,
    refetchInterval: 5_000,
  })

  const openMutation = useMutation({
    mutationFn: (recipientId: string) => openDirectConversation(recipientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: directConversationsQueryKey })
    },
  })

  return {
    ...query,
    openConversation: openMutation.mutateAsync,
    isOpening: openMutation.isPending,
  }
}

export function useDirectMessages(conversationId: string, enabled = true) {
  const queryClient = useQueryClient()
  const queryKey = directMessagesQueryKey(conversationId)

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchDirectMessages(conversationId, { signal }),
    enabled: enabled && Boolean(conversationId),
    staleTime: 3_000,
    refetchInterval: enabled ? 3_000 : false,
  })

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendDirectMessage(conversationId, body),
    onSuccess: (result) => {
      queryClient.setQueryData<DirectMessagesResponse>(queryKey, (current) => {
        if (!current) return current
        return {
          ...current,
          messages: [...current.messages, result.chatMessage],
        }
      })
      void queryClient.invalidateQueries({ queryKey: directConversationsQueryKey })
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    ...query,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
  }
}
