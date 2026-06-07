import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addProjectMember, fetchProjectMembers, removeProjectMember } from '../api/projects'

export const projectMembersQueryKey = (projectId: string) => ['projectMembers', projectId] as const

export function useProjectMembers(
  projectId: string | null,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient()
  const enabled = (options?.enabled ?? true) && !!projectId

  const query = useQuery({
    queryKey: projectMembersQueryKey(projectId ?? ''),
    queryFn: ({ signal }) => fetchProjectMembers(projectId!, { signal }),
    enabled,
    staleTime: 30_000,
  })

  const invalidate = () => {
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: projectMembersQueryKey(projectId) })
    }
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  }

  const addMutation = useMutation({
    mutationFn: (email: string) => addProjectMember(projectId!, email),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId!, userId),
    onSuccess: invalidate,
  })

  return {
    ...query,
    members: query.data?.members ?? [],
    addMember: addMutation.mutateAsync,
    removeMember: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  }
}
