import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskStatus } from '../../types'
import {
  getDueDateDisplay,
  getQuickDueDateOptions,
  toDateInputValue,
} from '../../lib/dueDateUtils'

interface TaskDueDateProps {
  dueDate: string | null
  dueRelative?: string | null
  isOverdue?: boolean
  status: TaskStatus
  canEdit?: boolean
  size?: 'sm' | 'md'
  disabled?: boolean
  onChange?: (dueDate: string | null) => Promise<unknown>
}

export function TaskDueDate({
  dueDate,
  dueRelative,
  isOverdue = false,
  status,
  canEdit = false,
  size = 'md',
  disabled = false,
  onChange,
}: TaskDueDateProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [customDate, setCustomDate] = useState(dueDate?.slice(0, 10) ?? '')
  const [pickerReady, setPickerReady] = useState(false)
  const [pickerStyle, setPickerStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const display = getDueDateDisplay(dueDate, status, dueRelative)
  const tone = display.tone === 'overdue' || (status !== 'done' && isOverdue) ? 'overdue' : display.tone
  const quickOptions = getQuickDueDateOptions()

  useEffect(() => {
    setCustomDate(dueDate?.slice(0, 10) ?? '')
  }, [dueDate])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (pickerRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleScroll() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleScroll)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleScroll)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      setPickerReady(false)
      return
    }

    const trigger = triggerRef.current
    const picker = pickerRef.current
    if (!trigger || !picker) return

    const margin = 8
    const triggerRect = trigger.getBoundingClientRect()
    const pickerRect = picker.getBoundingClientRect()

    let top = triggerRect.bottom + margin
    let left = triggerRect.left

    if (left + pickerRect.width > window.innerWidth - margin) {
      left = triggerRect.right - pickerRect.width
    }
    if (left < margin) left = margin

    if (top + pickerRect.height > window.innerHeight - margin) {
      top = triggerRect.top - pickerRect.height - margin
    }
    if (top < margin) top = margin

    setPickerStyle({ top, left })
    setPickerReady(true)
  }, [open, customDate, dueDate])

  async function applyDueDate(next: string | null) {
    if (!onChange || pending) return
    setPending(true)
    try {
      await onChange(next)
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  function toggleOpen() {
    if (!canEdit || disabled || pending) return
    setOpen((current) => !current)
  }

  return (
    <div
      ref={rootRef}
      className={`task-due-date task-due-date--${size} task-due-date--${tone}${
        canEdit ? ' task-due-date--editable' : ''
      }`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="task-due-date__trigger"
        onClick={toggleOpen}
        disabled={!canEdit || disabled || pending}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={canEdit ? 'Set due date' : display.detail ?? display.label}
      >
        <span className="task-due-date__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="task-due-date__label">{display.label}</span>
        {display.detail && <span className="task-due-date__detail">{display.detail}</span>}
      </button>

      {open &&
        canEdit &&
        createPortal(
          <div
            ref={pickerRef}
            className={`task-due-date__picker task-due-date__picker--floating${
              pickerReady ? ' task-due-date__picker--ready' : ''
            }`}
            style={{ top: pickerStyle.top, left: pickerStyle.left }}
            role="dialog"
            aria-label="Choose due date"
          >
            <p className="task-due-date__picker-title">Due date</p>
            <div className="task-due-date__quick">
              {quickOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`task-due-date__quick-btn${
                    dueDate?.slice(0, 10) === option.value ? ' task-due-date__quick-btn--active' : ''
                  }`}
                  disabled={pending}
                  onClick={() => applyDueDate(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="task-due-date__custom">
              <span>Pick a date</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                disabled={pending}
              />
            </label>
            <div className="task-due-date__picker-actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={pending || !customDate}
                onClick={() => applyDueDate(customDate)}
              >
                {pending ? 'Saving…' : 'Set date'}
              </button>
              {dueDate && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={pending}
                  onClick={() => applyDueDate(null)}
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

interface DueDateQuickPickProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function DueDateQuickPick({ value, onChange, disabled = false }: DueDateQuickPickProps) {
  const [showPicker, setShowPicker] = useState(false)
  const quickOptions = getQuickDueDateOptions()

  return (
    <div className="due-date-quick-pick">
      <span className="due-date-quick-pick__label">Due</span>
      <div className="due-date-quick-pick__chips">
        {quickOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`due-date-quick-pick__chip${
              value === option.value ? ' due-date-quick-pick__chip--active' : ''
            }`}
            disabled={disabled}
            onClick={() => {
              onChange(option.value)
              setShowPicker(false)
            }}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={`due-date-quick-pick__chip${
            showPicker || (value && !quickOptions.some((o) => o.value === value))
              ? ' due-date-quick-pick__chip--active'
              : ''
          }`}
          disabled={disabled}
          onClick={() => setShowPicker((current) => !current)}
        >
          Pick date
        </button>
        {value && (
          <button
            type="button"
            className="due-date-quick-pick__clear"
            disabled={disabled}
            onClick={() => {
              onChange('')
              setShowPicker(false)
            }}
          >
            Clear
          </button>
        )}
      </div>
      {showPicker && (
        <input
          type="date"
          className="due-date-quick-pick__input"
          value={value || toDateInputValue(new Date())}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  )
}
