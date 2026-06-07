export const APP_BASE = '/dashboard'

export const routes = {
  login: '/login',
  signup: '/signup',
  invite: (token: string) => `/invite/${token}`,
  loginWithInvite: (token: string) => `/login?invite=${encodeURIComponent(token)}`,
  onboarding: '/onboarding',
  dashboard: APP_BASE,
  todos: `${APP_BASE}/todos`,
  tasks: `${APP_BASE}/tasks`,
  tasksWithProject: (projectId: string) =>
    `${APP_BASE}/tasks?projectId=${encodeURIComponent(projectId)}`,
  users: `${APP_BASE}/users`,
  profile: `${APP_BASE}/profile`,
  profileUser: (userId: string) => `${APP_BASE}/profile/${userId}`,
  groups: `${APP_BASE}/groups`,
  messages: `${APP_BASE}/messages`,
  messagesUser: (userId: string) => `${APP_BASE}/messages?user=${encodeURIComponent(userId)}`,
  meetings: `${APP_BASE}/meetings`,
} as const
