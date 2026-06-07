import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMeeting,
  deleteMeeting,
  fetchMeetings,
  notifyMeetingTeam,
} from '../api/meetings'
import type { CreateMeetingInput } from '../types'

export const meetingsQueryKey = ['meetings'] as const

export function useMeetings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: meetingsQueryKey,
    queryFn: ({ signal }) => fetchMeetings({ signal }),
    staleTime: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: meetingsQueryKey })

  const createMutation = useMutation({
    mutationFn: (input: CreateMeetingInput) => createMeeting(input),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMeeting,
    onSuccess: invalidate,
  })

  const notifyMutation = useMutation({
    mutationFn: notifyMeetingTeam,
  })

  return {
    ...query,
    createMeeting: createMutation.mutateAsync,
    deleteMeeting: deleteMutation.mutateAsync,
    notifyMeetingTeam: notifyMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isNotifying: notifyMutation.isPending,
  }
}
