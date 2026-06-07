import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeOnboarding } from '../api/onboarding'
import { ApiRequestError } from '../api/client'
import { BrandLogo } from '../components/layout/BrandLogo'
import { useAuth } from '../context/AuthContext'
import { routes } from '../lib/routes'

const TEAM_TYPES = [
  { value: 'startup', label: 'Startup' },
  { value: 'agency', label: 'Agency / consultancy' },
  { value: 'internal', label: 'Internal team' },
  { value: 'freelance', label: 'Freelance / solo' },
  { value: 'other', label: 'Other' },
]

const TEAM_SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: '2-5', label: '2–5 people' },
  { value: '6-20', label: '6–20 people' },
  { value: '21-50', label: '21–50 people' },
  { value: '50+', label: '50+ people' },
]

const PRIMARY_USES = [
  { value: 'projects', label: 'Project management' },
  { value: 'tasks', label: 'Task tracking' },
  { value: 'both', label: 'Both' },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { refreshSession } = useAuth()
  const [workspaceName, setWorkspaceName] = useState('')
  const [teamType, setTeamType] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [primaryUse, setPrimaryUse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await completeOnboarding({ workspaceName, teamType, teamSize, primaryUse })
      await refreshSession()
      navigate(routes.dashboard, { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not save your answers. Try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-split">
      <section className="auth-brand" aria-hidden="true">
        <BrandLogo />
        <h2>Set up your workspace.</h2>
        <p>Tell us a bit about your team so we can tailor TaskFlow for you.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card auth-card--wide">
          <div className="auth-card__header">
            <span className="auth-card__badge">Owner setup</span>
            <h1>Welcome to TaskFlow</h1>
            <p>Answer four quick questions to create your workspace. Members skip this step.</p>
          </div>

          <form className="auth-form onboarding-form" onSubmit={handleSubmit}>
            {error && <div className="alert alert--error">{error}</div>}

            <label className="field">
              <span>Workspace name</span>
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Acme Studio"
                required
              />
            </label>

            <label className="field">
              <span>Team type</span>
              <select value={teamType} onChange={(e) => setTeamType(e.target.value)} required>
                <option value="">Select…</option>
                {TEAM_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Team size</span>
              <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)} required>
                <option value="">Select…</option>
                {TEAM_SIZES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Primary use</span>
              <select value={primaryUse} onChange={(e) => setPrimaryUse(e.target.value)} required>
                <option value="">Select…</option>
                {PRIMARY_USES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="onboarding-billing-note">
              Free plan: 1 workspace and up to <strong>3 members</strong> (members join free — only
              you pay when you upgrade).
            </p>

            <button type="submit" className="btn btn--primary btn--full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
