export type Availability = 'available' | 'busy' | 'away' | 'meeting' | 'dnd' | 'offline'

export interface AvailabilityOption {
  value: Availability
  label: string
  color: string
  description: string
}

export const AVAILABILITY_OPTIONS: AvailabilityOption[] = [
  { value: 'available', label: 'Available', color: '#22c55e', description: 'Open to chat and collaborate' },
  { value: 'busy', label: 'Busy', color: '#ef4444', description: 'Focused — messages may be delayed' },
  { value: 'away', label: 'Away', color: '#f59e0b', description: 'Stepped away from desk' },
  { value: 'meeting', label: 'In a meeting', color: '#6366f1', description: 'In a call or meeting' },
  { value: 'dnd', label: 'Do not disturb', color: '#dc2626', description: 'Mute notifications and mentions' },
  { value: 'offline', label: 'Appear offline', color: '#94a3b8', description: 'Show as offline to the team' },
]

export const STATUS_PRESETS = [
  'In a meeting',
  'On lunch break',
  'Working remotely',
  'Be right back',
  'On vacation',
  'Out of office',
] as const

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
]

export const TIMEZONE_OPTIONS = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (GMT-10)' },
  { value: 'America/Anchorage', label: 'Alaska (GMT-9)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (GMT-8)' },
  { value: 'America/Denver', label: 'Mountain Time (GMT-7)' },
  { value: 'America/Chicago', label: 'Central Time (GMT-6)' },
  { value: 'America/New_York', label: 'Eastern Time (GMT-5)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'Europe/Paris', label: 'Paris / Berlin (GMT+1)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (GMT+2)' },
  { value: 'Africa/Lagos', label: 'Lagos (GMT+1)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Kolkata', label: 'India (GMT+5:30)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10)' },
]

export type ProfileSection = 'profile' | 'status' | 'contact' | 'work' | 'preferences'

export const PROFILE_SECTIONS: { id: ProfileSection; label: string; hint: string }[] = [
  { id: 'profile', label: 'Profile', hint: 'Photo, name & about you' },
  { id: 'status', label: 'Status', hint: 'Availability & status message' },
  { id: 'contact', label: 'Contact', hint: 'Phone & extension' },
  { id: 'work', label: 'Work info', hint: 'Role, department & location' },
  { id: 'preferences', label: 'Preferences', hint: 'Timezone & language' },
]

export function availabilityColor(value?: string | null) {
  return AVAILABILITY_OPTIONS.find((option) => option.value === value)?.color ?? '#94a3b8'
}

export function availabilityLabel(value?: string | null) {
  return AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label ?? 'Available'
}

export function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}
