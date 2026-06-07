interface PersonalTodosHeroProps {
  totalCount: number
  activeCount: number
  doneCount: number
  overdueCount: number
}

export function PersonalTodosHero({
  totalCount,
  activeCount,
  doneCount,
  overdueCount,
}: PersonalTodosHeroProps) {
  return (
    <section className="tasks-hero personal-todos-hero">
      <div className="tasks-hero__banner">
        <div className="tasks-hero__identity">
          <span className="tasks-hero__project-dot personal-todos-hero__dot" aria-hidden="true" />
          <div>
            <p className="tasks-hero__eyebrow">Personal</p>
            <h1>My todos</h1>
            <p className="tasks-hero__description">
              Private reminders and follow-ups — only you can see these items.
            </p>
          </div>
        </div>

        <div className="tasks-hero__metrics">
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{totalCount}</span>
            <span className="tasks-hero__metric-label">Total</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{activeCount}</span>
            <span className="tasks-hero__metric-label">Active</span>
          </div>
          <div className="tasks-hero__metric">
            <span className="tasks-hero__metric-value">{doneCount}</span>
            <span className="tasks-hero__metric-label">Done</span>
          </div>
          {overdueCount > 0 && (
            <div className="tasks-hero__metric tasks-hero__metric--warn">
              <span className="tasks-hero__metric-value">{overdueCount}</span>
              <span className="tasks-hero__metric-label">Overdue</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
