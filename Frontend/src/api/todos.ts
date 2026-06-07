import { apiRequest, type ApiFetchInit } from './client'
import { sortTodos } from '../lib/todoSort'
import type {
  CreateTodoInput,
  TaskComment,
  TaskStatus,
  TodoFilter,
  TodoKind,
  TodoScope,
  TodoSort,
  TasksWorkspaceResponse,
  TodosResponse,
  UpdateTodoInput,
} from '../types'

interface TodoMutationResponse {
  success: true
  message: string
  todo: TodosResponse['todos'][number]
}

interface TodoDeleteResponse {
  success: true
  message: string
  id: string
}

function buildQuery(params: {
  kind?: TodoKind
  q?: string
  filter?: TodoFilter
  sort?: TodoSort
  projectId?: string | null
  status?: string
  priority?: string
  scope?: TodoScope
  assigneeId?: string | null
}) {
  const search = new URLSearchParams()
  if (params.kind) search.set('kind', params.kind)
  if (params.q) search.set('q', params.q)
  if (params.filter && params.filter !== 'all') search.set('filter', params.filter)
  if (params.sort) search.set('sort', params.sort)
  if (params.projectId) search.set('projectId', params.projectId)
  if (params.status) search.set('status', params.status)
  if (params.priority) search.set('priority', params.priority)
  if (params.scope && params.scope !== 'all') search.set('scope', params.scope)
  if (params.assigneeId) search.set('assigneeId', params.assigneeId)
  const query = search.toString()
  return query ? `?${query}` : ''
}

type TodoListParams = {
  kind?: TodoKind
  q?: string
  filter?: TodoFilter
  sort?: TodoSort
  projectId?: string | null
  status?: string
  priority?: string
  scope?: TodoScope
  assigneeId?: string | null
}

export async function fetchTodos(params: TodoListParams, init?: ApiFetchInit) {
  const sort = params.sort ?? 'newest'
  const data = await apiRequest<TodosResponse>(`/todos${buildQuery({ ...params, sort })}`, init)

  return {
    ...data,
    todos: sortTodos(data.todos, sort),
    sort,
  }
}

export async function fetchTasksWorkspace(
  params: Omit<TodoListParams, 'kind'>,
  init?: ApiFetchInit,
) {
  const sort = params.sort ?? 'newest'
  const data = await apiRequest<TasksWorkspaceResponse>(
    `/todos/workspace${buildQuery({ ...params, sort })}`,
    init,
  )

  return {
    ...data,
    todos: sortTodos(data.todos, sort),
    sort,
  }
}

export function createTodo(input: CreateTodoInput) {
  return apiRequest<TodoMutationResponse>('/todos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTodo({ id, ...input }: UpdateTodoInput) {
  return apiRequest<TodoMutationResponse>(`/todos/edit/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updateTodoStatus(id: string, status: TaskStatus, order?: number) {
  return apiRequest<TodoMutationResponse>(`/todos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, order }),
  })
}

export function moveTodoToProject(id: string, projectId: string) {
  return apiRequest<TodoMutationResponse>(`/todos/${id}/project`, {
    method: 'PATCH',
    body: JSON.stringify({ projectId }),
  })
}

export function deleteTodo(id: string) {
  return apiRequest<TodoDeleteResponse>(`/todos/delete/${id}`, {
    method: 'DELETE',
  })
}

export function clearCompletedPersonalTodos() {
  return apiRequest<{ success: true; message: string; count: number }>('/todos/clear', {
    method: 'POST',
  })
}

interface CommentsResponse {
  success: true
  comments: TaskComment[]
}

interface CommentMutationResponse {
  success: true
  message: string
  comment: TaskComment
}

export function fetchTodoComments(todoId: string) {
  return apiRequest<CommentsResponse>(`/todos/${todoId}/comments`)
}

export function addTodoComment(todoId: string, body: string) {
  return apiRequest<CommentMutationResponse>(`/todos/${todoId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export function deleteTodoComment(todoId: string, commentId: string) {
  return apiRequest<{ success: true; message: string; id: string }>(
    `/todos/${todoId}/comments/${commentId}`,
    { method: 'DELETE' }
  )
}
