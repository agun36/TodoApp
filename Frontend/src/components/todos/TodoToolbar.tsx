import { useState } from 'react'
import type {
  TaskPriority,
  TaskStatus,
  TodoFilter,
  TodoScope,
  TodoSort,
  ProjectMember,
  ViewMode,
} from '../../types'
import { TASK_PRIORITIES, TASK_STATUSES } from '../../types'
import { AppSelect } from '../ui/AppSelect'

interface TodoToolbarProps {
  query: string
  filter: TodoFilter
  scope: TodoScope
  statusFilter: TaskStatus | ''
  priorityFilter: TaskPriority | ''
  assigneeFilter: string
  projectMembers: ProjectMember[]
  sort: TodoSort
  viewMode: ViewMode
  count: number
  activeCount: number
  onQueryChange: (value: string) => void
  onFilterChange: (value: TodoFilter) => void
  onScopeChange: (value: TodoScope) => void
  onStatusFilterChange: (value: TaskStatus | '') => void
  onPriorityFilterChange: (value: TaskPriority | '') => void
  onAssigneeFilterChange: (value: string) => void
  onSortChange: (value: TodoSort) => void
  onViewModeChange: (value: ViewMode) => void
}

const SCOPES: { value: TodoScope; label: string }[] = [
  { value: 'all', label: 'Team' },
  { value: 'mine', label: 'Mine' },
  { value: 'assigned', label: 'Assigned' },
]

const FILTERS: { value: TodoFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
]

const SORTS: { value: TodoSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'order', label: 'Board order' },
  { value: 'az', label: 'A → Z' },
]

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`filter-pill${active ? ' filter-pill--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function TodoToolbar({
  query,
  filter,
  scope,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  projectMembers,
  sort,
  viewMode,
  count,
  activeCount,
  onQueryChange,
  onFilterChange,
  onScopeChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onAssigneeFilterChange,
  onSortChange,
  onViewModeChange,
}: TodoToolbarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const hasAdvancedFilters = Boolean(statusFilter || priorityFilter || assigneeFilter)

  return (
    <div className="tasks-toolbar">
      <div className="tasks-toolbar__command">
        <label className="tasks-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search tasks…"
          />
        </label>

        <div className="tasks-toolbar__actions">
          <span className="tasks-toolbar__count">
            {count} tasks · {activeCount} active
          </span>
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle__btn${viewMode === 'list' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => onViewModeChange('list')}
            >
              List
            </button>
            <button
              type="button"
              className={`view-toggle__btn${viewMode === 'board' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => onViewModeChange('board')}
            >
              Board
            </button>
          </div>
          <button
            type="button"
            className={`btn btn--ghost btn--sm tasks-toolbar__filters-btn${hasAdvancedFilters ? ' tasks-toolbar__filters-btn--active' : ''}`}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            Filters{hasAdvancedFilters ? ' ·' : ''}
          </button>
        </div>
      </div>

      <div className="tasks-toolbar__pills">
        <span className="tasks-toolbar__pills-label">Scope</span>
        {SCOPES.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={scope === value}
            onClick={() => onScopeChange(value)}
          >
            {label}
          </FilterPill>
        ))}

        <span className="tasks-toolbar__pills-divider" />

        <span className="tasks-toolbar__pills-label">Show</span>
        {FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </FilterPill>
        ))}

        <span className="tasks-toolbar__pills-divider" />

        <div className="tasks-toolbar__sort">
          <span className="sr-only">Sort</span>
          <AppSelect
            value={sort}
            onChange={(value) => onSortChange(value as TodoSort)}
            options={SORTS.map(({ value, label }) => ({
              value,
              label: `Sort: ${label}`,
            }))}
            variant="pill"
            aria-label="Sort tasks"
          />
        </div>
      </div>

      {showAdvanced && (
        <div className="tasks-toolbar__advanced">
          <div className="field field--inline">
            <span>Status</span>
            <AppSelect
              value={statusFilter}
              onChange={(value) => onStatusFilterChange(value as TaskStatus | '')}
              options={[
                { value: '', label: 'Any status' },
                ...TASK_STATUSES.map(({ value, label }) => ({ value, label })),
              ]}
              aria-label="Filter by status"
            />
          </div>

          <div className="field field--inline">
            <span>Priority</span>
            <AppSelect
              value={priorityFilter}
              onChange={(value) => onPriorityFilterChange(value as TaskPriority | '')}
              options={[
                { value: '', label: 'Any priority' },
                ...TASK_PRIORITIES.map(({ value, label }) => ({ value, label })),
              ]}
              aria-label="Filter by priority"
            />
          </div>

          <div className="field field--inline">
            <span>Assignee</span>
            <AppSelect
              value={assigneeFilter}
              onChange={onAssigneeFilterChange}
              options={[
                { value: '', label: 'Anyone' },
                { value: 'me', label: 'Assigned to me' },
                { value: 'unassigned', label: 'Unassigned' },
                ...projectMembers.map((member) => ({
                  value: member.id,
                  label: member.email,
                })),
              ]}
              aria-label="Filter by assignee"
            />
          </div>
        </div>
      )}
    </div>
  )
}
