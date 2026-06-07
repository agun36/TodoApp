import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addUserToProjects,
  fetchUsers,
  inviteUser,
  revokeInvite,
  setMemberTeamEmail,
  setMemberWorkspaceRole,
  updateProfile,
} from '../api/users'
import type { ProfileUpdatePayload, WorkspaceRole } from '../types'

export const usersQueryKey = ['users'] as const

export function useUsers() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: usersQueryKey,
    queryFn: ({ signal }) => fetchUsers({ signal }),
    staleTime: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: usersQueryKey })

  const inviteMutation = useMutation({
    mutationFn: ({ email, phone }: { email: string; phone?: string }) => inviteUser(email, phone),
    onSuccess: invalidate,
  })

  const setTeamEmailMutation = useMutation({
    mutationFn: ({ userId, teamEmail }: { userId: string; teamEmail: string }) =>
      setMemberTeamEmail(userId, teamEmail),
    onSuccess: invalidate,
  })

  const revokeMutation = useMutation({
    mutationFn: revokeInvite,
    onSuccess: invalidate,
  })

  const addToProjectsMutation = useMutation({
    mutationFn: ({ userId, projectIds }: { userId: string; projectIds: string[] }) =>
      addUserToProjects(userId, projectIds),
    onSuccess: invalidate,
  })

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      setMemberWorkspaceRole(userId, role),
    onSuccess: invalidate,
  })

  const updateProfileMutation = useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => updateProfile(payload),
    onSuccess: invalidate,
  })

  return {
    ...query,
    inviteUser: inviteMutation.mutateAsync,
    setMemberTeamEmail: setTeamEmailMutation.mutateAsync,
    setMemberWorkspaceRole: setRoleMutation.mutateAsync,
    revokeInvite: revokeMutation.mutateAsync,
    addUserToProjects: addToProjectsMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
    isSettingTeamEmail: setTeamEmailMutation.isPending,
    isSettingRole: setRoleMutation.isPending,
    isRevoking: revokeMutation.isPending,
    isAddingToProjects: addToProjectsMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
  }
}
