import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearCompletedPersonalTodos,
  createTodo,
  deleteTodo,
  fetchTasksWorkspace,
  fetchTodos,
  moveTodoToProject,
  updateTodo,
  updateTodoStatus,
} from '../api/todos'
import type {
  CreateTodoInput,
  TaskStatus,
  TodoFilter,
  TodoKind,
  TodoScope,
  TodoSort,
  UpdateTodoInput,
} from '../types'

export type TodoQueryParams = {
  kind: TodoKind
  q: string
  filter: TodoFilter
  sort: TodoSort
  projectId: string | null
  status: string
  priority: string
  scope: TodoScope
  assigneeId: string
}

export const todosQueryKey = (params: TodoQueryParams) => ['todos', params] as const

export const tasksWorkspaceQueryKey = (params: Omit<TodoQueryParams, 'kind'>) =>
  ['tasksWorkspace', params] as const

export function useTodos(
  params: TodoQueryParams,
  options?: { enabled?: boolean; workspace?: boolean },
) {
  const queryClient = useQueryClient()
  const enabled = options?.enabled ?? true
  const useWorkspace = options?.workspace ?? false

  const query = useQuery({
    queryKey: useWorkspace ? tasksWorkspaceQueryKey(params) : todosQueryKey(params),
    queryFn: ({ signal }) =>
      useWorkspace
        ? fetchTasksWorkspace(params, { signal })
        : fetchTodos(params, { signal }),
    staleTime: 15_000,
    retry: useWorkspace ? 0 : 1,
    enabled,
  })

  const refresh = () => {
    const queryKey = useWorkspace ? tasksWorkspaceQueryKey(params) : todosQueryKey(params)
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateTodoInput) => createTodo(input),
    onSuccess: refresh,
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateTodoInput) => updateTodo(input),
    onSuccess: refresh,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status, order }: { id: string; status: TaskStatus; order?: number }) =>
      updateTodoStatus(id, status, order),
    onSuccess: refresh,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: refresh,
  })

  const clearCompletedMutation = useMutation({
    mutationFn: () => clearCompletedPersonalTodos(),
    onSuccess: refresh,
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string }) =>
      moveTodoToProject(id, projectId),
    onSuccess: refresh,
  })

  return {
    ...query,
    createTodo: createMutation.mutateAsync,
    updateTodo: updateMutation.mutateAsync,
    updateTodoStatus: statusMutation.mutateAsync,
    moveTodo: moveMutation.mutateAsync,
    deleteTodo: deleteMutation.mutateAsync,
    clearCompleted: clearCompletedMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isUpdatingStatus: statusMutation.isPending,
    isMoving: moveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearingCompleted: clearCompletedMutation.isPending,
  }
}
