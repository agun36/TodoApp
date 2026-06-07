import type { Project, TaskStatus, Todo } from '../../types'
import { AppSelect } from '../ui/AppSelect'
import { TaskDueDate } from './TaskDueDate'
import { TaskStatusStepper } from './TaskStatusStepper'

interface KanbanBoardProps {
  todos: Todo[]
  projects?: Project[]
  canManageTodo?: (todo: Todo) => boolean
  canUpdateStatus?: (todo: Todo) => boolean
  onStatusChange: (id: string, status: TaskStatus, order?: number) => Promise<unknown>
  onMoveProject?: (id: string, projectId: string) => Promise<unknown>
  onEdit: (id: string) => void
  onDelete: (id: string) => Promise<unknown>
  onDueDateChange?: (id: string, dueDate: string | null) => Promise<unknown>
  isUpdating?: boolean
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
]

export function KanbanBoard({
  todos,
  projects = [],
  canManageTodo = () => true,
  canUpdateStatus = () => true,
  onStatusChange,
  onMoveProject,
  onEdit,
  onDelete,
  onDueDateChange,
  isUpdating = false,
}: KanbanBoardProps) {
  function handleDragStart(event: React.DragEvent, todoId: string) {
    event.dataTransfer.setData('text/todo-id', todoId)
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(event: React.DragEvent, status: TaskStatus) {
    event.preventDefault()
    const todoId = event.dataTransfer.getData('text/todo-id')
    if (!todoId) return
    const todo = todos.find((t) => t.id === todoId)
    if (!todo) return

    const columnTodos = todos.filter((t) => t.status === status)
    const order = columnTodos.length

    if (todo.status === status) return
    if (!canUpdateStatus(todo)) return
    await onStatusChange(todoId, status, order)
  }

  async function handleDelete(todo: Todo) {
    const confirmed = window.confirm(`Delete "${todo.title}"? This cannot be undone.`)
    if (!confirmed) return
    await onDelete(todo.id)
  }

  return (
    <div className="kanban">
      {COLUMNS.map(({ status, label }) => {
        const columnTodos = todos
          .filter((t) => t.status === status)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        return (
          <div
            key={status}
            className="kanban__column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="kanban__column-header">
              <h3>{label}</h3>
              <span>{columnTodos.length}</span>
            </div>
            <div className="kanban__cards">
              {columnTodos.map((todo) => (
                <article
                  key={todo.id}
                  className="kanban__card"
                  draggable={!isUpdating && canUpdateStatus(todo)}
                  onDragStart={(e) => handleDragStart(e, todo.id)}
                >
                  <div className="kanban__card-top">
                    <span className={`priority-badge priority-badge--${todo.priority}`}>
                      {todo.priority}
                    </span>
                    {todo.projectName && (
                      <span
                        className="project-badge project-badge--sm"
                        style={{ borderColor: todo.projectColor ?? undefined }}
                      >
                        <span
                          className="project-badge__dot"
                          style={{ backgroundColor: todo.projectColor ?? '#64748b' }}
                        />
                        {todo.projectName}
                      </span>
                    )}
                  </div>
                  <p className="kanban__card-title">{todo.title}</p>
                  <TaskDueDate
                    dueDate={todo.dueDate}
                    dueRelative={todo.dueRelative}
                    isOverdue={todo.isOverdue}
                    status={todo.status}
                    size="sm"
                    canEdit={canManageTodo(todo) && Boolean(onDueDateChange)}
                    disabled={isUpdating}
                    onChange={
                      onDueDateChange
                        ? (dueDate) => onDueDateChange(todo.id, dueDate)
                        : undefined
                    }
                  />
                  {todo.assigneeEmail && (
                    <p className="kanban__card-assignee">→ {todo.assigneeEmail}</p>
                  )}
                  {todo.isAssignedToMe && todo.ownerEmail && (
                    <p className="kanban__card-assignee">from {todo.ownerEmail}</p>
                  )}
                  {canUpdateStatus(todo) && (
                    <TaskStatusStepper
                      status={todo.status}
                      size="sm"
                      disabled={isUpdating}
                      onChange={(next) => onStatusChange(todo.id, next)}
                    />
                  )}
                  <div className="kanban__card-actions">
                    {canManageTodo(todo) && onMoveProject && projects.length > 1 && (
                      <AppSelect
                        className="kanban__project-select"
                        value={todo.projectId ?? ''}
                        onChange={(projectId) => onMoveProject(todo.id, projectId)}
                        options={projects.map((project) => ({
                          value: project.id,
                          label: project.name,
                        }))}
                        isDisabled={isUpdating}
                        variant="compact"
                        aria-label="Move to project"
                      />
                    )}
                    {canManageTodo(todo) && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => onEdit(todo.id)}
                      >
                        Edit
                      </button>
                    )}
                    {canManageTodo(todo) && (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => handleDelete(todo)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {columnTodos.length === 0 && (
                <p className="kanban__empty">Drop tasks here</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
