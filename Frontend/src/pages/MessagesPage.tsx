import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { DirectChatWindow } from '../components/messages/DirectChatWindow'
import { DirectConversationList } from '../components/messages/DirectConversationList'
import { useAuth } from '../context/AuthContext'
import { useChatFocus } from '../context/ChatFocusContext'
import { useDirectConversations, useDirectMessages } from '../hooks/useDirectMessages'
import { useUsers } from '../hooks/useUsers'
import { routes } from '../lib/routes'

export function MessagesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { data: usersData } = useUsers()
  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    isError: conversationsError,
    error: conversationsErr,
    openConversation,
    isOpening,
  } = useDirectConversations()

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const { setDirectConversationId } = useChatFocus()

  const currentUser = usersData?.currentUser ?? user
  const teammates = useMemo(
    () =>
      (usersData?.users ?? []).map((member) => ({
        id: member.id,
        displayLabel: member.displayEmail ?? member.name ?? member.email,
        avatarUrl: member.avatarUrl,
      })),
    [usersData?.users],
  )

  const conversations = conversationsData?.conversations ?? []
  const recipientId = searchParams.get('user')

  const {
    data: messagesData,
    isLoading: messagesLoading,
    isError: messagesError,
    error: messagesErr,
    sendMessage,
    isSending,
  } = useDirectMessages(selectedConversationId ?? '', Boolean(selectedConversationId))

  useEffect(() => {
    if (selectedConversationId && conversations.some((row) => row.id === selectedConversationId)) {
      return
    }
    setSelectedConversationId(conversations[0]?.id ?? null)
  }, [conversations, selectedConversationId])

  useEffect(() => {
    if (!recipientId || recipientId === currentUser?.id) return

    let cancelled = false

    async function openFromQuery() {
      try {
        const result = await openConversation(recipientId!)
        if (cancelled) return
        setSelectedConversationId(result.conversation.id)
        setSearchParams({}, { replace: true })
      } catch {
        if (!cancelled) setSearchParams({}, { replace: true })
      }
    }

    void openFromQuery()

    return () => {
      cancelled = true
    }
  }, [recipientId, currentUser?.id, openConversation, setSearchParams])

  useEffect(() => {
    setDirectConversationId(selectedConversationId)
    return () => setDirectConversationId(null)
  }, [selectedConversationId, setDirectConversationId])

  async function handleStartChat(targetUserId: string) {
    const result = await openConversation(targetUserId)
    setSelectedConversationId(result.conversation.id)
  }

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId)
    ?? messagesData?.conversation
    ?? null

  return (
    <AppLayout>
      <div className="cliq-groups-page">
        <header className="cliq-groups-page__header">
          <div>
            <p className="page-header__eyebrow">Workspace</p>
            <h1 className="cliq-groups-page__title">Direct messages</h1>
          </div>
        </header>

        {conversationsLoading && !conversationsData && (
          <div className="state-message">Loading chats…</div>
        )}

        {conversationsError && (
          <div className="alert alert--error">
            {conversationsErr instanceof Error
              ? conversationsErr.message
              : 'Failed to load chats'}
          </div>
        )}

        {!conversationsLoading && (
          <div className="cliq-workspace">
            <DirectConversationList
              conversations={conversations}
              teammates={teammates}
              selectedConversationId={selectedConversationId}
              currentUserId={currentUser?.id}
              onSelect={setSelectedConversationId}
              onStartChat={handleStartChat}
              isStarting={isOpening}
            />

            <div className="cliq-workspace__main">
              {selectedConversation ? (
                <DirectChatWindow
                  conversation={selectedConversation}
                  messages={messagesData?.messages ?? []}
                  currentUserId={currentUser?.id}
                  isLoading={messagesLoading && !messagesData}
                  isError={messagesError}
                  error={messagesErr}
                  isSending={isSending}
                  onSend={sendMessage}
                />
              ) : (
                <div className="cliq-chat cliq-chat--empty">
                  <div className="cliq-chat__welcome">
                    <h3>Private chats</h3>
                    <p>
                      Select a conversation or start a new chat with a teammate. You can also open
                      a chat from their profile page.
                    </p>
                    {teammates.length > 0 && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => navigate(routes.messagesUser(teammates[0].id))}
                      >
                        Message {teammates[0].displayLabel}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
