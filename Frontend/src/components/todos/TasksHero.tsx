import type { Project } from '../../types'

interface TasksHeroProps {
  project: Project | null
  projects: Project[]
  taskCount: number
  activeCount: number
  canManageProject?: boolean
  onEditProject?: () => void
  onArchiveProject?: () => void
  onDeleteProject?: () => void
  isArchiving?: boolean
  isDeleting?: boolean
}

export function TasksHero({
  project,
  projects,
  taskCount,
  activeCount,
  canManageProject = false,
  onEditProject,
  onArchiveProject,
  onDeleteProject,
  isArchiving = false,
  isDeleting = false,
}: TasksHeroProps) {
  const stats = project?.stats ?? {
    total: projects.reduce((sum, p) => sum + p.stats.total, 0),
    active: projects.reduce((sum, p) => sum + p.stats.active, 0),
    inProgress: projects.reduce((sum, p) => sum + p.stats.inProgress, 0),
    done: projects.reduce((sum, p) => sum + p.stats.done, 0),
    overdue: projects.reduce((sum, p) => sum + p.stats.overdue, 0),
  }

  const accent = project?.color ?? '#6366f1'
  const showProjectActions =
    canManageProject && project && !project.isInbox && (onEditProject || onArchiveProject || onDeleteProject)

  return (
    <section
      className="tasks-hero"
      style={{ '--hero-accent': accent } as React.CSSProperties}
    >
      <div className="tasks-hero__banner">
        <div className="tasks-hero__identity">
          {project && (
            <span
              className="tasks-hero__project-dot"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
          )}
          <div>
            <p className="tasks-hero__eyebrow">
              {project ? (project.isInbox ? 'Inbox' : 'Project workspace') : 'All projects'}
            </p>
            <h1>{project?.name ?? 'All tasks'}</h1>
            {(project?.description || !project) && (
              <p className="tasks-hero__description">
                {project?.description ??
                  'Every task you own or are assigned across your workspace.'}
              </p>
            )}
            {showProjectActions && (
              <div className="tasks-hero__actions">
                {onEditProject && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={onEditProject}>
                    Edit project
                  </button>
                )}
                {onArchiveProject && project.status !== 'archived' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={onArchiveProject}
                    disabled={isArchiving}
                  >
                    {isArchiving ? 'Archiving…' : 'Archive'}
                  </button>
                )}
                {onDeleteProject && (
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={onDeleteProject}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete project'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="tasks-hero__metrics">
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{taskCount}</span>
            <span className="tasks-hero__metric-label">Showing</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{activeCount}</span>
            <span className="tasks-hero__metric-label">Active</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{stats.inProgress}</span>
            <span className="tasks-hero__metric-label">In progress</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{stats.done}</span>
            <span className="tasks-hero__metric-label">Done</span>
          </div>
          {stats.overdue > 0 && (
            <div className="tasks-hero__metric tasks-hero__metric--warn">
              <span className="tasks-hero__metric-value">{stats.overdue}</span>
              <span className="tasks-hero__metric-label">Overdue</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
