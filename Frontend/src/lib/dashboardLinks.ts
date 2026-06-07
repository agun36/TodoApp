import type { ActivityItem, DashboardRecentTodo } from '../types'
import { routes } from './routes'

export function taskListHref(projectId: string | null | undefined): string {
  if (projectId) return routes.tasksWithProject(projectId)
  return routes.tasks
}

export function activityItemHref(item: ActivityItem): string | null {
  if (item.entityType === 'project' && item.entityId) {
    return routes.tasksWithProject(item.entityId)
  }
  if (item.entityType === 'todo') {
    return taskListHref(item.projectId)
  }
  return null
}

export function recentTodoHref(todo: DashboardRecentTodo): string {
  return taskListHref(todo.projectId)
}
