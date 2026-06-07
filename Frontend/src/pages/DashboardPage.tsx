import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import { DashboardHero } from '../components/dashboard/DashboardHero'
import { DashboardRecentTasks } from '../components/dashboard/DashboardRecentTasks'
import { AppLayout } from '../components/layout/AppLayout'
import { ACTIVITY_PAGE_SIZE, useDashboard } from '../hooks/useDashboard'
import { routes } from '../lib/routes'

export function DashboardPage() {
  const [activityPage, setActivityPage] = useState(1)
  const { data, isLoading, isError, error, isFetching } = useDashboard(
    activityPage,
    ACTIVITY_PAGE_SIZE,
  )
  const activity = data?.recentActivity

  return (
    <AppLayout>
      {isLoading && <div className="state-message">Loading dashboard…</div>}

      {isError && (
        <div className="alert alert--error">
          {error instanceof Error ? error.message : 'Failed to load dashboard'}
        </div>
      )}

      {data && (
        <div className="dashboard-page">
          <DashboardHero stats={data.stats} />

          <div className="dashboard-grid">
            <section className="dashboard-card">
              <div className="dashboard-card__header">
                <h2>Priority breakdown</h2>
              </div>
              <div className="dashboard-priority">
                <span className="priority-badge priority-badge--high">
                  High · {data.stats.byPriority.high}
                </span>
                <span className="priority-badge priority-badge--medium">
                  Medium · {data.stats.byPriority.medium}
                </span>
                <span className="priority-badge priority-badge--low">
                  Low · {data.stats.byPriority.low}
                </span>
              </div>
            </section>

            <section className="dashboard-card dashboard-card--wide">
              <div className="dashboard-card__header">
                <h2>Recent activity</h2>
                {activity && activity.total > 0 && (
                  <span className="dashboard-card__meta">
                    {activity.total} total
                    {isFetching && !isLoading ? ' · Updating…' : ''}
                  </span>
                )}
              </div>
              {activity ? (
                <ActivityFeed
                  items={activity.items}
                  page={activity.page}
                  totalPages={activity.totalPages}
                  total={activity.total}
                  onPageChange={setActivityPage}
                />
              ) : (
                <p className="state-message state-message--inline">Loading activity…</p>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card__header">
                <h2>Projects</h2>
                <Link to={routes.tasks} className="dashboard-card__link">
                  View tasks
                </Link>
              </div>
              {data.projects.length === 0 ? (
                <p className="state-message state-message--inline">No projects yet.</p>
              ) : (
                <ul className="dashboard-list">
                  {data.projects.map((project) => (
                    <li key={project.id} className="dashboard-list__item dashboard-list__item--link">
                      <Link
                        to={routes.tasksWithProject(project.id)}
                        className="dashboard-list__link"
                      >
                        <span
                          className="project-sidebar__dot"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="dashboard-list__link-main">
                          <strong>{project.name}</strong>
                          <p>
                            {project.stats.active} active · {project.stats.inProgress} in progress ·{' '}
                            {project.stats.done} done
                            {project.stats.overdue > 0 && (
                              <>
                                {' '}
                                ·{' '}
                                <span className="dashboard-list__overdue">
                                  {project.stats.overdue} overdue
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <span className="dashboard-list__chevron" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card__header">
                <h2>Recent tasks</h2>
                <Link to={routes.tasks} className="dashboard-card__link">
                  View all
                </Link>
              </div>
              <DashboardRecentTasks todos={data.recentTodos} />
            </section>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
