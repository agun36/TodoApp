import { Link } from 'react-router-dom'
import { getDueDateDisplay } from '../../lib/dueDateUtils'
import { recentTodoHref } from '../../lib/dashboardLinks'
import { routes } from '../../lib/routes'
import type { DashboardRecentTodo } from '../../types'

interface DashboardRecentTasksProps {
  todos: DashboardRecentTodo[]
}

export function DashboardRecentTasks({ todos }: DashboardRecentTasksProps) {
  if (todos.length === 0) {
    return (
      <p className="state-message state-message--inline">
        No project tasks yet.{' '}
        <Link to={routes.tasks}>Create a task</Link>
      </p>
    )
  }

  return (
    <ul className="dashboard-list">
      {todos.map((todo) => {
        const due = getDueDateDisplay(todo.dueDate, todo.status)
        const href = recentTodoHref(todo)

        return (
          <li key={todo.id} className="dashboard-list__item dashboard-list__item--link">
            <Link to={href} className="dashboard-list__link">
              <div className="dashboard-list__link-main">
                <strong>{todo.title}</strong>
                <p>
                  {todo.projectName && (
                    <>
                      <span className="dashboard-list__project">{todo.projectName}</span>
                      {' · '}
                    </>
                  )}
                  <span className={`status-badge status-badge--${todo.status}`}>
                    {todo.status.replace('_', ' ')}
                  </span>
                  {' · '}
                  <span className={`priority-badge priority-badge--${todo.priority}`}>
                    {todo.priority}
                  </span>
                  {todo.dueDate && (
                    <>
                      {' · '}
                      <span
                        className={
                          due.tone === 'overdue'
                            ? 'dashboard-list__overdue'
                            : 'dashboard-list__due'
                        }
                      >
                        {due.label}
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
        )
      })}
    </ul>
  )
}
