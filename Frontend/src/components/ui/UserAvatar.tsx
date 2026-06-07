import { avatarColor, getInitials } from '../../lib/chatUtils'

interface UserAvatarProps {
  label: string
  seed?: string
  avatarUrl?: string | null
  className?: string
}

export function UserAvatar({ label, seed, avatarUrl, className = '' }: UserAvatarProps) {
  const colorSeed = seed || label
  const classes = ['user-avatar', className].filter(Boolean).join(' ')

  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${classes} user-avatar--photo`} />
  }

  return (
    <span className={classes} style={{ backgroundColor: avatarColor(colorSeed) }} aria-hidden="true">
      {getInitials(label)}
    </span>
  )
}
