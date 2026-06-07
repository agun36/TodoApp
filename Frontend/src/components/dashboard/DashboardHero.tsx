import { Link } from 'react-router-dom'
import type { DashboardStats } from '../../types'
import { routes } from '../../lib/routes'

interface DashboardHeroProps {
  stats: DashboardStats
}

export function DashboardHero({ stats }: DashboardHeroProps) {
  return (
    <section className="tasks-hero dashboard-hero">
      <div className="tasks-hero__banner">
        <div className="tasks-hero__identity">
          <span className="tasks-hero__project-dot dashboard-hero__dot" aria-hidden="true" />
          <div>
            <p className="tasks-hero__eyebrow">Workspace</p>
            <h1>Dashboard</h1>
            <p className="tasks-hero__description">
              Track project progress, priorities, and team activity at a glance.
            </p>
            <div className="tasks-hero__actions">
              <Link to={routes.tasks} className="btn btn--secondary btn--sm">
                View tasks
              </Link>
            </div>
          </div>
        </div>

        <div className="tasks-hero__metrics">
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{stats.totalProjects}</span>
            <span className="tasks-hero__metric-label">Projects</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{stats.totalTasks}</span>
            <span className="tasks-hero__metric-label">Tasks</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{stats.active}</span>
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
