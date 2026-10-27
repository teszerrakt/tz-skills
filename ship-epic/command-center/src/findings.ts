// Reviewer findings on a ticket, the user's ruling on the open ones, and follow-ups.
import { RequestError, text, type Body } from './http.ts'
import { logEvent, now, runFor, save, shortId, state } from './store.ts'
import { OUTCOMES, SEVERITIES, type Finding, type FollowUp, type Outcome, type Review, type Severity } from './types.ts'

/**
 * Records a finding, or a whole review's verdict when no id is given.
 * One finding per (ticket, run, id): a re-send with the same id updates it.
 */
export function recordFinding(body: Body): { created: boolean; record: Finding | Review } {
  const ticket = text(body.ticket, 40)
  if (!ticket) throw new RequestError(400, 'ticket is required')

  const run = runFor(ticket, text(body.run, 40))
  const by = text(body.by, 60)
  const id = text(body.id, 20)
  const verdict = text(body.verdict, 60)

  if (verdict && !id) {
    const review: Review = { ticket, run, by, verdict, at: now() }
    state.reviews.push(review)
    logEvent(ticket, 'review', `${by || 'A review'}: ${verdict}`)
    save()
    return { created: true, record: review }
  }
  if (!id) throw new RequestError(400, 'id is required, or --verdict alone for a whole review')

  const severity = text(body.severity, 20)
  const outcome = text(body.outcome, 20)
  if (severity && !(SEVERITIES as readonly string[]).includes(severity)) {
    throw new RequestError(400, `severity must be one of: ${SEVERITIES.join(', ')}`)
  }
  if (outcome && !(OUTCOMES as readonly string[]).includes(outcome)) {
    throw new RequestError(400, `outcome must be one of: ${OUTCOMES.join(', ')}`)
  }

  const existing = state.findings.find((f) => f.ticket === ticket && f.run === run && f.id === id)
  if (!existing) {
    const claim = text(body.claim)
    if (!claim) throw new RequestError(400, 'claim is required for a new finding')

    const finding: Finding = {
      ticket,
      run,
      id,
      by,
      claim,
      severity: (severity || 'note') as Severity,
      anchor: text(body.anchor, 300),
      outcome: (outcome || 'open') as Outcome,
      at: now(),
      history: [],
    }
    state.findings.push(finding)
    logEvent(ticket, 'finding', `${id} ${finding.severity} from ${by || 'a review'}: ${finding.outcome}`, claim)
    save()
    return { created: true, record: finding }
  }

  if (outcome && outcome !== existing.outcome) {
    existing.history.push({ outcome: existing.outcome, at: existing.updatedAt || existing.at })
    logEvent(ticket, 'finding', `${id} is now ${outcome}`, existing.claim)
    existing.outcome = outcome as Outcome
  }
  if (text(body.by)) existing.by = text(body.by, 300)
  if (text(body.severity)) existing.severity = severity as Severity
  if (text(body.claim)) existing.claim = text(body.claim, 2000)
  if (text(body.anchor)) existing.anchor = text(body.anchor, 300)
  if (verdict) existing.verdict = verdict
  existing.updatedAt = now()
  save()
  return { created: false, record: existing }
}

/** The user's ruling on a finding a reviewer left open: accept it as a known gap, or send it back to be fixed. */
export function ruleOnFinding(body: Body): Finding {
  const finding = state.findings.find(
    (f) => f.ticket === text(body.ticket, 40) && f.id === text(body.id, 20) && (!body.run || f.run === body.run),
  )
  if (!finding) throw new RequestError(404, 'no such finding')

  const at = now()
  const note = text(body.note, 600)

  if (body.choice === 'accept') {
    finding.history.push({ outcome: finding.outcome, at: finding.updatedAt || finding.at })
    Object.assign(finding, { outcome: 'accepted', updatedAt: at, ruling: note })
    const sentence = note ? `${finding.claim} ${note}` : finding.claim
    state.followUps.push({ id: shortId(), ticket: finding.ticket, at, anchor: finding.anchor, fromFinding: finding.id, sentence })
    logEvent(finding.ticket, 'finding', `You accepted ${finding.id} for now`, finding.claim)
  } else if (body.choice === 'fix') {
    Object.assign(finding, { fixAsked: at, fixNote: note, updatedAt: at })
    logEvent(finding.ticket, 'finding', `You sent ${finding.id} back to be fixed`, finding.claim)
  } else {
    throw new RequestError(400, 'choice must be accept or fix')
  }

  save()
  return finding
}

export function addFollowUp(body: Body): FollowUp {
  const sentence = text(body.sentence, 600)
  if (!sentence) throw new RequestError(400, 'sentence is required')

  const followUp: FollowUp = { id: shortId(), ticket: text(body.ticket, 40), sentence, anchor: text(body.anchor, 300), at: now() }
  state.followUps.push(followUp)
  save()
  return followUp
}
