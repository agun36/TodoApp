import { type FormEvent, type KeyboardEvent, useState } from 'react'

interface DirectChatComposerProps {
  disabled?: boolean
  isSending?: boolean
  onSend: (body: string) => Promise<void>
}

export function DirectChatComposer({
  disabled = false,
  isSending = false,
  onSend,
}: DirectChatComposerProps) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || disabled || isSending) return

    setError(null)
    try {
      await onSend(trimmed)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="cliq-composer">
      {error && <p className="cliq-composer__error">{error}</p>}
      <form className="cliq-composer__form" onSubmit={handleSubmit}>
        <div className="cliq-composer__box">
          <textarea
            className="cliq-composer__input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a private message…"
            rows={1}
            disabled={disabled || isSending}
          />
          <div className="cliq-composer__toolbar">
            <div className="cliq-composer__tools" />
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
