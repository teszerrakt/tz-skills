// Questions a session asks, and the answers the user (or, under --afk, the orchestrator) gives.
import { RequestError, text, type Body } from './http.ts'
import { logEvent, now, runFor, save, shortId, state } from './store.ts'
import type { Answer, AnsweredVia, Decision, Option, Question } from './types.ts'

const MAX_OPTIONS = 6
/** The ticket name the orchestrator asks under. It is no worker, so it gets no row in the Workers list. */
export const ORCHESTRATOR_TICKET = 'RUN'

type AnswerListener = (answer: Answer) => void
const waitingForAnswer = new Map<string, Set<AnswerListener>>()
const answeredListeners: ((question: Question) => void)[] = []

/** Runs after every answer, wherever it came from. The toast queue uses it to take an answered card down. */
export function onAnswered(listener: (question: Question) => void): void {
  answeredListeners.push(listener)
}

export function askQuestion(body: Body): Question {
  const questionText = text(body.question)
  if (!questionText) throw new RequestError(400, 'question is required')

  const ticket = text(body.ticket, 40) || ORCHESTRATOR_TICKET
  const question: Question = {
    id: shortId(),
    ticket,
    run: runFor(ticket, text(body.run, 40)),
    question: questionText,
    options: readOptions(body.options),
    recommended: Number.isInteger(body.recommended) ? (body.recommended as number) : -1,
    because: text(body.because),
    example: text(body.example, 6000),
    askedAt: now(),
    answer: null,
  }
  state.questions.push(question)

  if (ticket !== ORCHESTRATOR_TICKET) {
    const worker = (state.workers[ticket] ??= { ticket })
    Object.assign(worker, { stopped: 'question', doing: question.question, at: question.askedAt })
  }
  logEvent(ticket, 'asked', 'Asked you a question', question.question)
  save()
  return question
}

// Each option arrives as "Label|what the user would see".
function readOptions(value: unknown): Option[] {
  const list = Array.isArray(value) ? value.slice(0, MAX_OPTIONS) : []
  return list
    .map((option) => {
      const [label, ...detail] = text(option, 400).split('|')
      return { label: label.trim(), detail: detail.join('|').trim() }
    })
    .filter((option) => option.label)
}

export function findQuestion(id: string): Question {
  const question = state.questions.find((q) => q.id === id)
  if (!question) throw new RequestError(404, 'no such question')
  return question
}

/** An answer from the page or the orchestrator's CLI. */
export function answerFromRequest(question: Question, body: Body): Answer {
  if (question.answer) throw new RequestError(409, 'already answered', { answer: question.answer })

  const choice = text(body.choice, 400)
  const note = text(body.note)
  if (!choice && !note) throw new RequestError(400, 'pick an option or type an answer')

  // The orchestrator answers only under --afk, and the worker was told before the run to take it.
  const via: AnsweredVia = body.as === 'orchestrator' ? 'orchestrator' : 'screen'
  return answerQuestion(question, { choice, note, via })
}

export function answerQuestion(question: Question, given: { choice: string; note: string; via: AnsweredVia }): Answer {
  const answer: Answer = { ...given, at: now() }
  question.answer = answer
  const byOrchestrator = given.via === 'orchestrator'

  const decision: Decision = {
    id: question.id,
    ticket: question.ticket,
    run: question.run,
    question: question.question,
    options: question.options.map((option) => option.label),
    choice: given.choice || given.note,
    note: given.choice ? given.note : '',
    because: question.because,
    at: answer.at,
    history: [],
    by: byOrchestrator ? 'orchestrator' : 'you',
  }
  if (byOrchestrator) {
    // Numbered per run, so the morning can say "D3: No" about one of them.
    const earlier = state.decisions.filter((d) => d.dn && d.run === question.run).length
    decision.dn = answer.dn = `D${earlier + 1}`
  }
  state.decisions.push(decision)

  const worker = state.workers[question.ticket]
  if (worker?.stopped === 'question') {
    const doing = byOrchestrator ? 'Got the orchestrator answer' : 'Got your answer'
    Object.assign(worker, { stopped: '', doing, at: answer.at })
  }

  const summary = byOrchestrator ? `${decision.dn} decided while you were away: ${decision.choice}` : `You decided: ${decision.choice}`
  logEvent(question.ticket, 'decided', summary, question.question)
  save()

  for (const listener of waitingForAnswer.get(question.id) ?? []) listener(answer)
  waitingForAnswer.delete(question.id)
  for (const listener of answeredListeners) listener(question)
  return answer
}

/**
 * Resolves with the answer, or with { pending: true } after waitMs so the CLI asks again.
 * Long-polling keeps a sleeping laptop or a restarted server from losing the answer.
 */
export function waitForAnswer(question: Question, waitMs: number, aborted: AbortSignal): Promise<Answer | { pending: true }> {
  if (question.answer) return Promise.resolve(question.answer)

  return new Promise((resolve) => {
    const listeners = waitingForAnswer.get(question.id) ?? new Set()
    waitingForAnswer.set(question.id, listeners)

    const stopWaiting = () => {
      clearTimeout(timer)
      listeners.delete(onAnswer)
    }
    const onAnswer = (answer: Answer) => {
      stopWaiting()
      resolve(answer)
    }
    const timer = setTimeout(() => {
      stopWaiting()
      resolve({ pending: true })
    }, waitMs)

    listeners.add(onAnswer)
    aborted.addEventListener('abort', stopWaiting)
  })
}
