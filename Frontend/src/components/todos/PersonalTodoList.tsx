import { useMemo, useState } from 'react'
import { AppLayout } from '../layout/AppLayout'
import { useTodos } from '../../hooks/useTodos'
import type { Todo, TodoFilter, TodoSort } from '../../types'
import { PersonalTodoForm } from './PersonalTodoForm'
import { PersonalTodoItem, buildPersonalTodoUpdate } from './PersonalTodoItem'
import { PersonalTodoToolbar } from './PersonalTodoToolbar'
import { PersonalTodosHero } from './PersonalTodosHero'

export function PersonalTodoList() {
  const [filter, setFilter] = useState<TodoFilter>('active')
  const [sort, setSort] = useState<TodoSort>('newest')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const params = useMemo(
    () => ({
      kind: 'personal' as const,
      q: query.trim(),
      filter: 'all' as const,
      sort,
      projectId: null,
      status: '',
      priority: '',
      scope: 'all' as const,
      assigneeId: '',
    }),
    [query, sort],
  )

  const {
    data,
    isLoading,
    isError,
    error,
    createTodo,
    updateTodo,
    updateTodoStatus,
    deleteTodo,
    clearCompleted,
    isCreating,
    isUpdating,
    isDeleting,
    isClearingCompleted,
  } = useTodos(params)

  const allTodos = data?.todos ?? []
  const todos = useMemo(() => {
    if (filter === 'active') return allTodos.filter((todo) => !todo.done)
    if (filter === 'completed') return allTodos.filter((todo) => todo.done)
    return allTodos
  }, [allTodos, filter])

  const activeCount = allTodos.filter((t) => !t.done).length
  const doneCount = allTodos.filter((t) => t.done).length
  const overdueCount = allTodos.filter((t) => !t.done && t.isOverdue).length

  function handleOpenAddForm(event: React.FormEvent) {
    event.preventDefault()
    if (!newTitle.trim()) return
    setShowAddForm(true)
  }

  async function toggleDone(todo: Todo) {
    await updateTodoStatus({
      id: todo.id,
      status: todo.done ? 'todo' : 'done',
    })
  }

  async function handleClearCompleted() {
    if (doneCount === 0) return
    const confirmed = window.confirm(
      `Clear ${doneCount} completed todo${doneCount === 1 ? '' : 's'}? This cannot be undone.`,
    )
    if (!confirmed) return
    await clearCompleted()
  }

  return (
    <AppLayout>
      <div className="personal-todos-page">
        <PersonalTodosHero
          totalCount={allTodos.length}
          activeCount={activeCount}
          doneCount={doneCount}
          overdueCount={overdueCount}
        />

        {showAddForm ? (
          <div className="personal-todos-add personal-todos-add--expanded">
            <PersonalTodoForm
              key="add-todo"
              initialValues={{ kind: 'personal', title: newTitle.trim() }}
              submitLabel="Add todo"
              isSubmitting={isCreating}
              onCancel={() => setShowAddForm(false)}
              onSubmit={async (values) => {
                await createTodo(values)
                setNewTitle('')
                setShowAddForm(false)
              }}
            />
          </div>
        ) : (
          <form className="personal-todos-quick" onSubmit={handleOpenAddForm}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a personal todo…"
              aria-label="New personal todo"
            />
            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={!newTitle.trim()}
            >
              Add
            </button>
          </form>
        )}

        <PersonalTodoToolbar
          query={query}
          filter={filter}
          sort={sort}
          doneCount={doneCount}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onClearCompleted={doneCount > 0 ? handleClearCompleted : undefined}
          isClearing={isClearingCompleted}
        />

        {isLoading && <p className="personal-todos-status">Loading todos…</p>}
        {isError && (
          <p className="personal-todos-status personal-todos-status--error">
            {error instanceof Error ? error.message : 'Failed to load todos'}
          </p>
        )}

        <ul className="personal-todo-list">
          {todos.map((todo) =>
            editingId === todo.id ? (
              <li key={todo.id} className="personal-todo-item personal-todo-item--editing">
                <PersonalTodoForm
                  initialValues={{
                    kind: 'personal',
                    title: todo.title,
                    dueDate: todo.dueDate?.slice(0, 10),
                    repeatType: (todo.repeatType as 'none' | 'weekly') ?? 'none',
                    repeatOn: todo.repeatOn ?? undefined,
                  }}
                  submitLabel="Save changes"
                  isSubmitting={isUpdating}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (values) => {
                    await updateTodo({ id: todo.id, ...values })
                    setEditingId(null)
                  }}
                />
              </li>
            ) : (
              <PersonalTodoItem
                key={todo.id}
                todo={todo}
                isDeleting={isDeleting && deletingId === todo.id}
                onToggleDone={() => toggleDone(todo)}
                onEdit={() => setEditingId(todo.id)}
                onDelete={async () => {
                  setDeletingId(todo.id)
                  try {
                    await deleteTodo(todo.id)
                  } finally {
                    setDeletingId(null)
                  }
                }}
                onDueDateChange={async (dueDate) => {
                  await updateTodo(
                    buildPersonalTodoUpdate(todo, { dueDate: dueDate ?? '' }),
                  )
                }}
              />
            ),
          )}
        </ul>

        {!isLoading && todos.length === 0 && (
          <div className="personal-todos-empty">
            <h3>No todos here</h3>
            <p>
              {filter === 'completed'
                ? 'You have not completed any todos yet.'
                : query
                  ? 'No todos match your search.'
                  : 'Add a personal todo above to track private follow-ups and reminders.'}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
