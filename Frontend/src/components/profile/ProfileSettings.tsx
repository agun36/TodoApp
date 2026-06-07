import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { AppSelect } from '../ui/AppSelect'
import { UserAvatar } from '../ui/UserAvatar'
import { resizeAvatarFile } from '../../lib/avatarUtils'
import {
  AVAILABILITY_OPTIONS,
  LANGUAGE_OPTIONS,
  PROFILE_SECTIONS,
  STATUS_PRESETS,
  TIMEZONE_OPTIONS,
  availabilityColor,
  availabilityLabel,
  defaultTimezone,
  type Availability,
  type ProfileSection,
} from '../../lib/profileOptions'
import type { ProfileUpdatePayload, User } from '../../types'

interface ProfileSettingsProps {
  user: User
  workspaceName?: string
  onSave: (payload: ProfileUpdatePayload) => Promise<unknown>
  isSaving: boolean
}

function buildFormState(user: User) {
  return {
    name: user.name ?? '',
    teamEmail: user.teamEmail ?? '',
    avatarUrl: user.avatarUrl ?? null,
    statusMessage: user.statusMessage ?? '',
    availability: (user.availability ?? 'available') as Availability,
    phone: user.phone ?? '',
    extension: user.extension ?? '',
    department: user.department ?? '',
    designation: user.designation ?? '',
    location: user.location ?? '',
    timezone: user.timezone ?? defaultTimezone(),
    bio: user.bio ?? '',
    language: user.language ?? 'en',
  }
}

