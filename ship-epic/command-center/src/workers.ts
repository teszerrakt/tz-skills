// A worker is the session shipping one ticket. It reports its step with `ship-ui status`.
import { RequestError, text, type Body } from './http.ts'
import { clock, logEvent, now, runFor, save, state } from './store.ts'
import { STOP_REASONS, type Revision, type StopReason, type Worker } from './types.ts'
import type { EventToast } from './desktop/toast.ts'

/** A ticket in one of these states has no worker left to read a changed answer. */
export const FINISHED: string[] = ['done', 'merged']

const STOP_WORDS: Partial<Record<StopReason, { title: string; body: string }>> = {
  'usage-limit': { title: 'Ran out of usage', body: 'The session ended. Its work is safe in the worktree.' },
  'gate-failed': { title: 'A check failed', body: 'The worker stopped and will not go on by itself.' },
}

export type StatusResult = {
  worker: Worker
  /** Answers the user changed since this worker last checked in. */
  revisions: Revision[]
  /** A toast worth showing for this status, if any. */
  toast: EventToast | null
}

export function recordStatus(body: Body): StatusResult {
  const ticket = text(body.ticket, 40)
  if (!ticket) throw new RequestError(400, 'ticket is required')

  const stopped = text(body.stopped, 40) as StopReason | ''
  if (stopped && !STOP_REASONS.includes(stopped)) {
    throw new RequestError(400, `stopped must be one of: ${STOP_REASONS.join(', ')}`)
  }

  const worker = (state.workers[ticket] ??= { ticket })
  const before = describe(worker)
  Object.assign(worker, {
    run: runFor(ticket, text(body.run, 40)),
    step: text(body.step, 40) || worker.step || '',
    doing: text(body.doing, 400),
    stopped,
    pr: text(body.pr, 300) || worker.pr || '',
    model: text(body.model, 60) || worker.model || '',
    effort: text(body.effort, 20) || worker.effort || '',
    startedAt: worker.startedAt || now(),
    at: now(),
  })

  if (describe(worker) !== before) {
    const summary = stopped ? `Stopped: ${stopped}` : worker.doing || 'Working'
    logEvent(ticket, stopped || 'step', summary, worker.step ? `step ${worker.step}` : '')
  }

  const revisions = deliverRevisions(ticket, worker)
  save()
  return { worker, revisions, toast: toastFor(worker) }
}

function describe(worker: Worker): string {
  return `${worker.step}|${worker.doing}|${worker.stopped}`
}

// The status call is the only moment a running worker can hear about a changed answer.
function deliverRevisions(ticket: string, worker: Worker): Revision[] {
  const revisions = state.outbox[ticket] ?? []
  delete state.outbox[ticket]

  for (const revision of revisions) {
    const decision = state.decisions.find((d) => d.id === revision.decision)
    if (decision) Object.assign(decision, { delivery: 'read', readAt: worker.at })
    logEvent(ticket, 'read', 'Worker read your changed answer', revision.choice)
  }
  return revisions
}

function toastFor(worker: Worker): EventToast | null {
  const stopped = worker.stopped
  if (!stopped) return null

  const common = { tag: worker.ticket, time: clock(worker.at) }
  const words = STOP_WORDS[stopped]
  if (words) {
    return {
      ...common,
      kind: 'stop',
      state: 'stopped',
      title: words.title,
      body: worker.doing || words.body,
      action: 'Open in command center',
    }
  }

  if (stopped === 'merged') {
    return { ...common, kind: 'good', state: 'merged', title: `${worker.ticket} is merged`, body: worker.doing || '', action: 'Open' }
  }
  if (stopped === 'done') {
    return {
      ...common,
      kind: 'good',
      state: 'finished',
      title: `${worker.ticket} finished its steps`,
      body: worker.doing || '',
      action: 'Open',
    }
  }
  return null
}
