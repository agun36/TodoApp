import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { GroupMentionRosterEntry } from '../../types'
import { UserAvatar } from '../ui/UserAvatar'
import { filterMentionRoster, getMentionContext, mentionEntryKey, broadcastScopeLabel } from '../../lib/mentionUtils'

interface GroupChatComposerProps {
  roster: GroupMentionRosterEntry[]
  currentUserId?: string | null
  disabled?: boolean
  isSending?: boolean
  onSend: (body: string) => Promise<void>
}

export function GroupChatComposer({
  roster,
  currentUserId = null,
  disabled = false,
  isSending = false,
  onSend,
}: GroupChatComposerProps) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [caret, setCaret] = useState(0)
  const [forcePicker, setForcePicker] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mentionContext = useMemo(
    () => getMentionContext(body, caret),
    [body, caret],
  )

  const mentionSuggestions = useMemo(
    () =>
      filterMentionRoster(
        roster,
        mentionContext?.query ?? (forcePicker ? '' : ''),
        currentUserId,
      ),
    [roster, mentionContext, forcePicker, currentUserId],
  )

  const hasMentionTargets = roster.some((entry) => entry.kind === 'user')

  const showMentionPicker =
    !disabled &&
    hasMentionTargets &&
    (forcePicker || mentionContext !== null) &&
    mentionSuggestions.length > 0

  useEffect(() => {
    setHighlightIndex(0)
  }, [mentionContext?.query, forcePicker, mentionSuggestions.length])

  function syncCaret() {
    const nextCaret = textareaRef.current?.selectionStart ?? body.length
    setCaret(nextCaret)
    return nextCaret
  }

  function updateMentionQuery(value: string, nextCaret: number) {
    setBody(value)
    setCaret(nextCaret)
    const context = getMentionContext(value, nextCaret)
    setForcePicker(context !== null)
  }

  function insertMention(entry: GroupMentionRosterEntry) {
    const textarea = textareaRef.current
    const nextCaret = textarea?.selectionStart ?? caret
    const context = getMentionContext(body, nextCaret)
    const alias = entry.displayLabel

    let nextValue = body
    let cursor = nextCaret

    if (context) {
      nextValue = `${body.slice(0, context.start)}@${alias} ${body.slice(nextCaret)}`
      cursor = context.start + alias.length + 2
    } else {
      const before = body.slice(0, nextCaret)
      const after = body.slice(nextCaret)
      nextValue = `${before}@${alias} ${after}`
      cursor = nextCaret + alias.length + 2
    }

    setBody(nextValue)
    setCaret(cursor)
    setForcePicker(false)

    requestAnimationFrame(() => {
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  function openMentionPicker() {
    const textarea = textareaRef.current
    if (!textarea || disabled || !hasMentionTargets) return

    const nextCaret = textarea.selectionStart ?? body.length
    const before = body.slice(0, nextCaret)
    const after = body.slice(nextCaret)
    const needsAt =
      nextCaret === 0 || /[\s([{]/.test(before[before.length - 1] ?? ' ')

    const nextValue = needsAt ? `${before}@${after}` : `${before} @${after}`
    const cursor = needsAt ? nextCaret + 1 : nextCaret + 2

    setBody(nextValue)
    setCaret(cursor)
    setForcePicker(true)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || disabled || isSending) return

    setError(null)
    try {
      await onSend(trimmed)
      setBody('')
      setCaret(0)
      setForcePicker(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionPicker) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightIndex((index) => (index + 1) % mentionSuggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightIndex(
          (index) => (index - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const entry = mentionSuggestions[highlightIndex]
        if (entry) insertMention(entry)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setForcePicker(false)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="cliq-composer">
      {error && <p className="cliq-composer__error">{error}</p>}

      {showMentionPicker && (
        <ul className="cliq-composer__mentions" role="listbox" aria-label="Mention someone">
          {mentionSuggestions.map((entry, index) => (
            <li key={mentionEntryKey(entry)}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlightIndex}
                className={[
                  index === highlightIndex ? 'cliq-composer__mention--active' : '',
                  entry.kind === 'broadcast' ? 'cliq-composer__mention--broadcast' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseDown={(event) => {
                  event.preventDefault()
                  insertMention(entry)
                }}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                {entry.kind === 'broadcast' ? (
                  <span className="cliq-composer__mention-badge" aria-hidden="true">
                    @
                  </span>
                ) : (
                  <UserAvatar
                    label={entry.displayLabel}
                    seed={entry.userId ?? entry.displayLabel}
                    avatarUrl={entry.avatarUrl}
                    className="cliq-avatar cliq-avatar--sm"
                  />
                )}
                <span className="cliq-composer__mention-copy">
                  <strong>@{entry.displayLabel}</strong>
                  {entry.kind === 'broadcast' && (
                    <span>{entry.description ?? broadcastScopeLabel(entry.scope)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="cliq-composer__form" onSubmit={handleSubmit}>
        <div className="cliq-composer__box">
          <textarea
            ref={textareaRef}
            className="cliq-composer__input"
            value={body}
            onChange={(event) => updateMentionQuery(event.target.value, event.target.selectionStart)}
            onKeyDown={handleKeyDown}
            onKeyUp={syncCaret}
            onClick={syncCaret}
            onSelect={syncCaret}
            placeholder="Type a message here…"
            rows={1}
            disabled={disabled || isSending}
          />

          <div className="cliq-composer__toolbar">
            <div className="cliq-composer__tools">
              <button
                type="button"
                className={`cliq-composer__tool${showMentionPicker ? ' cliq-composer__tool--active' : ''}`}
                title="Mention someone (@)"
                disabled={disabled || !hasMentionTargets}
                onClick={openMentionPicker}
              >
                <span className="cliq-composer__tool-at" aria-hidden="true">@</span>
                <span className="sr-only">Mention someone</span>
              </button>
              <button
                type="button"
                className="cliq-composer__tool"
                title="Emoji"
                disabled={disabled}
                aria-hidden="true"
                tabIndex={-1}
              >
                <span aria-hidden="true">☺</span>
              </button>
              <button
                type="button"
                className="cliq-composer__tool"
                title="Attach file"
                disabled={disabled}
                aria-hidden="true"
                tabIndex={-1}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M8 12.5V7.8a3.3 3.3 0 1 1 6.6 0v8.4a2.1 2.1 0 1 1-4.2 0V9.2"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <button
              type="submit"
              className="cliq-composer__send"
              disabled={disabled || isSending || !body.trim()}
              title="Send message"
            >
              {isSending ? (
                <span className="cliq-composer__send-label">…</span>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 11.5 20.5 4 13 21l-2.5-6.5L3 11.5Z" fill="currentColor" />
                </svg>
              )}
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
