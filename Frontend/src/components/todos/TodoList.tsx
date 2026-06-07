import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiRequestError } from '../../api/client'
import { AppLayout } from '../layout/AppLayout'
import { useAuth } from '../../context/AuthContext'
import { routes } from '../../lib/routes'
import { useProjectMembers } from '../../hooks/useProjectMembers'
import { useProjects } from '../../hooks/useProjects'
import { useTodos } from '../../hooks/useTodos'
import type {
  CreateTodoInput,
  TaskPriority,
  TaskStatus,
  TasksWorkspaceResponse,
  Todo,
  TodoFilter,
  TodoScope,
  TodoSort,
  UpdateTodoInput,
  ViewMode,
} from '../../types'
import { ProjectSidebar } from '../projects/ProjectSidebar'
import { KanbanBoard } from './KanbanBoard'
import { QuickAddTask } from './QuickAddTask'
import { TasksHero } from './TasksHero'
import { TodoForm } from './TodoForm'
import { TodoItem } from './TodoItem'
import { TodoToolbar } from './TodoToolbar'

function buildTaskUpdate(todo: Todo, patch: Partial<CreateTodoInput>): UpdateTodoInput {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description ?? '',
    projectId: todo.projectId ?? undefined,
    assigneeId: todo.assigneeId ?? null,
    priority: todo.priority,
    dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().slice(0, 10) : '',
    repeatType: todo.repeatType === 'weekly' ? 'weekly' : 'none',
    repeatOn: todo.repeatOn ?? undefined,
    ...patch,
  }
}

