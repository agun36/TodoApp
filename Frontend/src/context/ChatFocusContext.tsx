import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface ChatFocusState {
  directConversationId: string | null
  groupId: string | null
}

interface ChatFocusContextValue extends ChatFocusState {
  setDirectConversationId: (conversationId: string | null) => void
  setGroupId: (groupId: string | null) => void
}

const ChatFocusContext = createContext<ChatFocusContextValue | null>(null)

export function ChatFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<ChatFocusState>({
    directConversationId: null,
    groupId: null,
  })

  const setDirectConversationId = useCallback((directConversationId: string | null) => {
    setFocus((current) =>
      current.directConversationId === directConversationId
        ? current
        : { ...current, directConversationId },
    )
  }, [])

  const setGroupId = useCallback((groupId: string | null) => {
    setFocus((current) => (current.groupId === groupId ? current : { ...current, groupId }))
  }, [])

  const value = useMemo(
    () => ({
      directConversationId: focus.directConversationId,
      groupId: focus.groupId,
      setDirectConversationId,
      setGroupId,
    }),
    [focus.directConversationId, focus.groupId, setDirectConversationId, setGroupId],
  )

  return <ChatFocusContext.Provider value={value}>{children}</ChatFocusContext.Provider>
}

export function useChatFocus() {
  const context = useContext(ChatFocusContext)
  if (!context) {
    throw new Error('useChatFocus must be used within ChatFocusProvider')
  }
  return context
}
