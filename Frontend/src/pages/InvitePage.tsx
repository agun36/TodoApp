import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchInvite, joinWorkspace } from '../api/invite'
import { ApiRequestError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { BrandLogo } from '../components/layout/BrandLogo'
import { PasswordField } from '../components/ui/PasswordField'
import { routes } from '../lib/routes'
import type { InvitePreviewResponse } from '../types'

export function InvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user, signupWithInvite, refreshSession } = useAuth()
  const [preview, setPreview] = useState<InvitePreviewResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchInvite(token)
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiRequestError ? err.message : 'Invite not found')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleJoin() {
    setActionError(null)
    setIsSubmitting(true)
    try {
      await joinWorkspace(token)
      await refreshSession()
      navigate(routes.dashboard, { replace: true })
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Could not join workspace')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignup(event: FormEvent) {
    event.preventDefault()
    setActionError(null)
    setIsSubmitting(true)
    try {
      await signupWithInvite({ inviteToken: token, name, password })
      navigate(routes.dashboard, { replace: true })
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Could not create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  const workspaceName = preview?.workspace?.name ?? preview?.invite.workspace?.name ?? 'TaskFlow'
  const inviterName =
    preview?.invite.inviter?.name ?? preview?.invite.inviter?.email ?? 'Your teammate'
  const inviteEmail = preview?.invite.email ?? ''
  const isExpired = preview?.status === 'expired'
  const isUsed = preview?.status === 'accepted'
  const wrongAccount =
    isAuthenticated && user && inviteEmail && user.email.toLowerCase() !== inviteEmail.toLowerCase()

  return (
    <div className="auth-split">
      <section className="auth-brand" aria-hidden="true">
        <BrandLogo />
        <h2>Join {workspaceName}</h2>
        <p>{inviterName} invited you to collaborate on TaskFlow.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card__header">
            <span className="auth-card__badge">Workspace invite</span>
            <h1>Join {workspaceName}</h1>
            <p>
              {inviterName} invited <strong>{inviteEmail}</strong>
            </p>
          </div>

          {isLoading && <div className="state-message">Loading invite…</div>}
          {loadError && <div className="alert alert--error">{loadError}</div>}
          {isExpired && <div className="alert alert--error">This invite has expired.</div>}
          {isUsed && (
            <div className="alert alert--error">
              This invite was already used. <Link to={routes.login}>Sign in</Link>
            </div>
          )}

          {!isLoading && !loadError && preview && preview.status === 'valid' && (
            <>
              {actionError && <div className="alert alert--error">{actionError}</div>}

              {preview.hasAccount || isAuthenticated ? (
                <div className="invite-join-panel">
                  {wrongAccount ? (
                    <>
                      <p>
                        You are signed in as <strong>{user?.email}</strong>. Sign out and use{' '}
                        <strong>{inviteEmail}</strong> to accept this invite.
                      </p>
                      <Link to={routes.login} className="btn btn--primary btn--full">
                        Switch account
                      </Link>
                    </>
                  ) : isAuthenticated ? (
                    <button
                      type="button"
                      className="btn btn--primary btn--full"
                      disabled={isSubmitting}
                      onClick={handleJoin}
                    >
                      {isSubmitting ? 'Joining…' : `Join ${workspaceName}`}
                    </button>
                  ) : (
                    <>
                      <p>You already have an account. Sign in, then accept the invite.</p>
                      <Link
                        to={routes.loginWithInvite(token)}
                        className="btn btn--primary btn--full"
                      >
                        Sign in to join
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <form className="auth-form" onSubmit={handleSignup}>
                  <label className="field">
                    <span>Your name</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      required
                      autoComplete="name"
                    />
                  </label>

                  <label className="field">
                    <span>Email</span>
                    <input type="email" value={inviteEmail} readOnly disabled />
                  </label>

                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    required
                    minLength={4}
                    autoComplete="new-password"
                  />

                  <button type="submit" className="btn btn--primary btn--full" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating account…' : `Join ${workspaceName}`}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
