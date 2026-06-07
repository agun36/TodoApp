import type { Project } from '../../types'

interface ProjectStatsBarProps {
  project: Project | null
  projects: Project[]
}

export function ProjectStatsBar({ project, projects }: ProjectStatsBarProps) {
  const stats = project?.stats ?? {
    total: projects.reduce((sum, p) => sum + p.stats.total, 0),
    active: projects.reduce((sum, p) => sum + p.stats.active, 0),
    inProgress: projects.reduce((sum, p) => sum + p.stats.inProgress, 0),
    done: projects.reduce((sum, p) => sum + p.stats.done, 0),
    overdue: projects.reduce((sum, p) => sum + p.stats.overdue, 0),
  }

  return (
    <div className="project-stats">
      <div className="project-stats__card">
        <span className="project-stats__value">{stats.total}</span>
        <span className="project-stats__label">Total</span>
      </div>
      <div className="project-stats__card">
        <span className="project-stats__value">{stats.active}</span>
        <span className="project-stats__label">Active</span>
      </div>
      <div className="project-stats__card">
        <span className="project-stats__value">{stats.inProgress}</span>
        <span className="project-stats__label">In progress</span>
      </div>
      <div className="project-stats__card">
        <span className="project-stats__value">{stats.done}</span>
        <span className="project-stats__label">Done</span>
      </div>
      <div className="project-stats__card project-stats__card--warn">
        <span className="project-stats__value">{stats.overdue}</span>
        <span className="project-stats__label">Overdue</span>
      </div>
    </div>
  )
}
