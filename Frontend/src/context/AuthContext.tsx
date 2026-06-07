import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { login as apiLogin, logout as apiLogout, signup as apiSignup } from '../api/auth'
import { fetchOnboardingStatus } from '../api/onboarding'
import { fetchUsers } from '../api/users'
import { ApiRequestError, clearToken, getToken, setToken } from '../api/client'
import { usersQueryKey } from '../hooks/useUsers'
import { decodeTokenPayload } from '../lib/token'
import { routes } from '../lib/routes'
import type { User, Workspace } from '../types'

export const onboardingQueryKey = ['onboarding', 'status'] as const

interface AuthContextValue {
  user: User | null
  workspace: Workspace | null
  needsOnboarding: boolean
  isSessionReady: boolean
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<string | void>
  signup: (email: string, password: string) => Promise<string | void>
  signupWithInvite: (payload: { inviteToken: string; name: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [user, setUser] = useState<User | null>(() => {
    const token = getToken()
    if (!token) return null
    const payload = decodeTokenPayload(token)
    if (!payload) {
      clearToken()
      return null
    }
    return { id: payload.userId, email: payload.email }
  })
  const [isLoading, setIsLoading] = useState(false)
  // Do not block navigation while session hydrates — pages render immediately.
  const [isSessionReady, setIsSessionReady] = useState(true)

  useEffect(() => {
    const hash = window.location.hash
    const match = hash.match(/token=([^&]+)/)
    if (match) {
      setToken(decodeURIComponent(match[1]))
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) return

    let cancelled = false

    async function hydrateSession() {
      try {
        const usersData = await queryClient.fetchQuery({
          queryKey: usersQueryKey,
          queryFn: ({ signal }) => fetchUsers({ signal }),
          staleTime: 30_000,
        })
        if (cancelled) return

        const onboardingData = await queryClient.fetchQuery({
          queryKey: onboardingQueryKey,
          queryFn: ({ signal }) => fetchOnboardingStatus({ signal }),
          staleTime: 30_000,
        })
        if (cancelled) return

        if (usersData.currentUser) {
          setUser((prev) => {
            const next = usersData.currentUser!
            if (!prev) return next
            return { ...prev, ...next }
          })
        }
        setWorkspace(usersData.workspace ?? onboardingData.workspace ?? null)
        setNeedsOnboarding(
          Boolean(usersData.needsOnboarding ?? onboardingData.needsOnboarding),
        )
      } catch {
        if (!cancelled) {
          clearToken()
          setUser(null)
          setWorkspace(null)
          setNeedsOnboarding(false)
        }
      }
    }

    hydrateSession()

    return () => {
      cancelled = true
    }
  }, [queryClient])

  const refreshSession = useCallback(async () => {
    const usersData = await queryClient.fetchQuery({
      queryKey: usersQueryKey,
      queryFn: ({ signal }) => fetchUsers({ signal }),
    })
    const onboardingData = await queryClient.fetchQuery({
      queryKey: onboardingQueryKey,
      queryFn: ({ signal }) => fetchOnboardingStatus({ signal }),
    })
    if (usersData.currentUser) {
      setUser({ ...usersData.currentUser, role: usersData.currentUser.role ?? 'member' })
    }
    setWorkspace(usersData.workspace ?? onboardingData.workspace ?? null)
    setNeedsOnboarding(Boolean(usersData.needsOnboarding ?? onboardingData.needsOnboarding))
  }, [queryClient])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await apiLogin({ email, password })
      setUser({
        ...data.user,
        role: data.user.role ?? 'member',
        isOwner: data.workspace?.ownerId === data.user.id,
      })
      setWorkspace(data.workspace ?? null)
      setNeedsOnboarding(Boolean(data.needsOnboarding))
      setIsSessionReady(true)
      return data.needsOnboarding ? routes.onboarding : undefined
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await apiSignup({ email, password })
      setUser({
        ...data.user,
        role: data.user.role ?? 'member',
        isOwner: data.workspace?.ownerId === data.user.id,
      })
      setWorkspace(data.workspace ?? null)
      setNeedsOnboarding(Boolean(data.needsOnboarding))
      setIsSessionReady(true)
      return data.needsOnboarding ? routes.onboarding : undefined
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signupWithInvite = useCallback(
    async (payload: { inviteToken: string; name: string; password: string }) => {
      setIsLoading(true)
      try {
        const data = await apiSignup(payload)
        setUser({
          ...data.user,
          role: data.user.role ?? 'member',
          isOwner: false,
        })
        setWorkspace(data.workspace ?? null)
        setNeedsOnboarding(false)
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await apiLogout()
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401) {
        throw error
      }
    } finally {
      setUser(null)
      setWorkspace(null)
      setNeedsOnboarding(false)
      setIsLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      workspace,
      needsOnboarding,
      isSessionReady,
      isAuthenticated: user !== null,
      isLoading,
      login,
      signup,
      signupWithInvite,
      logout,
      refreshSession,
    }),
    [user, workspace, needsOnboarding, isSessionReady, isLoading, login, signup, signupWithInvite, logout, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
