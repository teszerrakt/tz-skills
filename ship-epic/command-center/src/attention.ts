// What the orchestrator must act on now. Each item has a stable key, so `ship-ui watch` prints it once.
// A finished worker whose PR later gets review threads, red CI or a conflict does not wake by itself.
import { QUIET_AFTER_MS } from './config.ts'
import { state } from './store.ts'
import type { Finding, PullRequest, Worker } from './types.ts'

export type AttentionItem = { key: string; line: string }

const SETTLED_OUTCOMES = ['fixed', 'accepted', 'withdrawn']

export function attention(at = Date.now()): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const question of state.questions.filter((q) => !q.answer)) {
    items.push({ key: `q:${question.id}`, line: `question ${question.id} from ${question.ticket}: ${question.question}` })
  }
  for (const [ticket, worker] of Object.entries(state.workers)) {
    items.push(...finishedButNeeded(ticket, worker, state.prs[ticket]))
    items.push(...fixesAsked(ticket))
    items.push(...stoppedOrQuiet(ticket, worker, state.prs[ticket], at))
  }
  return items
}

/** A finished worker's PR that needs it back: open threads, red CI, or a conflict. */
function finishedButNeeded(ticket: string, worker: Worker, pr: PullRequest | undefined): AttentionItem[] {
  const checks = pr?.state === 'OPEN' ? pr.checks : null
  if (worker.stopped !== 'done' || !pr || !checks) return []

  const items: AttentionItem[] = []
  if (checks.threads) {
    const threads = `${checks.threads} review thread${checks.threads > 1 ? 's' : ''}`
    items.push({ key: `threads:${ticket}:${checks.threads}`, line: `resume ${ticket}: ${threads} open on #${pr.number}` })
  }
  if (checks.ci === 'failing') {
    const names = checks.failing.join(', ')
    items.push({ key: `ci:${ticket}:${checks.failing.join(',')}`, line: `resume ${ticket}: CI failing on #${pr.number} (${names})` })
  }
  if (checks.conflict) {
    const base = state.run?.target || 'its base branch'
    items.push({ key: `conflict:${ticket}:${checks.head}`, line: `resume ${ticket}: #${pr.number} conflicts with ${base}` })
  }
  return items
}

function fixesAsked(ticket: string): AttentionItem[] {
  const asked = state.findings.filter((f: Finding) => f.ticket === ticket && f.fixAsked && !SETTLED_OUTCOMES.includes(f.outcome))
  return asked.map((finding) => ({
    key: `fix:${ticket}:${finding.id}:${finding.fixAsked}`,
    line: `resume ${ticket}: the user asked to fix ${finding.id}: ${finding.claim}${finding.fixNote ? ` (note: ${finding.fixNote})` : ''}`,
  }))
}

function stoppedOrQuiet(ticket: string, worker: Worker, pr: PullRequest | undefined, at: number): AttentionItem[] {
  const doing = worker.doing || 'no detail'

  if (worker.stopped && worker.stopped !== 'done' && worker.stopped !== 'question') {
    return [{ key: `stopped:${ticket}:${worker.stopped}:${worker.at}`, line: `${ticket} stopped: ${worker.stopped} (${doing})` }]
  }

  // Never a `resume` line: the session may be mid-step, and resuming a live session starts a copy of it.
  const quietFor = at - Date.parse(worker.at || '')
  if (!worker.stopped && pr?.state !== 'MERGED' && quietFor > QUIET_AFTER_MS) {
    const minutes = Math.round(quietFor / 60_000)
    return [
      {
        key: `quiet:${ticket}:${worker.at}`,
        line: `quiet ${ticket}: no update for ${minutes} min at step ${worker.step || '?'} (${doing})`,
      },
    ]
  }
  return []
}
