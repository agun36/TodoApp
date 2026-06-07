import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { routes } from '../../lib/routes'
import { useProjectMembers } from '../../hooks/useProjectMembers'
import { PROJECT_COLORS, type Project, type UpdateProjectInput } from '../../types'
import { ProjectCreateModal } from './ProjectCreateModal'

interface ProjectSidebarProps {
  projects: Project[]
  archivedProjects?: Project[]
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  onCreateProject: (input: { name: string; description?: string; color: string }) => Promise<unknown>
  onUpdateProject: (input: UpdateProjectInput & { id: string }) => Promise<unknown>
  onDeleteProject: (id: string) => Promise<unknown>
  onArchiveProject?: (id: string) => Promise<unknown>
  onRestoreProject?: (id: string) => Promise<unknown>
  isLoading?: boolean
  loadError?: string | null
  isCreating?: boolean
  isUpdating?: boolean
  isDeleting?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onShowArchivedChange?: (show: boolean) => void
  requestEditProjectId?: string | null
  onRequestEditHandled?: () => void
}

export function ProjectSidebar({
  projects,
  archivedProjects = [],
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onArchiveProject,
  onRestoreProject,
  isLoading = false,
  loadError = null,
  isCreating = false,
  isUpdating = false,
  isDeleting = false,
  isArchiving = false,
  isRestoring = false,
  onShowArchivedChange,
  requestEditProjectId,
  onRequestEditHandled,
}: ProjectSidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [memberEmail, setMemberEmail] = useState('')

  const {
    members,
    addMember,
    removeMember,
    isAdding: isAddingMember,
    isRemoving: isRemovingMember,
  } = useProjectMembers(editingProject?.isOwner && !editingProject.isInbox ? editingProject.id : null)

  function resetForm() {
    setName('')
    setDescription('')
    setColor(PROJECT_COLORS[0])
    setError(null)
  }

  function openEdit(project: Project) {
    setEditingProject(project)
    setName(project.name)
    setDescription(project.description ?? '')
    setColor(project.color)
    setError(null)
    setShowCreateModal(false)
  }

  useEffect(() => {
    if (!requestEditProjectId) return
    const project =
      projects.find((entry) => entry.id === requestEditProjectId)
      ?? archivedProjects.find((entry) => entry.id === requestEditProjectId)
    if (project) {
      openEdit(project)
    }
    onRequestEditHandled?.()
  }, [requestEditProjectId, projects, archivedProjects, onRequestEditHandled])

  async function handleUpdate(event: FormEvent) {
    event.preventDefault()
    if (!editingProject) return
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Project name is required')
      return
    }
    try {
      await onUpdateProject({
        id: editingProject.id,
        name: trimmed,
        description: description.trim() || undefined,
        color,
      })
      setEditingProject(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project')
    }
  }

  async function handleDelete(project: Project) {
    if (project.isInbox) return
    const confirmed = window.confirm(
      `Delete "${project.name}"? Tasks will move to Inbox.`,
    )
    if (!confirmed) return
    try {
      await onDeleteProject(project.id)
      if (selectedProjectId === project.id) {
        onSelectProject(null)
      }
      if (editingProject?.id === project.id) {
        setEditingProject(null)
        resetForm()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  async function handleArchive(project: Project) {
    if (!onArchiveProject || project.isInbox) return
    const confirmed = window.confirm(`Archive "${project.name}"?`)
    if (!confirmed) return
    try {
      await onArchiveProject(project.id)
      if (selectedProjectId === project.id) {
        onSelectProject(null)
      }
      if (editingProject?.id === project.id) {
        setEditingProject(null)
        resetForm()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive project')
    }
  }

  async function handleRestore(project: Project) {
    if (!onRestoreProject) return
    try {
      await onRestoreProject(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore project')
    }
  }

  return (
    <div className="project-sidebar">
      <div className="project-sidebar__header">
        <div className="project-sidebar__header-row">
          <h2>Projects</h2>
          <Link to={routes.users} className="project-sidebar__team-link">
            Team
          </Link>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setShowCreateModal(true)
            setEditingProject(null)
            resetForm()
          }}
        >
          + New
        </button>
      </div>

      {loadError && <div className="alert alert--error">{loadError}</div>}
      {error && !showCreateModal && <div className="alert alert--error">{error}</div>}

      <ProjectCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={onCreateProject}
        isSubmitting={isCreating}
      />

      {editingProject && (
        <form className="project-sidebar__form" onSubmit={handleUpdate}>
          <p className="project-sidebar__edit-label">Edit project</p>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </label>
          <div className="project-sidebar__colors">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`project-sidebar__color${color === c ? ' project-sidebar__color--active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          {editingProject.isOwner && !editingProject.isInbox && (
            <div className="project-sidebar__members">
              <p className="project-sidebar__edit-label">Team members</p>
              <ul className="project-sidebar__member-list">
                {members.map((member) => (
                  <li key={member.id} className="project-sidebar__member">
                    <span>
                      {member.email}
                      {member.role === 'owner' && (
                        <small className="project-sidebar__member-role"> owner</small>
                      )}
                    </span>
                    {member.role !== 'owner' && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={isRemovingMember}
                        onClick={async () => {
                          try {
                            await removeMember(member.id)
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to remove member')
                          }
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="project-sidebar__member-add"
                onSubmit={async (event) => {
                  event.preventDefault()
                  setError(null)
                  const email = memberEmail.trim()
                  if (!email) return
                  try {
                    await addMember(email)
                    setMemberEmail('')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to add member')
                  }
                }}
              >
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="teammate@email.com"
                />
                <button type="submit" className="btn btn--primary btn--sm" disabled={isAddingMember}>
                  {isAddingMember ? 'Adding…' : 'Add'}
                </button>
              </form>
            </div>
          )}

          <div className="project-sidebar__form-actions">
            <button type="submit" className="btn btn--primary" disabled={isUpdating}>
              {isUpdating ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setEditingProject(null)
                resetForm()
                setMemberEmail('')
              }}
            >
              Cancel
            </button>
          </div>

          {editingProject.isOwner && !editingProject.isInbox && (
            <div className="project-sidebar__danger">
              <p className="project-sidebar__danger-title">Finished with this project?</p>
              <p className="project-sidebar__danger-copy">
                Delete it permanently or archive it to hide it from the active list. Tasks move to
                Inbox when deleted.
              </p>
              <div className="project-sidebar__danger-actions">
                {onArchiveProject && editingProject.status !== 'archived' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={isArchiving}
                    onClick={() => handleArchive(editingProject)}
                  >
                    {isArchiving ? 'Archiving…' : 'Archive project'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={isDeleting}
                  onClick={() => handleDelete(editingProject)}
                >
                  {isDeleting ? 'Deleting…' : 'Delete project'}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {isLoading && projects.length === 0 && (
        <p className="project-sidebar__status">Loading projects…</p>
      )}

      <nav className="project-sidebar__nav">
        <button
          type="button"
          className={`project-sidebar__item${selectedProjectId === null ? ' project-sidebar__item--active' : ''}`}
          onClick={() => onSelectProject(null)}
        >
          <span className="project-sidebar__dot project-sidebar__dot--all" />
          <span className="project-sidebar__item-text">
            <strong>All tasks</strong>
            <small>{projects.reduce((sum, p) => sum + p.stats.total, 0)} tasks</small>
          </span>
        </button>

        {projects.map((project) => (
          <div
            key={project.id}
            className={`project-sidebar__row${selectedProjectId === project.id ? ' project-sidebar__row--active' : ''}`}
          >
            <button
              type="button"
              className="project-sidebar__item"
              onClick={() => onSelectProject(project.id)}
            >
              <span
                className="project-sidebar__dot"
                style={{ backgroundColor: project.color }}
              />
              <span className="project-sidebar__item-text">
                <strong>
                  {project.name}
                  {project.isOwner === false && (
                    <small className="project-sidebar__shared"> · shared</small>
                  )}
                </strong>
                <small>
                  {project.stats.active} active · {project.stats.done} done
                  {project.memberCount ? ` · ${project.memberCount} members` : ''}
                </small>
              </span>
            </button>
            {project.isOwner !== false && !project.isInbox && (
              <div className="project-sidebar__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => openEdit(project)}
                  aria-label={`Edit ${project.name}`}
                >
                  Edit
                </button>
                {onArchiveProject && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleArchive(project)}
                    disabled={isArchiving}
                    aria-label={`Archive ${project.name}`}
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--danger"
                  onClick={() => handleDelete(project)}
                  disabled={isDeleting}
                  aria-label={`Delete ${project.name}`}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </nav>

      {archivedProjects.length > 0 && (
        <div className="project-sidebar__archived">
          <button
            type="button"
            className="project-sidebar__archived-toggle"
            onClick={() => {
              setShowArchived((value) => {
                const next = !value
                onShowArchivedChange?.(next)
                return next
              })
            }}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedProjects.length})
          </button>
          {showArchived && (
            <nav className="project-sidebar__nav project-sidebar__nav--archived">
              {archivedProjects.map((project) => (
                <div key={project.id} className="project-sidebar__row project-sidebar__row--archived">
                  <span className="project-sidebar__item-text">
                    <span
                      className="project-sidebar__dot"
                      style={{ backgroundColor: project.color, opacity: 0.6 }}
                    />
                    <strong>{project.name}</strong>
                    <small>{project.stats.total} tasks</small>
                  </span>
                  {onRestoreProject && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleRestore(project)}
                      disabled={isRestoring}
                    >
                      Restore
                    </button>
                  )}
                  {project.isOwner !== false && !project.isInbox && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger"
                      onClick={() => handleDelete(project)}
                      disabled={isDeleting}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
