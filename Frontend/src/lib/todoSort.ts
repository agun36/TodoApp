import type { Todo, TodoSort } from '../types'

function getCreatedTime(createdAt?: string): number {
  if (!createdAt) return 0
  const time = new Date(createdAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function sortTodos(todos: Todo[], sort: TodoSort): Todo[] {
  const sorted = [...todos]

  switch (sort) {
    case 'oldest':
      return sorted.sort(
        (a, b) => getCreatedTime(a.createdAt) - getCreatedTime(b.createdAt),
      )
    case 'az':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'due':
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) {
          return getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt)
        }
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
    case 'priority': {
      const rank: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return sorted.sort(
        (a, b) => (rank[a.priority ?? 'medium'] ?? 1) - (rank[b.priority ?? 'medium'] ?? 1),
      )
    }
    case 'order':
      return sorted.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    case 'newest':
    default:
      return sorted.sort(
        (a, b) => getCreatedTime(b.createdAt) - getCreatedTime(a.createdAt),
      )
  }
}

export function formatAddedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
