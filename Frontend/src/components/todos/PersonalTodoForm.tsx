import { type FormEvent, useState } from 'react'
import { AppSelect } from '../ui/AppSelect'
import { WeekdayChips } from '../ui/WeekdayChips'
import { formatRepeatDays, parseRepeatDays } from '../../lib/repeatDays'
import { type CreateTodoInput, type Weekday } from '../../types'
import { DueDateQuickPick } from './TaskDueDate'

interface PersonalTodoFormProps {
  initialValues?: CreateTodoInput
  submitLabel: string
  onSubmit: (values: CreateTodoInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
}

const REPEAT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
]

export function PersonalTodoForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: PersonalTodoFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? '')
  const [repeatType, setRepeatType] = useState<'none' | 'weekly'>(
    initialValues?.repeatType ?? 'none',
  )
  const [repeatDays, setRepeatDays] = useState<Weekday[]>(() => {
    const parsed = parseRepeatDays(initialValues?.repeatOn)
    return parsed.length ? parsed : ['Monday']
  })
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Title is required')
      return
    }
    if (repeatType === 'weekly' && repeatDays.length === 0) {
      setError('Select at least one day for weekly repeat')
      return
    }

    try {
      await onSubmit({
        kind: 'personal',
        title: trimmed,
        dueDate: dueDate || undefined,
        repeatType,
        repeatOn: repeatType === 'weekly' ? formatRepeatDays(repeatDays) : undefined,
      })
      if (!initialValues) {
        setTitle('')
        setDueDate('')
        setRepeatType('none')
        setRepeatDays(['Monday'])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <form className="personal-todo-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Review quarterly goals, schedule dentist"
          required
          autoFocus
        />
      </label>

      <DueDateQuickPick value={dueDate} onChange={setDueDate} disabled={isSubmitting} />

      <div className="field">
        <span>Repeat</span>
        <AppSelect
          value={repeatType}
          onChange={(value) => setRepeatType(value as 'none' | 'weekly')}
          options={REPEAT_OPTIONS}
          aria-label="Repeat"
        />
      </div>

      {repeatType === 'weekly' && (
        <WeekdayChips
          label="Repeat on"
          value={repeatDays}
          onChange={setRepeatDays}
          hint={
            repeatDays.length === 0
              ? 'Select at least one day'
              : `${repeatDays.length} day${repeatDays.length === 1 ? '' : 's'}: ${repeatDays.join(', ')}`
          }
        />
      )}

      {error && <p className="personal-todo-form__error">{error}</p>}

      <div className="personal-todo-form__actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
