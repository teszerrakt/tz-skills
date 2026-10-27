// The one live state, saved to state.json and pushed to every open page on each change.
import fs from 'node:fs'
import { DATA_DIR, STATE_FILE } from './config.ts'
import type { State } from './types.ts'

const EVENTS_KEPT_PER_TICKET = 200

function emptyState(): State {
  return {
    run: null,
    questions: [],
    workers: {},
    decisions: [],
    followUps: [],
    events: {},
    outbox: {},
    prs: {},
    findings: [],
    reviews: [],
    sessions: {},
    toasts: true,
    profiles: [],
  }
}

function loadState(): State {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(STATE_FILE)) return emptyState()
  // An older file may lack newer keys; the empty state fills them in.
  return { ...emptyState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
}

export const state: State = loadState()

type Listener = (stateJson: string) => void
const listeners = new Set<Listener>()

/** Calls the listener with the state now and after every save. Returns the way to stop. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(JSON.stringify(state))
  return () => listeners.delete(listener)
}

export function save(): void {
  // Written aside and renamed, so a crash mid-write never leaves half a file.
  const temporary = `${STATE_FILE}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2))
  fs.renameSync(temporary, STATE_FILE)

  // One line: a server-sent event ends at a blank line, so the JSON must hold no newlines.
  const oneLine = JSON.stringify(state)
  for (const listener of listeners) listener(oneLine)
}

export function logEvent(ticket: string, kind: string, text: string, detail = ''): void {
  const events = (state.events[ticket] ??= [])
  events.push({ at: now(), kind, text, detail })
  if (events.length > EVENTS_KEPT_PER_TICKET) events.splice(0, events.length - EVENTS_KEPT_PER_TICKET)
}

/** The run a new item belongs to: the one it names, else its worker's, else the live run. */
export function runFor(ticket: string, named = ''): string {
  return named || state.workers[ticket]?.run || state.run?.id || ''
}

export function now(): string {
  return new Date().toISOString()
}

export function clock(iso: string | undefined): string {
  return new Date(iso || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}
