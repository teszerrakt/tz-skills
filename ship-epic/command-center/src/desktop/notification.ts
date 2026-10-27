// What a toast looks like as a desktop notification, the fallback where the QML card cannot show. Kept free of side effects so it can be tested.
import type { ToastSpec } from './toast.ts'

export type CardAction = { id: string; label: string }

export type Notification = {
  summary: string
  body: string
  actions: CardAction[]
  urgency: 'normal' | 'critical'
  seconds: number
  sound: boolean
}

/** Clicking the card itself, rather than one of its buttons. Most notification daemons show no button for it. */
export const CLICK_ACTION = 'default'
export const OPEN_ACTION = 'open'
const OPTION_PREFIX = 'option-'

export function notificationFor(spec: ToastSpec): Notification {
  const passing = spec.kind === 'good' || spec.kind === 'waiting'
  const where = [spec.tag, spec.state].filter(Boolean).join(' · ')

  const lines = [where]
  if (spec.kind !== 'question' && spec.body) lines.push(spec.body)
  if (spec.kind === 'question' && spec.because) lines.push(`Asked because: ${spec.because}`)
  if (spec.kind === 'question' && spec.more > 0) lines.push(`${spec.more} more waiting`)

  return {
    summary: spec.title,
    body: lines.join('\n'),
    actions: [...buttonsFor(spec), { id: CLICK_ACTION, label: 'Open' }],
    urgency: passing ? 'normal' : 'critical',
    seconds: spec.seconds || (passing ? 8 : 300),
    sound: !passing,
  }
}

function buttonsFor(spec: ToastSpec): CardAction[] {
  if (spec.kind !== 'question') return [{ id: OPEN_ACTION, label: spec.action || 'Open' }]

  // The page shows each option's detail; the card keeps to the labels.
  return spec.options.map((option, index) => ({
    id: `${OPTION_PREFIX}${index}`,
    label: index === spec.recommended ? `✨ ${option.label}` : option.label,
  }))
}

export function notifySendArgs(notification: Notification): string[] {
  const args = [
    '--print-id',
    '--app-name=Ship command center',
    `--urgency=${notification.urgency}`,
    `--expire-time=${notification.seconds * 1000}`,
  ]
  if (notification.sound) args.push('--hint=string:sound-name:message-new-instant')
  for (const action of notification.actions) args.push(`--action=${action.id}=${action.label}`)
  args.push(notification.summary, escapeMarkup(notification.body))
  return args
}

/** The answer line toast.ps1 would print for the same click. */
export function answerLine(spec: ToastSpec, actionId: string, timedOut: boolean): string {
  if (actionId === OPEN_ACTION || actionId === CLICK_ACTION) return 'open'

  if (spec.kind === 'question' && actionId.startsWith(OPTION_PREFIX)) {
    const option = spec.options[Number(actionId.slice(OPTION_PREFIX.length))]
    if (option) return `choice: ${option.label}`
  }

  return timedOut ? 'timeout' : 'later'
}

// Daemons that render body markup would swallow a label such as "<Total>".
function escapeMarkup(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
