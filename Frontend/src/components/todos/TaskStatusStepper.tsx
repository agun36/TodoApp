import { useRef, useState } from 'react'
import type { TaskStatus } from '../../types'

const STEPS: { status: TaskStatus; label: string; short: string }[] = [
  { status: 'todo', label: 'To do', short: 'To do' },
  { status: 'in_progress', label: 'In progress', short: 'Working' },
  { status: 'done', label: 'Done', short: 'Done' },
]

const DRAG_THRESHOLD_PX = 56

interface TaskStatusStepperProps {
  status: TaskStatus
  disabled?: boolean
  size?: 'sm' | 'md'
  onChange: (status: TaskStatus) => void | Promise<unknown>
}

export function TaskStatusStepper({
  status,
  disabled = false,
  size = 'md',
  onChange,
}: TaskStatusStepperProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragPx, setDragPx] = useState(0)
  const startX = useRef(0)

  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.status === status),
  )
  const canAdvance = currentIndex < STEPS.length - 1
  const canRetreat = currentIndex > 0
  const segmentPercent = 100 / STEPS.length

  async function commitStatus(next: TaskStatus) {
    if (disabled || pending || next === status) return
    setPending(true)
    try {
      await onChange(next)
    } finally {
      setPending(false)
    }
  }

  function clampDrag(delta: number) {
    const maxRight = canAdvance ? 110 : 12
    const maxLeft = canRetreat ? -110 : -12
    return Math.max(maxLeft, Math.min(maxRight, delta))
  }

  function indexFromClientX(clientX: number) {
    const track = trackRef.current
    if (!track) return currentIndex
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(STEPS.length - 1, Math.floor(ratio * STEPS.length)))
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || pending) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    startX.current = event.clientX
    setDragPx(0)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    setDragPx(clampDrag(event.clientX - startX.current))
  }

  async function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    setDragging(false)
    const delta = event.clientX - startX.current

    if (Math.abs(delta) >= DRAG_THRESHOLD_PX) {
      if (delta > 0 && canAdvance) {
        await commitStatus(STEPS[currentIndex + 1].status)
      } else if (delta < 0 && canRetreat) {
        await commitStatus(STEPS[currentIndex - 1].status)
      }
    } else if (Math.abs(delta) < 6) {
      const targetIndex = indexFromClientX(event.clientX)
      if (targetIndex !== currentIndex) {
        await commitStatus(STEPS[targetIndex].status)
      }
    }

    setDragPx(0)
  }

  const currentStep = STEPS[currentIndex]
  const label = size === 'sm' ? currentStep.short : currentStep.label

  return (
    <div
      className={`task-status-stepper task-status-stepper--${size}${
        disabled || pending ? ' task-status-stepper--disabled' : ''
      }`}
    >
      <div
        ref={trackRef}
        className={`task-status-stepper__track${
          dragging ? ' task-status-stepper__track--dragging' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="task-status-stepper__segments" aria-hidden="true">
          {STEPS.map((step, index) => (
            <span
              key={step.status}
              className={`task-status-stepper__segment${
                index < currentIndex ? ' task-status-stepper__segment--complete' : ''
              }${index === currentIndex ? ' task-status-stepper__segment--current' : ''}`}
            >
              {size === 'sm' ? step.short : step.label}
            </span>
          ))}
        </div>

        {dragPx > 8 && canAdvance && (
          <div
            className="task-status-stepper__progress task-status-stepper__progress--right"
            style={{
              left: `calc(${currentIndex * segmentPercent}% + 4px)`,
              width: `${Math.min(dragPx, 110)}px`,
            }}
            aria-hidden="true"
          />
        )}
        {dragPx < -8 && canRetreat && (
          <div
            className="task-status-stepper__progress task-status-stepper__progress--left"
            style={{
              right: `calc(${(STEPS.length - 1 - currentIndex) * segmentPercent}% + 4px)`,
              width: `${Math.min(Math.abs(dragPx), 110)}px`,
            }}
            aria-hidden="true"
          />
        )}

        <div
          className={`task-status-stepper__thumb task-status-stepper__thumb--${status}`}
          style={{
            width: `${segmentPercent}%`,
            transform: `translateX(calc(${currentIndex * 100}% + ${dragPx}px))`,
          }}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={STEPS.length - 1}
          aria-valuenow={currentIndex}
          aria-valuetext={currentStep.label}
          aria-label="Task status. Hold and drag right to advance."
        >
          <span className="task-status-stepper__grip" aria-hidden="true">
            ⋮⋮
          </span>
          <span className="task-status-stepper__thumb-label">{label}</span>
          {canAdvance && !dragging && (
            <span className="task-status-stepper__chevron" aria-hidden="true">
              →
            </span>
          )}
        </div>
      </div>

      {!dragging && canAdvance && (
        <span className="task-status-stepper__hint">Hold & drag right →</span>
      )}
      {!dragging && !canAdvance && canRetreat && (
        <span className="task-status-stepper__hint">Drag left ← to reopen</span>
      )}
    </div>
  )
}
