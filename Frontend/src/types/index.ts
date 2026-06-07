export type UserRole = 'admin' | 'member'
export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type Availability = 'available' | 'busy' | 'away' | 'meeting' | 'dnd' | 'offline'

export interface User {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
  role?: UserRole
  /** True when this user owns the workspace (not merely User.role) */
  isOwner?: boolean
  /** Role assigned by the workspace owner */
  workspaceRole?: WorkspaceRole
  /** Workspace-facing email set by the owner after join */
  teamEmail?: string | null
  /** Primary label in the team list (team email if set, otherwise login email) */
  displayEmail?: string
  statusMessage?: string | null
  availability?: Availability
  phone?: string | null
  extension?: string | null
  department?: string | null
  designation?: string | null
  location?: string | null
  timezone?: string | null
  bio?: string | null
  language?: string | null
}

export interface ProfileUpdatePayload {
  name?: string
  teamEmail?: string
  avatarUrl?: string | null
  statusMessage?: string | null
  availability?: Availability
  phone?: string | null
  extension?: string | null
  department?: string | null
  designation?: string | null
  location?: string | null
  timezone?: string | null
  bio?: string | null
  language?: string | null
}

export interface Workspace {
  id: string
  name: string
  teamType?: string | null
  teamSize?: string | null
  primaryUse?: string | null
  plan: 'free' | 'paid' | string
  ownerId: string
}

export interface WorkspaceInvite {
  id: string
  email: string
  token?: string
  invitedById?: string
  workspaceId?: string
  acceptedAt: string | null
  expiresAt?: string
  createdAt: string
  pending: boolean
  expired?: boolean
  inviteUrl?: string
  whatsappUrl?: string | null
  emailSent?: boolean
  emailSkipped?: boolean
  emailError?: string
}

export interface BillingInfo {
  plan: string
  freeMemberLimit: number
  membersAreFree: boolean
}

export interface ManageableProject {
  id: string
  name: string
  color: string
  userId: string
  isInbox: boolean
}

export type TodoKind = 'personal' | 'task'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TodoFilter = 'all' | 'active' | 'completed'
export type TodoScope = 'all' | 'mine' | 'assigned'
export type TodoSort = 'newest' | 'oldest' | 'az' | 'due' | 'priority' | 'order'
export type ProjectStatus = 'active' | 'archived'
export type ProjectView = 'active' | 'archived' | 'all'
export type ViewMode = 'list' | 'board'

export interface ProjectStats {
  total: number
  active: number
  inProgress: number
  done: number
  overdue: number
}

export interface ProjectMember {
  id: string
  email: string
  role: 'owner' | 'member' | string
  joinedAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  status: ProjectStatus
  isInbox: boolean
  isOwner?: boolean
  ownerId?: string
  memberCount?: number | null
  createdAt: string
  stats: ProjectStats
}

export interface Todo {
  id: string
  kind: TodoKind
  title: string
  done: boolean
  status: TaskStatus
  priority: TaskPriority
  description: string | null
  order: number
  projectId: string | null
  projectName?: string | null
  projectColor?: string | null
  assigneeId?: string | null
  assigneeEmail?: string | null
  ownerId?: string
  ownerEmail?: string | null
  isAssignedToMe?: boolean
  createdAt?: string
  dueDate: string | null
  repeatType: string | null
  repeatOn: string | null
  dueLabel: string | null
  dueRelative?: string | null
  isOverdue?: boolean
  repeatLabel: string | null
}

export interface TodosResponse {
  success: true
  email: string
  kind?: TodoKind
  todos: Todo[]
  filter: TodoFilter
  sort: TodoSort
  query: string
  projectId: string | null
  scope?: TodoScope
  assigneeId?: string | null
  users?: User[]
}

export interface TasksWorkspaceResponse extends TodosResponse {
  projects: Project[]
}

export interface ProjectsResponse {
  success: true
  projects: Project[]
  view?: ProjectView
}

export interface ProjectResponse {
  success: true
  project: Project
  members?: ProjectMember[]
  isOwner?: boolean
}

export interface ProjectMembersResponse {
  success: true
  members: ProjectMember[]
  projectId: string
}

export interface UsersResponse {
  success: true
  users: User[]
  currentUser?: User
  canManageWorkspace?: boolean
  manageableProjects?: ManageableProject[]
  invites?: WorkspaceInvite[]
  workspace?: Workspace | null
  needsOnboarding?: boolean
  billing?: BillingInfo | null
}

export interface SetWorkspaceRoleResponse {
  success: true
  message: string
  user: User
}

export interface InviteUserResponse {
  success: true
  message: string
  invite: WorkspaceInvite
}

export interface SetTeamEmailResponse {
  success: true
  message: string
  user: User
}

export interface UpdateProfileResponse {
  success: true
  message: string
  user: User
}

export interface AddUserToProjectsResponse {
  success: true
  message: string
  added: { projectId: string; name: string }[]
  skipped: { projectId: string; reason: string }[]
}

export interface GroupMemberEntry {
  kind: 'member' | 'invite'
  userId: string | null
  inviteId: string | null
  email: string
  name: string | null
  avatarUrl?: string | null
  teamEmail: string | null
  displayLabel: string
  isOwner?: boolean
  pending: boolean
}

export interface GroupChatMessagePreview {
  id: string
  groupId: string
  kind?: GroupChatMessageKind
  isSystem?: boolean
  body: string
  userId: string
  authorLabel: string
  createdAt: string
}

export interface WorkspaceGroup {
  id: string
  workspaceId: string
  name: string
  color: string
  createdAt: string
  members: GroupMemberEntry[]
  memberCount: number
  lastMessage?: GroupChatMessagePreview | null
}

