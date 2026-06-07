import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveProject,
  createProject,
  deleteProject,
  fetchProjects,
  restoreProject,
  updateProject,
} from '../api/projects'
import type { CreateProjectInput, ProjectView, UpdateProjectInput } from '../types'

export const projectsQueryKey = (view: ProjectView = 'active') => ['projects', view] as const

export function useProjects(view: ProjectView = 'active', options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true

  const query = useQuery({
    queryKey: projectsQueryKey(view),
    queryFn: ({ signal }) => fetchProjects(view, { signal }),
    staleTime: 15_000,
    enabled,
  })

  const invalidateProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: invalidateProjects,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) =>
      updateProject(id, input),
    onSuccess: invalidateProjects,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      invalidateProjects()
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveProject(id),
    onSuccess: invalidateProjects,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreProject(id),
    onSuccess: invalidateProjects,
  })

  return {
    ...query,
    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteProject: deleteMutation.mutateAsync,
    archiveProject: archiveMutation.mutateAsync,
    restoreProject: restoreMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
  }
}
