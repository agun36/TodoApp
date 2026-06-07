import { type FormEvent, useEffect, useState } from 'react'
import { AppSelect } from '../ui/AppSelect'
import { DueDateQuickPick } from './TaskDueDate'
import { WeekdayChips } from '../ui/WeekdayChips'
import { formatRepeatDays, parseRepeatDays } from '../../lib/repeatDays'
import {
  TASK_PRIORITIES,
  type CreateTodoInput,
  type Project,
  type ProjectMember,
  type Weekday,
} from '../../types'

interface TodoFormProps {
  initialValues?: CreateTodoInput
  submitLabel: string
  onSubmit: (values: CreateTodoInput) => Promise<unknown>
  onCancel?: () => void
  isSubmitting?: boolean
  projects?: Project[]
  assignableMembers?: ProjectMember[]
  currentUserId?: string | null
  defaultProjectId?: string | null
}

const REPEAT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
]

export function TodoForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
  projects = [],
  assignableMembers = [],
  currentUserId = null,
  defaultProjectId = null,
}: TodoFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? '')
  const [repeatType, setRepeatType] = useState<'none' | 'weekly'>(
    initialValues?.repeatType ?? 'none',
  )
  const [repeatDays, setRepeatDays] = useState<Weekday[]>(() => {
    const parsed = parseRepeatDays(initialValues?.repeatOn)
    return parsed.length ? parsed : ['Monday']
  })
  const [priority, setPriority] = useState<CreateTodoInput['priority']>(
    initialValues?.priority ?? 'medium',
  )
  const [projectId, setProjectId] = useState(
    initialValues?.projectId ?? defaultProjectId ?? projects.find((p) => p.isInbox)?.id ?? '',
  )
  const [assigneeId, setAssigneeId] = useState(initialValues?.assigneeId ?? '')
  const [error, setError] = useState<string | null>(null)

  const memberOptions = assignableMembers.filter((member) => member.id !== currentUserId)
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }))
  const priorityOptions = TASK_PRIORITIES.map(({ value, label }) => ({ value, label }))
  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...memberOptions.map((member) => ({ value: member.id, label: member.email })),
  ]
  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title)
      setDescription(initialValues.description ?? '')
      setDueDate(initialValues.dueDate ?? '')
      setRepeatType(initialValues.repeatType ?? 'none')
      const parsed = parseRepeatDays(initialValues.repeatOn)
      setRepeatDays(parsed.length ? parsed : ['Monday'])
      setPriority(initialValues.priority ?? 'medium')
      setProjectId(initialValues.projectId ?? defaultProjectId ?? '')
      setAssigneeId(initialValues.assigneeId ?? '')
    }
  }, [initialValues, defaultProjectId])

  useEffect(() => {
    if (!initialValues && defaultProjectId) {
      setProjectId(defaultProjectId)
    }
  }, [defaultProjectId, initialValues])

  useEffect(() => {
    if (!initialValues) {
      setAssigneeId('')
    }
  }, [projectId, initialValues])

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
        kind: 'task',
        title: trimmed,
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        repeatType,
        repeatOn: repeatType === 'weekly' ? formatRepeatDays(repeatDays) : undefined,
        priority,
        projectId: projectId || undefined,
        assigneeId: assigneeId || null,
      })
      if (!initialValues) {
        setTitle('')
        setDescription('')
        setDueDate('')
        setRepeatType('none')
        setRepeatDays(['Monday'])
        setPriority('medium')
        setAssigneeId('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save todo')
    }
  }

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      {error && <div className="alert alert--error">{error}</div>}

      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details…"
          rows={2}
        />
      </label>

      <div className="todo-form__row">
        <div className="field">
          <span>Project</span>
          <AppSelect
            value={projectId}
            onChange={setProjectId}
            options={projectOptions}
            aria-label="Project"
          />
        </div>

        <div className="field">
          <span>Priority</span>
          <AppSelect
            value={priority ?? 'medium'}
            onChange={(value) => setPriority(value as CreateTodoInput['priority'])}
            options={priorityOptions}
            aria-label="Priority"
          />
        </div>

        <div className="field">
          <span>Assign to</span>
          <AppSelect
            value={assigneeId}
            onChange={setAssigneeId}
            options={assigneeOptions}
            aria-label="Assign to"
          />
          {memberOptions.length === 0 && (
            <small className="field-hint">
              Add people on the Team page and add them to this project before assigning tasks.
            </small>
          )}
        </div>
      </div>

      <DueDateQuickPick
        value={dueDate}
        onChange={setDueDate}
        disabled={isSubmitting}
      />

      <div className="todo-form__row">
        <div className="field">
          <span>Repeat</span>
          <AppSelect
            value={repeatType}
            onChange={(value) => setRepeatType(value as 'none' | 'weekly')}
            options={REPEAT_OPTIONS}
            aria-label="Repeat"
          />
        </div>
      </div>

      {repeatType === 'weekly' && (
        <WeekdayChips
          label="Repeat on (pick one or more days)"
          value={repeatDays}
          onChange={setRepeatDays}
          hint={
            repeatDays.length === 0
              ? 'Select at least one day'
              : `${repeatDays.length} day${repeatDays.length === 1 ? '' : 's'}: ${repeatDays.join(', ')}`
          }
        />
      )}

      <div className="todo-form__actions">
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
