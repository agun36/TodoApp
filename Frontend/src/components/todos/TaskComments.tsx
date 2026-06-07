import { useEffect, useState } from 'react'
import { addTodoComment, deleteTodoComment, fetchTodoComments } from '../../api/todos'
import type { TaskComment } from '../../types'

interface TaskCommentsProps {
  todoId: string
  canDelete?: boolean
}

export function TaskComments({ todoId, canDelete = true }: TaskCommentsProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchTodoComments(todoId)
      .then((res) => {
        if (!cancelled) setComments(res.comments)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load comments')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, todoId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError('')
    try {
      const res = await addTodoComment(todoId, trimmed)
      setComments((prev) => [...prev, res.comment])
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: string) {
    setError('')
    try {
      await deleteTodoComment(todoId, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  return (
    <div className="task-comments">
      <button
        type="button"
        className="btn btn--ghost btn--sm task-comments__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide comments' : 'Comments'}
        {comments.length > 0 && !open ? ` (${comments.length})` : ''}
      </button>

      {open && (
        <div className="task-comments__panel">
          {loading && <p className="task-comments__hint">Loading…</p>}
          {error && <p className="task-comments__error">{error}</p>}
          {!loading && comments.length === 0 && (
            <p className="task-comments__hint">No comments yet.</p>
          )}
          <ul className="task-comments__list">
            {comments.map((comment) => (
              <li key={comment.id} className="task-comments__item">
                <div>
                  <strong>{comment.authorEmail ?? 'User'}</strong>
                  <p>{comment.body}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleDelete(comment.id)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form className="task-comments__form" onSubmit={handleSubmit}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              disabled={submitting}
            />
            <button type="submit" className="btn btn--sm" disabled={submitting || !body.trim()}>
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
