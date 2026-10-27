// The toast queue. One toast at a time, since they share one corner of the screen:
// event toasts first, in order, then the oldest open question that is not snoozed.
import { TOASTS_SILENCED } from './config.ts'
import { openUrl } from './desktop/open-url.ts'
import { showToast, toastsAvailable, type EventToast, type ShownToast, type ToastOutcome } from './desktop/toast.ts'
import { answerQuestion, ORCHESTRATOR_TICKET } from './questions.ts'
import { clock, state } from './store.ts'
import type { Question } from './types.ts'

/** How long a question stays off the screen after its toast closes unanswered. */
const SNOOZE_MS: Record<'open' | 'later' | 'timeout', number> = {
  open: 5 * 60_000,
  later: 5 * 60_000,
  timeout: 60_000,
}

type QueuedEvent = { toast: EventToast; pageAnchor: string }

const eventsWaiting: QueuedEvent[] = []
const snoozedUntil = new Map<string, number>()
let onScreen: { questionId: string | null; toast: ShownToast } | null = null

const canShow = !TOASTS_SILENCED && toastsAvailable()

let pageOrigin = ''

/** Where "open" sends the user. Set once by the server. */
export function useOrigin(origin: string): void {
  pageOrigin = origin
}

function openPage(anchor: string): void {
  openUrl(`${pageOrigin}/${anchor ? `#${anchor}` : ''}`)
}

export function queueEventToast(toast: EventToast): void {
  eventsWaiting.push({ toast, pageAnchor: `t-${toast.tag}` })
}

/** Takes the toast down if it asks this question, which was just answered somewhere else. */
export function closeToastFor(question: Question): void {
  if (onScreen?.questionId === question.id && question.answer?.via !== 'toast') onScreen.toast.close()
}

export function closeCurrentToast(): void {
  onScreen?.toast.close()
}

export function showNextToast(): void {
  if (!canShow || onScreen) return
  if (!state.toasts) {
    // Toasts are switched off for this run: what happened meanwhile is on the page.
    eventsWaiting.length = 0
    return
  }

  const event = eventsWaiting.shift()
  if (event) {
    show(null, showToast(event.toast), (outcome) => {
      if (outcome.kind === 'open') openPage(event.pageAnchor)
    })
    return
  }

  const open = state.questions.filter((q) => !q.answer)
  const question = open.find((q) => (snoozedUntil.get(q.id) ?? 0) <= Date.now())
  if (!question) return

  const toast = showToast({
    kind: 'question',
    tag: question.ticket === ORCHESTRATOR_TICKET ? 'ORCHESTRATOR' : question.ticket,
    state: 'waiting for you',
    time: clock(question.askedAt),
    title: question.question,
    options: question.options,
    recommended: question.recommended,
    because: question.because,
    more: open.length - 1,
  })
  show(question.id, toast, (outcome) => {
    if (outcome.kind === 'answered') {
      if (!question.answer) answerQuestion(question, { choice: outcome.choice, note: outcome.note, via: 'toast' })
      return
    }
    snoozedUntil.set(question.id, Date.now() + SNOOZE_MS[outcome.kind])
    if (outcome.kind === 'open') openPage(question.id)
  })
}

function show(questionId: string | null, toast: ShownToast, handle: (outcome: ToastOutcome) => void): void {
  onScreen = { questionId, toast }
  toast.outcome.then((outcome) => {
    onScreen = null
    handle(outcome)
    showNextToast()
  })
}
