import type { TodoFilter, TodoSort } from '../../types'
import { AppSelect } from '../ui/AppSelect'

const FILTERS: { value: TodoFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
  { value: 'all', label: 'All' },
]

const SORTS: { value: TodoSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'due', label: 'Due date' },
  { value: 'az', label: 'A → Z' },
]

interface PersonalTodoToolbarProps {
  query: string
  filter: TodoFilter
  sort: TodoSort
  doneCount: number
  onQueryChange: (value: string) => void
  onFilterChange: (value: TodoFilter) => void
  onSortChange: (value: TodoSort) => void
  onClearCompleted?: () => void
  isClearing?: boolean
}

export function PersonalTodoToolbar({
  query,
  filter,
  sort,
  doneCount,
  onQueryChange,
  onFilterChange,
  onSortChange,
  onClearCompleted,
  isClearing = false,
}: PersonalTodoToolbarProps) {
  return (
    <div className="personal-todos-toolbar">
      <label className="tasks-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search todos…"
          aria-label="Search personal todos"
        />
      </label>

      <div className="personal-todos-toolbar__controls">
        <div className="personal-todos-toolbar__filters" role="group" aria-label="Filter todos">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`filter-pill${filter === value ? ' filter-pill--active' : ''}`}
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <AppSelect
          className="personal-todos-toolbar__sort"
          value={sort}
          onChange={(value) => onSortChange(value as TodoSort)}
          options={SORTS}
          aria-label="Sort todos"
          variant="compact"
        />

        {doneCount > 0 && onClearCompleted && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={isClearing}
            onClick={onClearCompleted}
          >
            {isClearing ? 'Clearing…' : `Clear done (${doneCount})`}
          </button>
        )}
      </div>
    </div>
  )
}
