import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { routes } from '../../lib/routes'
import { useProjectMembers } from '../../hooks/useProjectMembers'
import type { CreateTodoInput, Project, ProjectMember } from '../../types'
import { AppSelect } from '../ui/AppSelect'
import { DueDateQuickPick } from './TaskDueDate'
import { TodoForm } from './TodoForm'

interface QuickAddTaskProps {
  onSubmit: (values: CreateTodoInput) => Promise<unknown>
  isSubmitting?: boolean
  projects: Project[]
  assignableMembers?: ProjectMember[]
  currentUserId: string | null
  defaultProjectId: string | null
}

export function QuickAddTask({
  onSubmit,
  isSubmitting = false,
  projects,
  currentUserId,
  defaultProjectId,
}: QuickAddTaskProps) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects.find((p) => p.isInbox)?.id ?? '',
  )
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { members } = useProjectMembers(projectId || null)
  const memberOptions = members.filter((member) => member.id !== currentUserId)

  const projectOptions =
    projects.length === 0
      ? [{ value: '', label: 'No projects loaded' }]
      : projects.map((project) => ({ value: project.id, label: project.name }))

  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...memberOptions.map((member) => ({ value: member.id, label: member.email })),
  ]

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId)
      return
    }
    if (!projectId && projects.length > 0) {
      const inbox = projects.find((p) => p.isInbox)
      setProjectId(inbox?.id ?? projects[0].id)
    }
  }, [defaultProjectId, projects, projectId])

  useEffect(() => {
    setAssigneeId('')
  }, [projectId])

  async function handleQuickSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    setError(null)
    try {
      await onSubmit({
        kind: 'task',
        title: trimmed,
        projectId: projectId || undefined,
        assigneeId: assigneeId || null,
        dueDate: dueDate || undefined,
      })
      setTitle('')
      setAssigneeId('')
      setDueDate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    }
  }

  if (showDetails) {
    return (
      <div className="quick-add quick-add--expanded">
        <div className="quick-add__header">
          <h2>New task</h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowDetails(false)}
          >
            Quick mode
          </button>
        </div>
        <TodoForm
          submitLabel="Create task"
          onSubmit={async (values) => {
            await onSubmit(values)
            setShowDetails(false)
          }}
          isSubmitting={isSubmitting}
          projects={projects}
          assignableMembers={members}
          currentUserId={currentUserId}
          defaultProjectId={projectId || defaultProjectId}
        />
      </div>
    )
  }

  return (
    <div className="quick-add">
      <form className="quick-add__form" onSubmit={handleQuickSubmit}>
        <div className="quick-add__bar">
          <span className="quick-add__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            aria-label="Task title"
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? 'Adding…' : 'Add task'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowDetails(true)}
          >
            More options
          </button>
        </div>

        <div className="quick-add__options">
          <div className="quick-add__field">
            <span>Project</span>
            <AppSelect
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
              isDisabled={projects.length === 0}
              aria-label="Project"
            />
          </div>

          <div className="quick-add__field">
            <span>Assign to</span>
            <AppSelect
              value={assigneeId}
              onChange={setAssigneeId}
              options={assigneeOptions}
              isDisabled={!projectId}
              aria-label="Assign to"
            />
          </div>

          <DueDateQuickPick value={dueDate} onChange={setDueDate} disabled={isSubmitting} />

          {memberOptions.length === 0 && projectId && (
            <p className="quick-add__hint">
              Add people on the <Link to={routes.users}>Team</Link> page, then assign tasks here.
            </p>
          )}
        </div>
      </form>
      {error && <p className="quick-add__error">{error}</p>}
    </div>
  )
}