export function TodoList() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProjectId = searchParams.get('projectId')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TodoFilter>('all')
  const [scope, setScope] = useState<TodoScope>('all')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [sort, setSort] = useState<TodoSort>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadArchivedProjects, setLoadArchivedProjects] = useState(false)
  const [requestEditProjectId, setRequestEditProjectId] = useState<string | null>(null)

  const {
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    restoreProject,
    isCreating: isCreatingProject,
    isUpdating: isUpdatingProject,
    isDeleting: isDeletingProject,
    isArchiving,
    isRestoring,
  } = useProjects('active', { enabled: false })

  const { data: archivedData } = useProjects('archived', { enabled: loadArchivedProjects })
  const archivedProjects = archivedData?.projects ?? []

  function selectProject(projectId: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (projectId) {
        next.set('projectId', projectId)
      } else {
        next.delete('projectId')
      }
      return next
    })
  }

  const params = useMemo(
    () => ({
      kind: 'task' as const,
      q: query.trim(),
      filter,
      sort,
      projectId: selectedProjectId,
      status: statusFilter,
      priority: priorityFilter,
      scope,
      assigneeId: assigneeFilter,
    }),
    [query, filter, sort, selectedProjectId, statusFilter, priorityFilter, scope, assigneeFilter],
  )

  function canManageTodo(todo: Todo) {
    return !user?.id || todo.ownerId === user.id
  }

  function canUpdateTaskStatus(todo: Todo) {
    return canManageTodo(todo) || Boolean(todo.isAssignedToMe)
  }

  const {
    data,
    isLoading,
    isError,
    error,
    createTodo,
    updateTodo,
    updateTodoStatus,
    moveTodo,
    deleteTodo,
    isCreating,
    isUpdating,
    isUpdatingStatus,
    isMoving,
  } = useTodos(params, { workspace: true })

  const workspaceData = data as TasksWorkspaceResponse | undefined
  const projects = workspaceData?.projects ?? []
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null
  const defaultProjectId = selectedProjectId ?? projects.find((p) => p.isInbox)?.id ?? null
  const memberProjectId = selectedProjectId ?? defaultProjectId
  const { members: projectMembers } = useProjectMembers(memberProjectId, {
    enabled: !isLoading && !!memberProjectId,
  })

  const todos = data?.todos ?? []
  const activeCount = todos.filter((todo) => todo.status !== 'done').length

  useEffect(() => {
    if (!isError || !(error instanceof ApiRequestError) || error.status !== 401) return
    logout().finally(() => navigate(routes.login, { replace: true }))
  }, [isError, error, logout, navigate])

  const canManageSelectedProject = Boolean(
    selectedProject?.isOwner && !selectedProject.isInbox,
  )

  async function handleDeleteSelectedProject() {
    if (!selectedProject || selectedProject.isInbox) return
    const confirmed = window.confirm(
      `Delete "${selectedProject.name}"? Tasks will move to Inbox.`,
    )
    if (!confirmed) return
    await deleteProject(selectedProject.id)
    selectProject(null)
  }

  async function handleArchiveSelectedProject() {
    if (!selectedProject || selectedProject.isInbox) return
    const confirmed = window.confirm(`Archive "${selectedProject.name}"?`)
    if (!confirmed) return
    await archiveProject(selectedProject.id)
    selectProject(null)
  }

  const sidebar = (
    <ProjectSidebar
      projects={projects}
      archivedProjects={archivedProjects}
      selectedProjectId={selectedProjectId}
      onSelectProject={selectProject}
      onCreateProject={createProject}
      onUpdateProject={updateProject}
      onDeleteProject={deleteProject}
      onArchiveProject={archiveProject}
      onRestoreProject={restoreProject}
      isLoading={isLoading}
      loadError={isError ? (error instanceof Error ? error.message : 'Failed to load tasks') : null}
      isCreating={isCreatingProject}
      isUpdating={isUpdatingProject}
      isDeleting={isDeletingProject}
      isArchiving={isArchiving}
      isRestoring={isRestoring}
      onShowArchivedChange={setLoadArchivedProjects}
      requestEditProjectId={requestEditProjectId}
      onRequestEditHandled={() => setRequestEditProjectId(null)}
    />
  )

  return (
    <AppLayout sidebarExtra={sidebar}>
      <div className="tasks-page">
        <TasksHero
          project={selectedProject}
          projects={projects}
          taskCount={todos.length}
          activeCount={activeCount}
          canManageProject={canManageSelectedProject}
          onEditProject={
            canManageSelectedProject
              ? () => setRequestEditProjectId(selectedProject!.id)
              : undefined
          }
          onArchiveProject={canManageSelectedProject ? handleArchiveSelectedProject : undefined}
          onDeleteProject={canManageSelectedProject ? handleDeleteSelectedProject : undefined}
          isArchiving={isArchiving}
          isDeleting={isDeletingProject}
        />

        <div className="tasks-workspace">
          <QuickAddTask
            onSubmit={createTodo}
            isSubmitting={isCreating}
            projects={projects}
            assignableMembers={projectMembers}
            currentUserId={user?.id ?? null}
            defaultProjectId={defaultProjectId}
          />

          <TodoToolbar
            query={query}
            filter={filter}
            scope={scope}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            assigneeFilter={assigneeFilter}
            projectMembers={projectMembers}
            sort={sort}
            viewMode={viewMode}
            count={todos.length}
            activeCount={activeCount}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onScopeChange={setScope}
            onStatusFilterChange={setStatusFilter}
            onPriorityFilterChange={setPriorityFilter}
            onAssigneeFilterChange={setAssigneeFilter}
            onSortChange={setSort}
            onViewModeChange={setViewMode}
          />

          <div className="tasks-workspace__content">
            {isLoading && (
              <div className="state-message state-message--loading">
                <span className="state-message__spinner" aria-hidden="true" />
                Loading tasks…
              </div>
            )}

            {isError && (
              <div className="alert alert--error">
                {error instanceof Error ? error.message : 'Failed to load tasks'}
              </div>
            )}

            {!isLoading && !isError && todos.length === 0 && (
              <div className="tasks-empty">
                <div className="tasks-empty__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h3>{query ? 'No matching tasks' : 'Your workspace is clear'}</h3>
                <p>
                  {query
                    ? 'Try a different search or reset your filters.'
                    : 'Use the bar above to add your first task, or switch to Board view to plan in columns.'}
                </p>
              </div>
            )}

            {!isLoading && !isError && todos.length > 0 && viewMode === 'board' && (
              <KanbanBoard
                todos={todos}
                projects={projects}
                canManageTodo={canManageTodo}
                canUpdateStatus={canUpdateTaskStatus}
                isUpdating={isUpdatingStatus || isMoving}
                onStatusChange={(id, status, order) => updateTodoStatus({ id, status, order })}
                onMoveProject={(id, projectId) => moveTodo({ id, projectId })}
                onEdit={setEditingId}
                onDelete={async (id) => {
                  setDeletingId(id)
                  try {
                    await deleteTodo(id)
                  } finally {
                    setDeletingId(null)
                  }
                }}
                onDueDateChange={async (id, dueDate) => {
                  const todo = todos.find((item) => item.id === id)
                  if (!todo) return
                  await updateTodo(buildTaskUpdate(todo, { dueDate: dueDate ?? '' }))
                }}
              />
            )}

            {!isLoading && !isError && todos.length > 0 && viewMode === 'list' && (
              <ul className="todo-list">
                {todos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    projects={projects}
                    showProjectBadge={!selectedProjectId}
                    canManage={canManageTodo(todo)}
                    canUpdateStatus={canUpdateTaskStatus(todo)}
                    isEditing={editingId === todo.id}
                    onEdit={() => setEditingId(todo.id)}
                    isDeleting={deletingId === todo.id}
                    onDelete={async () => {
                      setDeletingId(todo.id)
                      try {
                        await deleteTodo(todo.id)
                      } finally {
                        setDeletingId(null)
                      }
                    }}
                    onStatusChange={(status) => updateTodoStatus({ id: todo.id, status })}
                    onMoveProject={(projectId) => moveTodo({ id: todo.id, projectId })}
                    onDueDateChange={(dueDate) =>
                      updateTodo(buildTaskUpdate(todo, { dueDate: dueDate ?? '' }))
                    }
                    editForm={
                      <TodoForm
                        initialValues={{
                          title: todo.title,
                          description: todo.description ?? '',
                          projectId: todo.projectId ?? defaultProjectId ?? undefined,
                          assigneeId: todo.assigneeId ?? null,
                          priority: todo.priority,
                          dueDate: todo.dueDate
                            ? new Date(todo.dueDate).toISOString().slice(0, 10)
                            : '',
                          repeatType: todo.repeatType === 'weekly' ? 'weekly' : 'none',
                          repeatOn: todo.repeatOn ?? 'Monday',
                        }}
                        submitLabel="Save changes"
                        isSubmitting={isUpdating}
                        projects={projects}
                        assignableMembers={projectMembers}
                        currentUserId={user?.id ?? null}
                        defaultProjectId={defaultProjectId}
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (values) => {
                          await updateTodo({ id: todo.id, ...values })
                          setEditingId(null)
                        }}
                      />
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {editingId && viewMode === 'board' && (
          <div className="kanban-edit-overlay">
            <div className="kanban-edit-modal">
              <TodoForm
                initialValues={(() => {
                  const todo = todos.find((t) => t.id === editingId)
                  if (!todo) return undefined
                  return {
                    title: todo.title,
                    description: todo.description ?? '',
                    projectId: todo.projectId ?? defaultProjectId ?? undefined,
                    assigneeId: todo.assigneeId ?? null,
                    priority: todo.priority,
                    dueDate: todo.dueDate
                      ? new Date(todo.dueDate).toISOString().slice(0, 10)
                      : '',
                    repeatType: todo.repeatType === 'weekly' ? 'weekly' : 'none',
                    repeatOn: todo.repeatOn ?? 'Monday',
                  }
                })()}
                submitLabel="Save changes"
                isSubmitting={isUpdating}
                projects={projects}
                assignableMembers={projectMembers}
                currentUserId={user?.id ?? null}
                defaultProjectId={defaultProjectId}
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  await updateTodo({ id: editingId, ...values })
                  setEditingId(null)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
