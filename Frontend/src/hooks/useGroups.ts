import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  fetchGroups,
  removeGroupMember,
} from '../api/groups'
import type { GroupsResponse } from '../types'
import { groupMessagesQueryKey } from './useGroupMessages'

export const groupsQueryKey = ['groups'] as const

function upsertGroupInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  group: GroupsResponse['groups'][number],
) {
  queryClient.setQueryData<GroupsResponse>(groupsQueryKey, (current) => {
    if (!current) return current
    const exists = current.groups.some((entry) => entry.id === group.id)
    const groups = exists
      ? current.groups.map((entry) => (entry.id === group.id ? group : entry))
      : [...current.groups, group]
    groups.sort((a, b) => a.name.localeCompare(b.name))
    return { ...current, groups }
  })
}

export function useGroups() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: groupsQueryKey,
    queryFn: ({ signal }) => fetchGroups({ signal }),
    staleTime: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: groupsQueryKey })

  const createMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => createGroup(name, color),
    onSuccess: (result) => {
      upsertGroupInCache(queryClient, result.group)
      void invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: (result) => {
      queryClient.setQueryData<GroupsResponse>(groupsQueryKey, (current) => {
        if (!current) return current
        return {
          ...current,
          groups: current.groups.filter((group) => group.id !== result.id),
        }
      })
      void invalidate()
    },
  })

  const addMembersMutation = useMutation({
    mutationFn: ({
      groupId,
      userIds,
      inviteIds,
    }: {
      groupId: string
      userIds?: string[]
      inviteIds?: string[]
    }) => addGroupMembers(groupId, { userIds, inviteIds }),
    onSuccess: (result, variables) => {
      upsertGroupInCache(queryClient, result.group)
      void invalidate()
      void queryClient.invalidateQueries({ queryKey: groupMessagesQueryKey(variables.groupId) })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({
      groupId,
      userId,
      inviteId,
    }: {
      groupId: string
      userId?: string
      inviteId?: string
    }) => removeGroupMember(groupId, { userId, inviteId }),
    onSuccess: (result) => {
      upsertGroupInCache(queryClient, result.group)
      void invalidate()
    },
  })

  return {
    ...query,
    createGroup: createMutation.mutateAsync,
    deleteGroup: deleteMutation.mutateAsync,
    addGroupMembers: addMembersMutation.mutateAsync,
    removeGroupMember: removeMemberMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isAddingMembers: addMembersMutation.isPending,
    isRemovingMember: removeMemberMutation.isPending,
  }
}
