import { Link } from 'react-router-dom'
import { activityItemHref } from '../../lib/dashboardLinks'
import type { ActivityItem } from '../../types'

function formatWhen(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface ActivityFeedProps {
  items: ActivityItem[]
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

function ActivityMessage({ item }: { item: ActivityItem }) {
  const href = activityItemHref(item)

  if (!href) {
    return <p className="activity-feed__message">{item.message}</p>
  }

  return (
    <p className="activity-feed__message">
      <Link to={href} className="activity-feed__link">
        {item.message}
      </Link>
    </p>
  )
}

export function ActivityFeed({
  items,
  page,
  totalPages,
  total,
  onPageChange,
}: ActivityFeedProps) {
  if (total === 0) {
    return <p className="state-message">No activity yet. Create a task or invite a teammate.</p>
  }

  return (
    <div className="activity-feed-wrap">
      <ul className="activity-feed">
        {items.map((item) => (
          <li key={item.id} className="activity-feed__item">
            <span className="activity-feed__dot" aria-hidden="true" />
            <div>
              <ActivityMessage item={item} />
              <p className="activity-feed__meta">{formatWhen(item.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="activity-feed__pagination" aria-label="Activity pagination">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span className="activity-feed__page">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
