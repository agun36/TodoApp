import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { GroupChannelList } from '../components/groups/GroupChannelList'
import { GroupChatWindow } from '../components/groups/GroupChatWindow'
import { GroupMembersPanel } from '../components/groups/GroupMembersPanel'
import { useAuth } from '../context/AuthContext'
import { useChatFocus } from '../context/ChatFocusContext'
import { useGroups } from '../hooks/useGroups'
import { useUsers } from '../hooks/useUsers'
import type { WorkspaceGroup } from '../types'

export function GroupsPage() {
  const { user } = useAuth()
  const {
    data: groupsData,
    isLoading: groupsLoading,
    isError: groupsError,
    error: groupsErr,
    createGroup,
    deleteGroup,
    addGroupMembers,
    removeGroupMember,
    isCreating,
    isDeleting,
    isAddingMembers,
    isRemovingMember,
  } = useGroups()
  const { data: usersData, isLoading: usersLoading } = useUsers()

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const { setGroupId } = useChatFocus()

  const currentUser = usersData?.currentUser ?? user
  const isOwner =
    usersData?.currentUser?.isOwner ??
    (usersData?.workspace?.ownerId != null &&
      (currentUser?.id === usersData.workspace.ownerId || user?.id === usersData.workspace.ownerId))
  const canManage = groupsData?.canManage ?? isOwner
  const roster = useMemo(
    () => (usersData?.users ?? []).filter((member) => !member.isOwner),
    [usersData?.users],
  )
  const pendingInvites = (usersData?.invites ?? []).filter((invite) => invite.pending)
  const groups = groupsData?.groups ?? []

  function canChatInGroup(group: WorkspaceGroup) {
    if (isOwner) return true
    return group.members.some(
      (member) => member.kind === 'member' && member.userId === (user?.id ?? currentUser?.id),
    )
  }

  const chatableGroups = useMemo(
    () => groups.filter((group) => canChatInGroup(group)),
    [groups, isOwner, user?.id, currentUser?.id],
  )

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null

  useEffect(() => {
    if (selectedGroupId && groups.some((group) => group.id === selectedGroupId)) return
    const next = chatableGroups[0] ?? groups[0] ?? null
    setSelectedGroupId(next?.id ?? null)
  }, [groups, chatableGroups, selectedGroupId])

  useEffect(() => {
    setShowMembers(false)
  }, [selectedGroupId])

  useEffect(() => {
    setGroupId(selectedGroupId)
    return () => setGroupId(null)
  }, [selectedGroupId, setGroupId])

  const isLoadingGroups = groupsLoading && !groupsData

  return (
    <AppLayout>
      <div className="cliq-groups-page">
        <header className="cliq-groups-page__header">
          <div>
            <p className="page-header__eyebrow">Workspace</p>
            <h1 className="cliq-groups-page__title">Group channels</h1>
          </div>
        </header>

        {isLoadingGroups && <div className="state-message">Loading groups…</div>}

        {groupsError && (
          <div className="alert alert--error">
            {groupsErr instanceof Error ? groupsErr.message : 'Failed to load groups'}
          </div>
        )}

        {!isLoadingGroups && !groupsError && (
          <div className="cliq-workspace">
            <GroupChannelList
              groups={groups}
              selectedGroupId={selectedGroupId}
              canManage={canManage}
              isCreating={isCreating}
              onSelect={setSelectedGroupId}
              onCreate={async (name, color) => {
                const result = await createGroup({ name, color })
                setSelectedGroupId(result.group.id)
              }}
              canChatInGroup={canChatInGroup}
            />

            <div className="cliq-workspace__main">
              {selectedGroup && canChatInGroup(selectedGroup) ? (
                <GroupChatWindow
                  group={selectedGroup}
                  currentUserId={user?.id ?? currentUser?.id}
                  canManage={canManage}
                  onOpenMembers={() => setShowMembers(true)}
                />
              ) : selectedGroup ? (
                <div className="cliq-chat cliq-chat--locked">
                  <div className="cliq-chat__welcome">
                    <h3>#{selectedGroup.name}</h3>
                    <p>
                      You are not a member of this group yet. Ask the workspace owner to add you so
                      you can join the channel.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="cliq-chat cliq-chat--empty">
                  <div className="cliq-chat__welcome">
                    <h3>No channel selected</h3>
                    <p>
                      {canManage
                        ? 'Create a group on the left, add people, then start chatting.'
                        : 'When you are added to a group, it will appear here.'}
                    </p>
                  </div>
                </div>
              )}

              {showMembers && selectedGroup && (
                <GroupMembersPanel
                  group={selectedGroup}
                  canManage={canManage}
                  roster={roster}
                  pendingInvites={pendingInvites}
                  onClose={() => setShowMembers(false)}
                  onAddMembers={(groupId, userIds, inviteIds) =>
                    addGroupMembers({ groupId, userIds, inviteIds })
                  }
                  onRemoveMember={(groupId, payload) =>
                    removeGroupMember({ groupId, ...payload })
                  }
                  onDelete={deleteGroup}
                  isAdding={isAddingMembers}
                  isRemoving={isRemovingMember}
                  isDeleting={isDeleting}
                />
              )}
            </div>
          </div>
        )}

        {!canManage && !isLoadingGroups && !usersLoading && (
          <p className="cliq-groups-page__note">
            Only the workspace owner can create channels and manage membership.
          </p>
        )}
      </div>
    </AppLayout>
  )
}