export function ProfileSettings({ user, workspaceName, onSave, isSaving }: ProfileSettingsProps) {
  const [section, setSection] = useState<ProfileSection>('profile')
  const [form, setForm] = useState(() => buildFormState(user))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const displayLabel = form.name || user.displayEmail || user.teamEmail || user.email

  useEffect(() => {
    setForm(buildFormState(user))
  }, [user])

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSuccess(null)
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setSuccess(null)
    try {
      updateField('avatarUrl', await resizeAvatarFile(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load image')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      await onSave({
        name: form.name.trim(),
        teamEmail: form.teamEmail.trim(),
        avatarUrl: form.avatarUrl,
        statusMessage: form.statusMessage.trim() || null,
        availability: form.availability,
        phone: form.phone.trim() || null,
        extension: form.extension.trim() || null,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        location: form.location.trim() || null,
        timezone: form.timezone.trim() || null,
        bio: form.bio.trim() || null,
        language: form.language.trim() || 'en',
      })
      setSuccess('Profile saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    }
  }

  const timezoneOptions = TIMEZONE_OPTIONS.some((option) => option.value === form.timezone)
    ? TIMEZONE_OPTIONS
    : [{ value: form.timezone, label: form.timezone }, ...TIMEZONE_OPTIONS]

  return (
    <div className="profile-settings">
      <aside className="profile-settings__nav" aria-label="Profile sections">
        <div className="profile-settings__nav-header">
          <UserAvatar
            label={displayLabel}
            seed={user.id}
            avatarUrl={form.avatarUrl}
            className="profile-settings__nav-avatar"
          />
          <div className="profile-settings__nav-summary">
            <strong>{displayLabel}</strong>
            <span className="profile-settings__nav-status">
              <span
                className="profile-settings__status-dot"
                style={{ backgroundColor: availabilityColor(form.availability) }}
                aria-hidden="true"
              />
              {availabilityLabel(form.availability)}
            </span>
            {form.statusMessage && (
              <span className="profile-settings__nav-message">{form.statusMessage}</span>
            )}
          </div>
        </div>

        <nav className="profile-settings__nav-list">
          {PROFILE_SECTIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`profile-settings__nav-item${
                section === entry.id ? ' profile-settings__nav-item--active' : ''
              }`}
              onClick={() => setSection(entry.id)}
            >
              <span className="profile-settings__nav-item-label">{entry.label}</span>
              <span className="profile-settings__nav-item-hint">{entry.hint}</span>
            </button>
          ))}
        </nav>
      </aside>

      <form className="profile-settings__main" onSubmit={handleSubmit}>
        {section === 'profile' && (
          <section className="profile-settings__section" aria-labelledby="profile-section-title">
            <h2 id="profile-section-title" className="profile-settings__section-title">
              Profile
            </h2>
            <p className="profile-settings__section-desc">
              How you appear across {workspaceName ?? 'this workspace'} — in team lists, group chat,
              and @mentions.
            </p>

            <div className="profile-settings__photo-row">
              <UserAvatar
                label={displayLabel}
                seed={user.id}
                avatarUrl={form.avatarUrl}
                className="profile-settings__photo"
              />
              <div className="profile-settings__photo-actions">
                <label className="btn btn--ghost btn--sm profile-settings__upload">
                  Change photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarChange}
                  />
                </label>
                {form.avatarUrl && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => updateField('avatarUrl', null)}
                  >
                    Remove photo
                  </button>
                )}
                <p className="profile-settings__hint">JPEG, PNG, WebP, or GIF. Max 400 KB.</p>
              </div>
            </div>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Display name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>

            <label className="profile-settings__field">
              <span className="profile-settings__label">About me</span>
              <textarea
                value={form.bio}
                onChange={(e) => updateField('bio', e.target.value)}
                placeholder="Tell your team a little about yourself…"
                rows={4}
                maxLength={500}
              />
              <span className="profile-settings__char-count">{form.bio.length}/500</span>
            </label>

            <p className="profile-settings__readonly">
              Sign-in email: <strong>{user.email}</strong>
            </p>
          </section>
        )}

        {section === 'status' && (
          <section className="profile-settings__section" aria-labelledby="status-section-title">
            <h2 id="status-section-title" className="profile-settings__section-title">
              Status & availability
            </h2>
            <p className="profile-settings__section-desc">
              Let teammates know when you are free to chat, in a meeting, or away from your desk.
            </p>

            <fieldset className="profile-settings__availability">
              <legend className="profile-settings__label">Availability</legend>
              <div className="profile-settings__availability-grid">
                {AVAILABILITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`profile-settings__availability-option${
                      form.availability === option.value
                        ? ' profile-settings__availability-option--active'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="availability"
                      value={option.value}
                      checked={form.availability === option.value}
                      onChange={() => updateField('availability', option.value)}
                    />
                    <span
                      className="profile-settings__status-dot profile-settings__status-dot--lg"
                      style={{ backgroundColor: option.color }}
                      aria-hidden="true"
                    />
                    <span className="profile-settings__availability-copy">
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Status message</span>
              <input
                type="text"
                value={form.statusMessage}
                onChange={(e) => updateField('statusMessage', e.target.value)}
                placeholder="What are you up to?"
                maxLength={160}
              />
              <span className="profile-settings__char-count">{form.statusMessage.length}/160</span>
            </label>

            <div className="profile-settings__presets">
              <span className="profile-settings__label">Quick presets</span>
              <div className="profile-settings__preset-list">
                {STATUS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="profile-settings__preset"
                    onClick={() => updateField('statusMessage', preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {section === 'contact' && (
          <section className="profile-settings__section" aria-labelledby="contact-section-title">
            <h2 id="contact-section-title" className="profile-settings__section-title">
              Contact
            </h2>
            <p className="profile-settings__section-desc">
              Optional contact details visible to teammates in your profile card.
            </p>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Mobile number</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+1 555 0100"
                autoComplete="tel"
              />
            </label>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Extension / desk phone</span>
              <input
                type="text"
                value={form.extension}
                onChange={(e) => updateField('extension', e.target.value)}
                placeholder="Ext. 204"
              />
            </label>
          </section>
        )}

        {section === 'work' && (
          <section className="profile-settings__section" aria-labelledby="work-section-title">
            <h2 id="work-section-title" className="profile-settings__section-title">
              Work info
            </h2>
            <p className="profile-settings__section-desc">
              Role and location details shown on your team profile.
            </p>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Designation</span>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => updateField('designation', e.target.value)}
                placeholder="e.g. Product Manager"
              />
            </label>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Department</span>
              <input
                type="text"
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                placeholder="e.g. Engineering"
              />
            </label>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Location</span>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
              />
            </label>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Workspace email</span>
              <input
                type="email"
                value={form.teamEmail}
                onChange={(e) => updateField('teamEmail', e.target.value)}
                placeholder={user.email}
                autoComplete="email"
              />
              <span className="profile-settings__hint">
                How you appear in @mentions and the team directory. Sign-in stays on {user.email}.
              </span>
            </label>

            {workspaceName && (
              <p className="profile-settings__readonly">
                Workspace: <strong>{workspaceName}</strong>
              </p>
            )}
          </section>
        )}

        {section === 'preferences' && (
          <section className="profile-settings__section" aria-labelledby="preferences-section-title">
            <h2 id="preferences-section-title" className="profile-settings__section-title">
              Preferences
            </h2>
            <p className="profile-settings__section-desc">
              Regional settings for dates, times, and language on your profile.
            </p>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Timezone</span>
              <AppSelect
                value={form.timezone}
                onChange={(value) => updateField('timezone', value)}
                options={timezoneOptions}
                aria-label="Timezone"
              />
            </label>

            <label className="profile-settings__field">
              <span className="profile-settings__label">Language</span>
              <AppSelect
                value={form.language}
                onChange={(value) => updateField('language', value)}
                options={LANGUAGE_OPTIONS}
                aria-label="Language"
              />
            </label>
          </section>
        )}

        <footer className="profile-settings__footer">
          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
          {error && <p className="profile-settings__error">{error}</p>}
          {success && <p className="profile-settings__success">{success}</p>}
        </footer>
      </form>
    </div>
  )
}
