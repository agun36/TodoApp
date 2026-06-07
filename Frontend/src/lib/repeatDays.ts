import { WEEKDAYS, type Weekday } from '../types'

export function parseRepeatDays(value?: string | null): Weekday[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((day): day is Weekday => WEEKDAYS.includes(day as Weekday))
}

export function formatRepeatDays(days: Weekday[]): string {
  return [...days]
    .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
    .join(',')
}
