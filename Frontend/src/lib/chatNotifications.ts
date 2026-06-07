import type { Availability } from '../types'

const SILENT_AVAILABILITY = new Set<Availability>(['dnd', 'offline'])

let notificationPermissionRequested = false
let audioContext: AudioContext | null = null
let audioUnlocked = false

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

export function unlockMessageAudio() {
  if (audioUnlocked) return
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    audioUnlocked = true
  } catch {
    // Browsers may block audio until a user gesture.
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', unlockMessageAudio, { once: true })
  document.addEventListener('keydown', unlockMessageAudio, { once: true })
}

export function shouldNotifyForAvailability(availability?: Availability | null) {
  if (!availability) return true
  return !SILENT_AVAILABILITY.has(availability)
}

export function playIncomingMessageSound() {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

    const tone = (frequency: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(frequency, start)
      osc.connect(gain)
      osc.start(start)
      osc.stop(start + duration)
    }

    tone(880, now, 0.09)
    tone(1174, now + 0.1, 0.12)
  } catch {
    // Ignore autoplay or Web Audio failures.
  }
}

export async function requestNotificationPermissionOnce() {
  if (notificationPermissionRequested) return
  notificationPermissionRequested = true
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    // User dismissed or browser blocked the prompt.
  }
}

export interface IncomingMessageNotice {
  title: string
  body: string
  tag: string
  availability?: Availability | null
}

export function notifyIncomingMessage({
  title,
  body,
  tag,
  availability,
}: IncomingMessageNotice) {
  if (!shouldNotifyForAvailability(availability)) return

  playIncomingMessageSound()

  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  if (!document.hidden) return

  try {
    new Notification(title, {
      body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
      tag,
      silent: true,
    })
  } catch {
    // Some browsers reject notifications in insecure contexts.
  }
}
