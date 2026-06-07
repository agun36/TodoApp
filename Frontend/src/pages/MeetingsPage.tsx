import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { PageHeader } from '../components/layout/PageHeader'
import { AppSelect } from '../components/ui/AppSelect'
import { useAuth } from '../context/AuthContext'
import { useMeetings } from '../hooks/useMeetings'
import { useProjects } from '../hooks/useProjects'
import type { TeamMeeting, Weekday } from '../types'
import { WEEKDAYS } from '../types'

function MeetingCard({
  meeting,
  canManage,
  onNotify,
  onDelete,
  isNotifying,
  isDeleting,
}: {
  meeting: TeamMeeting
  canManage: boolean
  onNotify: (id: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  isNotifying: boolean
  isDeleting: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const schedule =
    meeting.scheduleLabel ??
    (meeting.meetingDays?.length
      ? `Every ${meeting.meetingDays.join(', ')}${meeting.meetingTime ? ` at ${meeting.meetingTime}` : ''}`
      : 'No days scheduled')

  async function handleNotify() {
    setError(null)
    setSuccess(null)
    try {
      const result = await onNotify(meeting.id)
      setSuccess((result as { message?: string }).message ?? 'Notifications sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notifications')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove "${meeting.title}"?`)) return
    setError(null)
    setSuccess(null)
    try {
      await onDelete(meeting.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove meeting')
    }
  }

  return (
    <article className="group-card meeting-card">
      <div className="group-card__header">
        <span
          className="group-card__swatch"
          style={{ backgroundColor: meeting.project?.color ?? '#4f46e5' }}
          aria-hidden="true"
        />
        <div className="group-card__title-wrap">
          <h3 className="group-card__title">{meeting.title}</h3>
          <p className="group-card__meta">
            {meeting.project?.name ?? 'Team'} · {schedule}
          </p>
          {meeting.description && <p className="meeting-card__description">{meeting.description}</p>}
          {meeting.createdByEmail && (
            <p className="group-card__meta">Scheduled by {meeting.createdByEmail}</p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="group-card__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleNotify}
            disabled={isNotifying || isDeleting}
          >
            {isNotifying ? 'Sending…' : 'Email team now'}
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={handleDelete}
            disabled={isNotifying || isDeleting}
          >
            {isDeleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      )}

      {error && <p className="user-card__error">{error}</p>}
      {success && <p className="user-card__success">{success}</p>}
    </article>
  )
}

export function MeetingsPage() {
  const { user, workspace } = useAuth()
  const { data: projectsData } = useProjects('active')
  const {
    data,
    isLoading,
    isError,
    error,
    createMeeting,
    deleteMeeting,
    notifyMeetingTeam,
    isCreating,
    isDeleting,
    isNotifying,
  } = useMeetings()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [meetingDays, setMeetingDays] = useState<Weekday[]>(['Monday', 'Wednesday', 'Friday'])
  const [meetingTime, setMeetingTime] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  const isOwner = user?.isOwner ?? workspace?.ownerId === user?.id
  const projects = useMemo(
    () => (projectsData?.projects ?? []).filter((project) => !project.isInbox),
    [projectsData?.projects],
  )
  const schedulableProjects = useMemo(
    () => projects.filter((project) => isOwner || project.isOwner),
    [projects, isOwner],
  )
  const canSchedule = schedulableProjects.length > 0

  const meetings = data?.meetings ?? []

  useEffect(() => {
    if (!projectId && schedulableProjects[0]?.id) {
      setProjectId(schedulableProjects[0].id)
    }
  }, [projectId, schedulableProjects])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)

    const trimmed = title.trim()
    if (!trimmed) {
      setCreateError('Meeting title is required')
      return
    }
    if (!projectId) {
      setCreateError('Select a team project')
      return
    }
    if (meetingDays.length === 0) {
      setCreateError('Select at least one meeting day')
      return
    }

    try {
      const result = await createMeeting({
        title: trimmed,
        projectId,
        meetingDays,
        meetingTime: meetingTime.trim() || undefined,
        description: description.trim() || undefined,
      })
      setTitle('')
      setDescription('')
      setMeetingTime('')
      setCreateSuccess(result.message)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to schedule meeting')
    }
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Workspace"
        title="Meetings"
        description="Schedule recurring meeting days for a project team — once, twice, or three times a week. Everyone on that project gets an email when you create it, and again on each meeting morning at 8 AM."
      />

      {canSchedule && (
        <section className="team-panel">
          <h2 className="team-panel__title">Schedule a team meeting</h2>
          <p className="team-panel__hint">
            Pick a project team, select one or more days (e.g. Mon / Wed / Fri), and optional time.
            All project members receive an email immediately, plus a reminder on each selected day at
            8 AM.
          </p>
          <form className="meeting-create todo-form" onSubmit={handleCreate}>
            <label className="field">
              <span>Meeting title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly standup"
                required
              />
            </label>

            <div className="todo-form__row">
              <div className="field">
                <span>Team (project)</span>
                <AppSelect
                  value={projectId || schedulableProjects[0]?.id || ''}
                  onChange={setProjectId}
                  options={schedulableProjects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  aria-label="Team project"
                />
              </div>

              <label className="field">
                <span>Time (optional)</span>
                <input
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                />
              </label>
            </div>

            <div className="field">
              <span>Meeting days (pick one or more)</span>
              <div className="meeting-days" role="group" aria-label="Meeting days">
                {WEEKDAYS.map((day) => {
                  const selected = meetingDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`meeting-days__chip${selected ? ' meeting-days__chip--active' : ''}`}
                      aria-pressed={selected}
                      onClick={() =>
                        setMeetingDays((current) =>
                          selected
                            ? current.filter((value) => value !== day)
                            : [...current, day].sort(
                                (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
                              ),
                        )
                      }
                    >
                      {day.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
              <small className="field-hint">
                {meetingDays.length === 0
                  ? 'Select at least one day'
                  : `${meetingDays.length} day${meetingDays.length === 1 ? '' : 's'} selected: ${meetingDays.join(', ')}`}
              </small>
            </div>

            <label className="field">
              <span>Details (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Zoom link, agenda, room number…"
                rows={2}
              />
            </label>

            <button type="submit" className="btn btn--primary btn--sm" disabled={isCreating}>
              {isCreating ? 'Scheduling…' : 'Schedule & notify team'}
            </button>
          </form>
          {createError && <p className="team-panel__error">{createError}</p>}
          {createSuccess && <p className="team-panel__success">{createSuccess}</p>}
        </section>
      )}

      {!canSchedule && !isLoading && (
        <div className="team-member-notice">
          <p>
            Create a project on <strong>Tasks</strong>, add your team on <strong>Team</strong>, then
            schedule meetings here. Only project owners and the workspace owner can schedule.
          </p>
        </div>
      )}

      {isLoading && <div className="state-message">Loading meetings…</div>}

      {isError && (
        <div className="alert alert--error">
          {error instanceof Error ? error.message : 'Failed to load meetings'}
        </div>
      )}

      {!isLoading && !isError && meetings.length > 0 && (
        <div className="groups-grid">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              canManage={
                isOwner ||
                meeting.createdById === user?.id ||
                schedulableProjects.some((project) => project.id === meeting.projectId)
              }
              onNotify={notifyMeetingTeam}
              onDelete={deleteMeeting}
              isNotifying={isNotifying}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && meetings.length === 0 && (
        <div className="state-message">
          {canSchedule
            ? 'No meetings scheduled yet. Create one above to notify your team.'
            : 'No meetings in your workspace yet.'}
        </div>
      )}
    </AppLayout>
  )
}
