import { apiRequest, type ApiFetchInit } from './client'
import type {
  CreateProjectInput,
  Project,
  ProjectMembersResponse,
  ProjectResponse,
  ProjectsResponse,
  ProjectView,
  UpdateProjectInput,
} from '../types'

interface ProjectMutationResponse {
  success: true
  message: string
  project: Project
}

export function fetchProjects(view: ProjectView = 'active', init?: ApiFetchInit) {
  const query = view === 'active' ? '' : `?view=${view}`
  return apiRequest<ProjectsResponse>(`/projects${query}`, init)
}

export function fetchProject(id: string) {
  return apiRequest<ProjectResponse>(`/projects/${id}`)
}

export function createProject(input: CreateProjectInput) {
  return apiRequest<ProjectMutationResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function archiveProject(id: string) {
  return apiRequest<ProjectMutationResponse>(`/projects/${id}/archive`, { method: 'POST' })
}

export function restoreProject(id: string) {
  return apiRequest<ProjectMutationResponse>(`/projects/${id}/restore`, { method: 'POST' })
}

export function updateProject(id: string, input: UpdateProjectInput) {
  return apiRequest<ProjectMutationResponse>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteProject(id: string) {
  return apiRequest<{ success: true; message: string; id: string }>(`/projects/${id}`, {
    method: 'DELETE',
  })
}

export function fetchProjectMembers(projectId: string, init?: ApiFetchInit) {
  return apiRequest<ProjectMembersResponse>(`/projects/${projectId}/members`, init)
}

export function addProjectMember(projectId: string, email: string) {
  return apiRequest<ProjectMembersResponse & { message: string }>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function removeProjectMember(projectId: string, userId: string) {
  return apiRequest<{ success: true; message: string; userId: string }>(
    `/projects/${projectId}/members/${userId}`,
    { method: 'DELETE' },
  )
}
