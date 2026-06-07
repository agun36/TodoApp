import { apiRequest, type ApiFetchInit } from './client'
import type { CreateMeetingInput, MeetingMutationResponse, MeetingsResponse } from '../types'

export function fetchMeetings(init?: ApiFetchInit) {
  return apiRequest<MeetingsResponse>('/meetings', init)
}

export function createMeeting(input: CreateMeetingInput) {
  return apiRequest<MeetingMutationResponse>('/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function notifyMeetingTeam(meetingId: string) {
  return apiRequest<MeetingMutationResponse>(`/meetings/${meetingId}/notify`, {
    method: 'POST',
  })
}

export function deleteMeeting(meetingId: string) {
  return apiRequest<MeetingMutationResponse>(`/meetings/${meetingId}`, {
    method: 'DELETE',
  })
}
