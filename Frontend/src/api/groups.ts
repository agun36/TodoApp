import { apiRequest, type ApiFetchInit } from './client'
import type { GroupMessageResponse, GroupMessagesResponse, GroupResponse, GroupsResponse } from '../types'

export function fetchGroups(init?: ApiFetchInit) {
  return apiRequest<GroupsResponse>('/groups', init)
}

export function createGroup(name: string, color?: string) {
  return apiRequest<GroupResponse>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  })
}

export function deleteGroup(groupId: string) {
  return apiRequest<{ success: true; message: string; id: string }>(`/groups/${groupId}`, {
    method: 'DELETE',
  })
}

export function addGroupMembers(
  groupId: string,
  payload: { userIds?: string[]; inviteIds?: string[] },
) {
  return apiRequest<GroupResponse>(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function removeGroupMember(
  groupId: string,
  payload: { userId?: string; inviteId?: string },
) {
  return apiRequest<GroupResponse>(`/groups/${groupId}/members`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  })
}

export function fetchGroupMessages(groupId: string, init?: ApiFetchInit) {
  return apiRequest<GroupMessagesResponse>(`/groups/${groupId}/messages`, init)
}

export function sendGroupMessage(groupId: string, body: string) {
  return apiRequest<GroupMessageResponse>(`/groups/${groupId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}
