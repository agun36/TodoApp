import { WEEKDAYS, type Weekday } from '../../types'

interface WeekdayChipsProps {
  value: Weekday[]
  onChange: (days: Weekday[]) => void
  label?: string
  hint?: string
}

export function WeekdayChips({ value, onChange, label, hint }: WeekdayChipsProps) {
  return (
    <div className="field">
      {label && <span>{label}</span>}
      <div className="meeting-days" role="group" aria-label={label ?? 'Weekdays'}>
        {WEEKDAYS.map((day) => {
          const selected = value.includes(day)
          return (
            <button
              key={day}
              type="button"
              className={`meeting-days__chip${selected ? ' meeting-days__chip--active' : ''}`}
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((current) => current !== day)
                    : [...value, day].sort(
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
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  )
}
