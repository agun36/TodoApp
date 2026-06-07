import type { TaskStatus } from '../types'

export type DueTone = 'none' | 'default' | 'today' | 'soon' | 'overdue' | 'done'

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInputValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatDueDateLong(value: string): string {
  return parseDateInputValue(value.slice(0, 10)).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function getDueDateDisplay(
  dueDate: string | null | undefined,
  status: TaskStatus,
  dueRelative?: string | null,
): { label: string; detail: string | null; tone: DueTone } {
  if (!dueDate) {
    return { label: 'Add due date', detail: null, tone: 'none' }
  }

  const inputValue = dueDate.slice(0, 10)
  const detail = formatDueDateLong(inputValue)

  if (status === 'done') {
    return { label: detail, detail: null, tone: 'done' }
  }

  if (dueRelative === 'Overdue') {
    return { label: 'Overdue', detail, tone: 'overdue' }
  }
  if (dueRelative === 'Today') {
    return { label: 'Today', detail, tone: 'today' }
  }
  if (dueRelative === 'Tomorrow') {
    return { label: 'Tomorrow', detail: null, tone: 'soon' }
  }
  if (dueRelative) {
    return { label: dueRelative, detail: detail !== dueRelative ? detail : null, tone: 'soon' }
  }

  const today = startOfDay(new Date())
  const due = startOfDay(parseDateInputValue(inputValue))
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) {
    return { label: 'Overdue', detail, tone: 'overdue' }
  }
  if (diffDays === 0) {
    return { label: 'Today', detail, tone: 'today' }
  }
  if (diffDays === 1) {
    return { label: 'Tomorrow', detail: null, tone: 'soon' }
  }
  if (diffDays <= 6) {
    return {
      label: due.toLocaleDateString(undefined, { weekday: 'long' }),
      detail: null,
      tone: 'soon',
    }
  }

  return { label: detail, detail: null, tone: 'default' }
}

export function getQuickDueDateOptions() {
  const today = startOfDay(new Date())
  return [
    { label: 'Today', value: toDateInputValue(today) },
    { label: 'Tomorrow', value: toDateInputValue(addDays(today, 1)) },
    { label: 'Next week', value: toDateInputValue(addDays(today, 7)) },
  ]
}
