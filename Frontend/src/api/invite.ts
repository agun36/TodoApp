import { apiRequest } from './client'
import type { AuthResponse, InvitePreviewResponse } from '../types'

export function fetchInvite(token: string) {
  return apiRequest<InvitePreviewResponse>(`/invite/${token}`)
}

export function joinWorkspace(token: string) {
  return apiRequest<AuthResponse>(`/invite/${token}/join`, { method: 'POST' })
}
