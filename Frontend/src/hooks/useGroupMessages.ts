import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGroupMessages, sendGroupMessage } from '../api/groups'
import type { GroupMessagesResponse } from '../types'
import { groupsQueryKey } from './useGroups'

export function groupMessagesQueryKey(groupId: string) {
  return ['groupMessages', groupId] as const
}

export function useGroupMessages(groupId: string, enabled = true) {
  const queryClient = useQueryClient()
  const queryKey = groupMessagesQueryKey(groupId)

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchGroupMessages(groupId, { signal }),
    enabled: enabled && Boolean(groupId),
    staleTime: 5_000,
    refetchInterval: enabled ? 5_000 : false,
  })

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendGroupMessage(groupId, body),
    onSuccess: (result) => {
      queryClient.setQueryData<GroupMessagesResponse>(queryKey, (current) => {
        if (!current) return current
        return {
          ...current,
          messages: [...current.messages, result.chatMessage],
        }
      })
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: groupsQueryKey })
    },
  })

  return {
    ...query,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
  }
}
