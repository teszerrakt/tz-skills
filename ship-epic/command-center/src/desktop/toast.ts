// Shows a toast on the desktop. Every host's toast is a script with one contract
// (docs/adr/0002-every-toast-is-a-script.md): it reads a JSON spec file and prints one answer line.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { COMMAND_CENTER_DIR } from '../config.ts'
import type { Option } from '../types.ts'
import { host, pathForDesktop, type Host } from './host.ts'
import { commandExists } from './process.ts'
import { canShowCard } from './qml-card.ts'

export type QuestionToast = {
  kind: 'question'
  tag: string
  state: string
  time: string
  title: string
  options: Option[]
  /** Index into options, or -1 for none. */
  recommended: number
  because: string
  /** How many other questions wait behind this one. */
  more: number
  seconds?: number
}

export type EventToast = {
  kind: 'stop' | 'good' | 'waiting'
  tag: string
  state: string
  time: string
  title: string
  body: string
  /** The label on the button that opens the page. */
  action: string
  seconds?: number
}

export type ToastSpec = QuestionToast | EventToast

export type ToastOutcome = { kind: 'answered'; choice: string; note: string } | { kind: 'open' } | { kind: 'later' } | { kind: 'timeout' }

export type ShownToast = {
  outcome: Promise<ToastOutcome>
  /** Takes the toast off the screen, for a question answered somewhere else. */
  close(): void
}

const WINDOWS_SCRIPT = path.join(COMMAND_CENTER_DIR, 'toast.ps1')
const QML_CARD_SCRIPT = path.join(COMMAND_CENTER_DIR, 'toast-card.ts')
const NOTIFICATION_SCRIPT = path.join(COMMAND_CENTER_DIR, 'toast-notification.ts')

type ToastBackend = {
  /** Whether this machine can show it. Asked once, when the server starts. */
  available(): boolean
  command(specFile: string): string[]
}

// WPF needs a single-threaded apartment, hence -STA.
const windowsCard: ToastBackend = {
  available: () => commandExists('powershell.exe'),
  command: (specFile) => [
    'powershell.exe',
    '-NoProfile',
    '-STA',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    pathForDesktop(WINDOWS_SCRIPT),
    '-Spec',
    pathForDesktop(specFile),
  ],
}

const qmlCard: ToastBackend = {
  available: () => canShowCard(),
  command: (specFile) => [process.execPath, QML_CARD_SCRIPT, '--spec', specFile],
}

const freedesktopNotification: ToastBackend = {
  available: () => commandExists('notify-send'),
  command: (specFile) => [process.execPath, NOTIFICATION_SCRIPT, '--spec', specFile],
}

/** Each host's backends, best first. The first one this machine can show is used. */
const BACKENDS: Record<Host, ToastBackend[]> = {
  windows: [windowsCard],
  wsl: [windowsCard],
  'linux-desktop': [qmlCard, freedesktopNotification],
  'linux-headless': [],
  mac: [],
}

let chosen: ToastBackend | null | undefined

function backend(): ToastBackend | null {
  chosen ??= BACKENDS[host].find((candidate) => candidate.available()) ?? null
  return chosen
}

export function toastsAvailable(): boolean {
  return backend() !== null
}

export function showToast(spec: ToastSpec): ShownToast {
  const toastBackend = backend()
  if (!toastBackend) return { outcome: Promise.resolve({ kind: 'timeout' }), close: () => {} }

  const specFile = path.join(os.tmpdir(), `ship-ui-toast-${randomUUID().slice(0, 8)}.json`)
  fs.writeFileSync(specFile, JSON.stringify(spec))

  const [program, ...args] = toastBackend.command(specFile)
  const child = spawn(program, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
  let printed = ''
  child.stdout.on('data', (chunk) => (printed += chunk))

  const outcome = new Promise<ToastOutcome>((resolve) => {
    const finish = () => {
      fs.rmSync(specFile, { force: true })
      resolve(parseToastOutput(printed))
    }
    child.on('close', finish)
    child.on('error', finish)
  })

  return { outcome, close: () => child.kill() }
}

/** Reads the script's answer: "choice: <label>" and/or "text: <words>", or "open", "later", "timeout". */
export function parseToastOutput(printed: string): ToastOutcome {
  const lines = printed.split(/\r?\n/).map((line) => line.trim())
  const choice = valueAfter(lines, 'choice: ')
  const note = valueAfter(lines, 'text: ')
  if (choice || note) return { kind: 'answered', choice, note }

  if (lines.includes('open')) return { kind: 'open' }
  if (lines.includes('later')) return { kind: 'later' }
  return { kind: 'timeout' }
}

function valueAfter(lines: string[], prefix: string): string {
  const line = lines.find((l) => l.startsWith(prefix))
  return line ? line.slice(prefix.length) : ''
}
