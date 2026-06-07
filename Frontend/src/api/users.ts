import { apiRequest, type ApiFetchInit } from './client'
import type {
  AddUserToProjectsResponse,
  InviteUserResponse,
  ProfileUpdatePayload,
  SetTeamEmailResponse,
  SetWorkspaceRoleResponse,
  UpdateProfileResponse,
  UsersResponse,
  WorkspaceRole,
} from '../types'

export function fetchUsers(init?: ApiFetchInit) {
  return apiRequest<UsersResponse>('/users', init)
}

export function inviteUser(email: string, phone?: string) {
  return apiRequest<InviteUserResponse>('/users/invite', {
    method: 'POST',
    body: JSON.stringify({ email, phone }),
  })
}

export function setMemberTeamEmail(userId: string, teamEmail: string) {
  return apiRequest<SetTeamEmailResponse>(`/users/${userId}/team-email`, {
    method: 'PATCH',
    body: JSON.stringify({ teamEmail }),
  })
}

export function revokeInvite(inviteId: string) {
  return apiRequest<{ success: true; message: string; id: string }>(
    `/users/invites/${inviteId}`,
    { method: 'DELETE' },
  )
}

export function addUserToProjects(userId: string, projectIds: string[]) {
  return apiRequest<AddUserToProjectsResponse>(`/users/${userId}/projects`, {
    method: 'POST',
    body: JSON.stringify({ projectIds }),
  })
}

export function setMemberWorkspaceRole(userId: string, role: WorkspaceRole) {
  return apiRequest<SetWorkspaceRoleResponse>(`/users/${userId}/workspace-role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function updateProfile(payload: ProfileUpdatePayload) {
  return apiRequest<UpdateProfileResponse>('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
