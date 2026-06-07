import { type InputHTMLAttributes, useState } from 'react'

interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string
  value: string
  onChange: (value: string) => void
}

export function PasswordField({
  label = 'Password',
  value,
  onChange,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <label className={`field password-field${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      <span className="password-field__control">
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 0 1-2.08 3.35M6.61 6.61A11.8 11.8 0 0 0 1 12.5C2.73 16.39 7 19.5 12 19.5c1.05 0 2.07-.13 3.03-.37"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <circle cx="13" cy="12.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          )}
        </button>
      </span>
    </label>
  )
}
