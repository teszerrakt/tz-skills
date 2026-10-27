// A run: what one /ship-epic invocation ships. One run is live; the others are archived under runs/.
import fs from 'node:fs'
import path from 'node:path'
import { RUNS_DIR } from './config.ts'
import { RequestError, text, type Body } from './http.ts'
import { now, save, state } from './store.ts'
import type { Run, RunTicket, State } from './types.ts'

const MAX_TICKETS = 60

/** Records what the run ships. A new run id archives everything that belongs to the run before it. */
export function startRun(body: Body): Run {
  const id = text(body.id, 40)
  if (!id) throw new RequestError(400, 'id is required')

  const previous = state.run
  state.run = {
    id,
    title: text(body.title, 200),
    summary: text(body.summary, 600),
    repo: text(body.repo, 80),
    afk: body.afk === true,
    target: text(body.target, 80),
    where: text(body.where, 120),
    github: text(body.github, 120),
    startedAt: text(body.startedAt, 40) || now(),
    tickets: readTickets(body.tickets),
  }

  if (previous?.id !== id) {
    state.sessions = {}
    // Nobody is at the screen for an --afk run; the switch on the page turns toasts back on.
    state.toasts = !state.run.afk
  }
  archiveOtherRuns(previous)
  save()
  return state.run
}

function readTickets(value: unknown): RunTicket[] {
  const list = Array.isArray(value) ? value.slice(0, MAX_TICKETS) : []
  return list
    .map((t) => ({
      ticket: text(t.ticket, 40),
      title: text(t.title, 200),
      group: Number(t.group) || 1,
      after: text(t.after, 40),
      url: text(t.url, 300),
    }))
    .filter((t) => t.ticket)
}

// The parts of the state that belong to one ticket and so to one run.
const KEYED_BY_TICKET = ['workers', 'prs', 'events', 'outbox'] as const
const LISTED_WITH_TICKET = ['followUps', 'questions', 'decisions', 'findings', 'reviews'] as const
type KeyedPart = (typeof KEYED_BY_TICKET)[number]
type ListedPart = (typeof LISTED_WITH_TICKET)[number]
type Archive = Partial<Pick<State, KeyedPart | ListedPart>> & { run?: Run | { id: string; title: string } }

type Item = { ticket: string; run?: string; answer?: unknown }

/**
 * Moves everything that is not the live run's into runs/<id>.json, so the page never lists another run's workers.
 * Returns whether anything moved. An unanswered question stays: its worker still waits for the answer.
 */
export function archiveOtherRuns(previous?: Run | null): boolean {
  const liveRun = state.run
  if (!liveRun) return false

  const liveTickets = new Set([
    ...liveRun.tickets.map((t) => t.ticket),
    ...Object.values(state.workers)
      .filter((w) => w.run === liveRun.id)
      .map((w) => w.ticket),
  ])
  const isLiveTicket = (ticket: string) => liveTickets.has(ticket)
  const belongsToLiveRun = (item: Item) => item.run === liveRun.id || (!item.run && isLiveTicket(item.ticket))

  const keepItem: Record<ListedPart, (item: Item) => boolean> = {
    followUps: (f) => isLiveTicket(f.ticket),
    questions: (q) => !q.answer || belongsToLiveRun(q),
    decisions: belongsToLiveRun,
    findings: belongsToLiveRun,
    reviews: belongsToLiveRun,
  }

  // Each moved item goes to the run it names, else its ticket's worker's run, else the run being replaced.
  const archives = new Map<string, Archive>()
  const workersLeaving = { ...state.workers }
  const archiveFor = (item: { run?: string } | undefined, ticket: string): Archive => {
    const runId = item?.run || workersLeaving[ticket]?.run || previous?.id || 'earlier'
    if (!archives.has(runId)) archives.set(runId, {})
    return archives.get(runId)!
  }

  let moved = 0
  for (const part of KEYED_BY_TICKET) {
    const entries = state[part] as Record<string, unknown>
    for (const ticket of Object.keys(entries)) {
      if (isLiveTicket(ticket)) continue
      const value = entries[ticket] as { run?: string }
      const archive = archiveFor(value, ticket)
      const archivedPart = ((archive[part] as Record<string, unknown>) ??= {})
      archivedPart[ticket] = value
      delete entries[ticket]
      moved++
    }
  }
  for (const part of LISTED_WITH_TICKET) {
    const items = state[part] as Item[]
    const kept: Item[] = []
    for (const item of items) {
      if (keepItem[part](item)) {
        kept.push(item)
        continue
      }
      const archivedPart = ((archiveFor(item, item.ticket)[part] as Item[]) ??= [])
      archivedPart.push(item)
      moved++
    }
    ;(state[part] as Item[]) = kept
  }

  for (const [runId, archive] of archives) appendToArchive(runId, archive, previous)
  return moved > 0
}

function appendToArchive(runId: string, moved: Archive, previous?: Run | null): void {
  const existing: Archive = readArchivedRun(runId) ?? {}
  const merged: Archive = { ...existing, run: previous?.id === runId ? previous : (existing.run ?? { id: runId, title: '' }) }

  for (const part of KEYED_BY_TICKET) {
    if (moved[part]) (merged as Record<string, unknown>)[part] = { ...existing[part], ...moved[part] }
  }
  for (const part of LISTED_WITH_TICKET) {
    if (moved[part]) (merged as Record<string, unknown>)[part] = [...(existing[part] ?? []), ...moved[part]]
  }
  fs.writeFileSync(archiveFile(runId), JSON.stringify(merged, null, 2))
}

function archiveFile(runId: string): string {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  return path.join(RUNS_DIR, `${runId.replace(/[^\w.-]/g, '_')}.json`)
}

export function readArchivedRun(runId: string): Archive | null {
  const file = archiveFile(runId)
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

export type RunListing = { id: string; title: string; startedAt: string; live: boolean }

/** The live run first, then archived runs, newest first. */
export function listRuns(): RunListing[] {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  const archived = fs
    .readdirSync(RUNS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readRunHeader(path.join(RUNS_DIR, file)))
    .filter((run): run is Run => Boolean(run?.id) && run!.id !== state.run?.id)

  const listings: RunListing[] = archived.map((run) => ({ id: run.id, title: run.title, startedAt: run.startedAt || '', live: false }))
  if (state.run) listings.push({ id: state.run.id, title: state.run.title, startedAt: state.run.startedAt || '', live: true })

  return listings.toSorted((a, b) => Number(b.live) - Number(a.live) || b.startedAt.localeCompare(a.startedAt))
}

function readRunHeader(file: string): Run | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).run
  } catch {
    return null
  }
}

/** The live state for the live run's id, an archive for any other. */
export function runById(runId: string): State | Archive {
  if (runId === state.run?.id) return state
  const archive = readArchivedRun(runId)
  if (!archive) throw new RequestError(404, 'no such run')
  return archive
}