export interface GroupsResponse {
  success: true
  groups: WorkspaceGroup[]
  canManage: boolean
}

export interface GroupResponse {
  success: true
  message: string
  group: WorkspaceGroup
  added?: { kind: string; userId?: string; inviteId?: string }[]
  skipped?: { userId?: string; inviteId?: string; reason: string }[]
}

export type MentionScope = 'all' | 'available' | 'here'
export type MentionRosterKind = 'user' | 'broadcast'

export interface GroupMentionRosterEntry {
  kind?: MentionRosterKind
  scope?: MentionScope
  userId: string | null
  displayLabel: string
  description?: string
  avatarUrl?: string | null
  aliases: string[]
}

export interface GroupChatMention {
  kind?: MentionRosterKind
  scope?: MentionScope
  userId?: string | null
  alias: string
  displayLabel: string
  notifiedUserIds?: string[]
}

export type GroupChatMessageKind = 'user' | 'system'

export interface GroupChatMessage {
  id: string
  groupId: string
  kind?: GroupChatMessageKind
  isSystem?: boolean
  body: string
  userId: string
  authorEmail: string | null
  authorName: string | null
  authorAvatarUrl?: string | null
  authorLabel: string
  mentions: GroupChatMention[]
  systemEvent?: Record<string, unknown> | null
  createdAt: string
}

export interface GroupMessagesResponse {
  success: true
  groupId: string
  roster: GroupMentionRosterEntry[]
  messages: GroupChatMessage[]
}

export interface GroupMessageResponse {
  success: true
  message: string
  chatMessage: GroupChatMessage
}

export interface DirectChatUser {
  id: string
  email: string
  name: string | null
  avatarUrl?: string | null
  availability?: Availability
  statusMessage?: string | null
  displayLabel: string
  teamEmail?: string | null
}

export interface DirectChatMessage {
  id: string
  conversationId: string
  body: string
  userId: string
  authorEmail: string | null
  authorName: string | null
  authorAvatarUrl?: string | null
  authorLabel: string
  createdAt: string
}

export interface DirectConversation {
  id: string
  workspaceId: string
  otherUser: DirectChatUser
  lastMessage: DirectChatMessage | null
  updatedAt: string
}

export interface DirectConversationsResponse {
  success: true
  conversations: DirectConversation[]
}

export interface DirectConversationResponse {
  success: true
  message: string
  conversation: DirectConversation
}

export interface DirectMessagesResponse {
  success: true
  conversation: DirectConversation
  messages: DirectChatMessage[]
}

export interface DirectMessageResponse {
  success: true
  message: string
  chatMessage: DirectChatMessage
}

export interface DashboardStats {
  totalProjects: number
  totalTasks: number
  active: number
  inProgress: number
  done: number
  overdue: number
  byPriority: Record<TaskPriority, number>
}

export interface DashboardRecentTodo {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  projectId: string | null
  projectName: string | null
  createdAt: string
}

export interface ActivityItem {
  id: string
  action: string
  message: string
  entityType: string
  entityId: string
  projectId: string | null
  actorId: string
  actorEmail: string | null
  createdAt: string
}

export interface TaskComment {
  id: string
  todoId: string
  body: string
  userId: string
  authorEmail: string | null
  createdAt: string
}

export interface PaginatedActivity {
  items: ActivityItem[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface DashboardResponse {
  success: true
  stats: DashboardStats
  projects: Project[]
  recentTodos: DashboardRecentTodo[]
  recentActivity: PaginatedActivity
}

export interface AuthResponse {
  success: true
  message: string
  user: User
  token: string
  workspace?: Workspace | null
  needsOnboarding?: boolean
}

export interface InvitePreviewResponse {
  success: true
  invite: WorkspaceInvite & {
    workspace: { id: string; name: string } | null
    inviter: { name: string; email: string } | null
  }
  status: 'valid' | 'expired' | 'accepted'
  hasAccount: boolean
  workspace: Workspace | null
}

export interface OnboardingInput {
  workspaceName: string
  teamType: string
  teamSize: string
  primaryUse: string
}

export interface ApiError {
  success: false
  message: string
}

export interface CreateTodoInput {
  kind?: TodoKind
  title: string
  dueDate?: string | null
  repeatType?: 'none' | 'weekly'
  repeatOn?: string
  priority?: TaskPriority
  status?: TaskStatus
  description?: string
  projectId?: string
  assigneeId?: string | null
}

export interface UpdateTodoInput extends CreateTodoInput {
  id: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  color?: string
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: string
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

export interface TeamMeeting {
  id: string
  workspaceId: string
  projectId: string
  title: string
  description: string | null
  meetingDays: Weekday[]
  /** @deprecated first day — use meetingDays */
  meetingDay: Weekday | null
  scheduleLabel?: string
  meetingTime: string | null
  createdById: string
  createdByEmail: string | null
  active: boolean
  createdAt: string
  project: { id: string; name: string; color: string } | null
}

export interface MeetingsResponse {
  success: true
  meetings: TeamMeeting[]
  canManage: boolean
}

export interface MeetingMutationResponse {
  success: true
  message: string
  meeting: TeamMeeting
  notifyResult?: {
    emails: string[]
    results: { email: string; sent?: boolean; skipped?: boolean; error?: string }[]
  }
}

export interface CreateMeetingInput {
  title: string
  projectId: string
  meetingDays: Weekday[]
  meetingTime?: string
  description?: string
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export const PROJECT_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#64748b',
] as const
