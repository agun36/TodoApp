import { useEffect, useState } from 'react'
import type { Project, TaskStatus, Todo } from '../../types'
import { formatAddedDate } from '../../lib/todoSort'
import { AppSelect } from '../ui/AppSelect'
import { TaskComments } from './TaskComments'
import { TaskDueDate } from './TaskDueDate'
import { TaskStatusStepper } from './TaskStatusStepper'

interface TodoItemProps {
  todo: Todo
  projects?: Project[]
  showProjectBadge?: boolean
  canManage?: boolean
  canUpdateStatus?: boolean
  isEditing: boolean
  onEdit: () => void
  onDelete: () => Promise<unknown>
  onStatusChange: (status: TaskStatus) => Promise<unknown>
  onMoveProject?: (projectId: string) => Promise<unknown>
  onDueDateChange?: (dueDate: string | null) => Promise<unknown>
  editForm: React.ReactNode
  isDeleting?: boolean
}

export function TodoItem({
  todo,
  projects = [],
  showProjectBadge = false,
  canManage = true,
  canUpdateStatus = true,
  isEditing,
  onEdit,
  onDelete,
  onStatusChange,
  onMoveProject,
  onDueDateChange,
  editForm,
  isDeleting = false,
}: TodoItemProps) {
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    if (todo.status !== 'done') setIsChecked(false)
  }, [todo.status])

  const isDone = todo.status === 'done' || isChecked

  if (isEditing) {
    return (
      <li className={`todo-item todo-item--editing todo-item--${todo.priority}`}>
        <span className="todo-item__accent" aria-hidden="true" />
        <div className="todo-item__edit-wrap">{editForm}</div>
      </li>
    )
  }

  async function handleComplete() {
    if (isDone) return
    setIsChecked(true)
    try {
      await onStatusChange('done')
    } catch {
      setIsChecked(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${todo.title}"? This cannot be undone.`)
    if (!confirmed) return
    await onDelete()
  }

  return (
    <li className={`todo-item todo-item--${todo.priority}${isDone ? ' todo-item--done' : ''}`}>
      <span className="todo-item__accent" aria-hidden="true" />
      <div className="todo-item__main">
        <button
          type="button"
          className={`todo-item__check${isDone ? ' todo-item__check--done' : ''}`}
          onClick={handleComplete}
          disabled={isDeleting || isDone}
          aria-label={isDone ? 'Completed' : 'Mark complete'}
          title={isDone ? 'Completed' : 'Mark complete'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              className="todo-item__check-circle"
              cx="12"
              cy="12"
              r="10"
              fill={isDone ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              className="todo-item__check-mark"
              d="M8 12.5 10.5 15 16 9.5"
              fill="none"
              stroke={isDone ? '#fff' : 'currentColor'}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="todo-item__content">
          <div className="todo-item__title-row">
            <p className="todo-item__title">{todo.title}</p>
            <div className="todo-item__title-badges">
              <TaskDueDate
                dueDate={todo.dueDate}
                dueRelative={todo.dueRelative}
                isOverdue={todo.isOverdue}
                status={todo.status}
                canEdit={canManage && Boolean(onDueDateChange)}
                disabled={isDeleting}
                onChange={onDueDateChange}
              />
              <span className={`priority-badge priority-badge--${todo.priority}`}>
                {todo.priority}
              </span>
            </div>
          </div>
          {todo.description && <p className="todo-item__description">{todo.description}</p>}
          <div className="todo-item__meta">
            {showProjectBadge && todo.projectName && (
              <span
                className="project-badge"
                style={{ borderColor: todo.projectColor ?? undefined }}
              >
                <span
                  className="project-badge__dot"
                  style={{ backgroundColor: todo.projectColor ?? '#64748b' }}
                />
                {todo.projectName}
              </span>
            )}
            {todo.assigneeEmail && (
              <span className="assignee-badge">→ {todo.assigneeEmail}</span>
            )}
            {todo.isAssignedToMe && todo.ownerEmail && (
              <span className="assignee-badge assignee-badge--from">from {todo.ownerEmail}</span>
            )}
            {todo.createdAt && (
              <span className="tag tag--muted">Added {formatAddedDate(todo.createdAt)}</span>
            )}
            {todo.repeatLabel && <span className="tag tag--muted">{todo.repeatLabel}</span>}
          </div>
          {canUpdateStatus && (
            <TaskStatusStepper
              status={todo.status}
              disabled={isDeleting}
              onChange={onStatusChange}
            />
          )}
          <TaskComments todoId={todo.id} canDelete={canManage} />
        </div>
      </div>

      <div className="todo-item__actions">
        {canManage && onMoveProject && projects.length > 1 && (
          <AppSelect
            className="todo-item__project-select"
            value={todo.projectId ?? ''}
            onChange={onMoveProject}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
            isDisabled={isDeleting}
            variant="compact"
            aria-label="Move to project"
          />
        )}
        {canManage && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
            Edit
          </button>
        )}
        {canManage && (
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </li>
  )
}
