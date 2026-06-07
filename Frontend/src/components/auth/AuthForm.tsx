import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { joinWorkspace } from '../../api/invite'
import { ApiRequestError } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { routes } from '../../lib/routes'
import { BrandLogo } from '../layout/BrandLogo'
import { PasswordField } from '../ui/PasswordField'

interface AuthFormProps {
  mode: 'login' | 'signup'
}

export function AuthForm({ mode }: AuthFormProps) {
  const { login, signup, isLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isSignup = mode === 'signup'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    try {
      if (isSignup) {
        const redirect = await signup(email, password)
        navigate(redirect ?? routes.dashboard, { replace: true })
      } else {
        const redirect = await login(email, password)
        if (inviteToken) {
          await joinWorkspace(inviteToken)
          navigate(routes.dashboard, { replace: true })
          return
        }
        navigate(redirect ?? routes.dashboard, { replace: true })
      }
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : 'Something went wrong. Please try again.'
      setError(message)
    }
  }

  return (
    <div className="auth-split">
      <section className="auth-brand" aria-hidden="true">
        <BrandLogo />
        <h2>Ship work with clarity.</h2>
        <p>
          Organize projects, assign tasks to your team, and track progress with kanban boards and
          real-time activity.
        </p>
        <ul className="auth-brand__features">
          <li>Project workspaces with team members</li>
          <li>Kanban and list views with filters</li>
          <li>Task comments and activity feed</li>
          <li>REST API with Bearer token auth</li>
        </ul>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card__header">
            <span className="auth-card__badge">{isSignup ? 'Get started' : 'Welcome back'}</span>
            <h1>{isSignup ? 'Create your account' : 'Sign in to TaskFlow'}</h1>
            <p>
              {isSignup
                ? 'Step 1 of 2: create your owner account. Next you will set up your workspace (team type, size, and goals).'
                : 'Pick up where you left off.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="alert alert--error">{error}</div>}

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </label>

            <PasswordField
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
              minLength={4}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />

            <button type="submit" className="btn btn--primary btn--full" disabled={isLoading}>
              {isLoading ? 'Please wait…' : isSignup ? 'Continue to workspace setup' : 'Sign in'}
            </button>
          </form>

          <p className="auth-card__footer">
            {isSignup ? (
              <>
                Invited by a teammate? Use the link in your email or WhatsApp message.
                <br />
                Already have an account? <Link to={routes.login}>Sign in</Link>
              </>
            ) : (
              <>
                Don&apos;t have an account? <Link to={routes.signup}>Create one</Link>
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  )
}
