import { Link, Navigate, useParams } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { PageHeader } from '../components/layout/PageHeader'
import { MemberProfileView } from '../components/profile/MemberProfileView'
import { ProfileSettings } from '../components/profile/ProfileSettings'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { routes } from '../lib/routes'

export function ProfilePage() {
  const { userId: routeUserId } = useParams()
  const { user, workspace, refreshSession } = useAuth()
  const { data, isLoading, isError, error, updateProfile, isUpdatingProfile } = useUsers()

  const currentUser = data?.currentUser ?? user
  const workspaceName = data?.workspace?.name ?? workspace?.name
  const isOwnProfile = !routeUserId || routeUserId === currentUser?.id

  if (routeUserId && currentUser && routeUserId === currentUser.id) {
    return <Navigate to={routes.profile} replace />
  }

  const viewedUser = isOwnProfile
    ? currentUser
    : data?.users?.find((member) => member.id === routeUserId)

  const pageTitle = isOwnProfile
    ? 'Profile settings'
    : viewedUser?.name || viewedUser?.displayEmail || 'Member profile'

  return (
    <AppLayout>
      <PageHeader
        eyebrow={isOwnProfile ? 'Account' : 'Team'}
        title={pageTitle}
        description={
          isOwnProfile
            ? 'Manage your Cliq-style profile — photo, status, contact details, and work info.'
            : 'View profile details for this workspace member.'
        }
      />

      {!isOwnProfile && (
        <p className="profile-back-link">
          <Link to={routes.groups}>← Back to groups</Link>
        </p>
      )}

      {isLoading && !viewedUser && <div className="state-message">Loading profile…</div>}

      {isError && (
        <div className="alert alert--error">
          {error instanceof Error ? error.message : 'Failed to load profile'}
        </div>
      )}

      {!isLoading && !isOwnProfile && !viewedUser && (
        <div className="state-message">This team member could not be found.</div>
      )}

      {isOwnProfile && viewedUser && (
        <ProfileSettings
          user={viewedUser}
          workspaceName={workspaceName}
          isSaving={isUpdatingProfile}
          onSave={async (payload) => {
            await updateProfile(payload)
            await refreshSession()
          }}
        />
      )}

      {!isOwnProfile && viewedUser && (
        <MemberProfileView
          user={viewedUser}
          workspaceName={workspaceName}
          currentUserId={currentUser?.id}
        />
      )}
    </AppLayout>
  )
}
