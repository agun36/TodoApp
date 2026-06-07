import { apiRequest, type ApiFetchInit } from './client'
import type {
  DirectConversationResponse,
  DirectConversationsResponse,
  DirectMessageResponse,
  DirectMessagesResponse,
} from '../types'

export function fetchDirectConversations(init?: ApiFetchInit) {
  return apiRequest<DirectConversationsResponse>('/messages', init)
}

export function openDirectConversation(recipientId: string) {
  return apiRequest<DirectConversationResponse>('/messages', {
    method: 'POST',
    body: JSON.stringify({ recipientId }),
  })
}

export function fetchDirectMessages(conversationId: string, init?: ApiFetchInit) {
  return apiRequest<DirectMessagesResponse>(`/messages/${conversationId}/messages`, init)
}

export function sendDirectMessage(conversationId: string, body: string) {
  return apiRequest<DirectMessageResponse>(`/messages/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}
