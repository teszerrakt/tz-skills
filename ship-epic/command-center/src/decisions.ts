// A decision is an answered question. The user can change one afterwards, from the page or the orchestrator's chat.
import { RequestError, text, type Body } from './http.ts'
import { logEvent, now, save, shortId, state } from './store.ts'
import { FINISHED } from './workers.ts'
import type { Decision } from './types.ts'
import { ORCHESTRATOR_TICKET } from './questions.ts'

export function reviseDecision(decisionId: string, body: Body): Decision {
  const decision = state.decisions.find((d) => d.id === decisionId)
  if (!decision) throw new RequestError(404, 'no such decision')

  const choice = text(body.choice, 400)
  const note = text(body.note)
  if (!choice) throw new RequestError(400, 'choice is required')
  if (choice === decision.choice) throw new RequestError(400, 'that is already the answer')

  const at = now()
  const was = decision.choice
  decision.history.push({ choice: decision.choice, note: decision.note, at: decision.revisedAt || decision.at })

  // No status call ever reads the orchestrator's outbox, and a finished worker makes none,
  // so for those the changed answer becomes a follow-up instead.
  const nobodyWillRead = decision.ticket === ORCHESTRATOR_TICKET || FINISHED.includes(state.workers[decision.ticket]?.stopped || '')
  Object.assign(decision, { choice, note, revisedAt: at, delivery: nobodyWillRead ? 'follow-up' : 'sent', readAt: '' })

  if (nobodyWillRead) {
    const sentence = `Changed answer after the work was done. "${decision.question}" was "${was}", now "${choice}".${note ? ' ' + note : ''}`
    state.followUps.push({ id: shortId(), ticket: decision.ticket, at, fromDecision: decision.id, sentence })
  } else {
    const outbox = (state.outbox[decision.ticket] ??= [])
    outbox.push({ decision: decision.id, question: decision.question, was, choice, note, at })
  }

  logEvent(decision.ticket, 'changed', `You changed an answer: ${choice}`, `${decision.question} (was: ${was})`)
  save()
  return decision
}
