import type { Todo, UpdateTodoInput } from '../../types'
import { TaskDueDate } from './TaskDueDate'

interface PersonalTodoItemProps {
  todo: Todo
  isDeleting?: boolean
  onToggleDone: () => Promise<unknown>
  onEdit: () => void
  onDelete: () => Promise<unknown>
  onDueDateChange: (dueDate: string | null) => Promise<unknown>
}

export function PersonalTodoItem({
  todo,
  isDeleting = false,
  onToggleDone,
  onEdit,
  onDelete,
  onDueDateChange,
}: PersonalTodoItemProps) {
  const isDone = todo.done || todo.status === 'done'
  const isOverdue = !isDone && Boolean(todo.isOverdue)

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${todo.title}"? This cannot be undone.`)
    if (!confirmed) return
    await onDelete()
  }

  return (
    <li
      className={`personal-todo-item${isDone ? ' personal-todo-item--done' : ''}${
        isOverdue ? ' personal-todo-item--overdue' : ''
      }`}
    >
      <button
        type="button"
        className={`personal-todo-item__check${isDone ? ' personal-todo-item__check--done' : ''}`}
        onClick={() => onToggleDone()}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone && (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 12l4 4 8-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="personal-todo-item__body">
        <span className="personal-todo-item__title">{todo.title}</span>
        {todo.repeatLabel && (
          <span className="personal-todo-item__meta">{todo.repeatLabel}</span>
        )}
      </div>

      <div className="personal-todo-item__due">
        <TaskDueDate
          dueDate={todo.dueDate}
          dueRelative={todo.dueRelative}
          isOverdue={todo.isOverdue}
          status={isDone ? 'done' : 'todo'}
          size="sm"
          canEdit
          disabled={isDeleting}
          onChange={onDueDateChange}
        />
      </div>

      <div className="personal-todo-item__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm btn--danger"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </li>
  )
}

export function buildPersonalTodoUpdate(todo: Todo, patch: Partial<UpdateTodoInput>): UpdateTodoInput {
  return {
    id: todo.id,
    kind: 'personal',
    title: todo.title,
    dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
    repeatType: (todo.repeatType as 'none' | 'weekly') ?? 'none',
    repeatOn: todo.repeatOn ?? undefined,
    ...patch,
  }
}
