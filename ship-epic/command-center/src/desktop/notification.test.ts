import { describe, expect, test } from 'bun:test'
import { answerLine, notificationFor, notifySendArgs } from './notification.ts'
import type { EventToast, QuestionToast } from './toast.ts'

const question: QuestionToast = {
  kind: 'question',
  tag: 'TRA-12',
  state: 'waiting for you',
  time: '13:10',
  title: 'Show decimals on rupiah amounts?',
  options: [
    { label: 'No', detail: 'reads 82.850.000' },
    { label: 'Yes', detail: 'reads 82.850.000,00' },
  ],
  recommended: 1,
  because: 'the ticket says 0 decimals, the currency table seeds 2',
  more: 2,
}

const stopped: EventToast = {
  kind: 'stop',
  tag: 'TRA-12',
  state: 'stopped',
  time: '13:10',
  title: 'A check failed',
  body: 'lint failed on step 6',
  action: 'Open in command center',
}

describe('a question notification', () => {
  const card = notificationFor(question)

  test('has the question alone as its heading', () => {
    expect(card.summary).toBe('Show decimals on rupiah amounts?')
  })

  test('lists each option once, as a button, with the recommended one marked', () => {
    expect(card.actions.map((a) => a.label)).toEqual(['No', '✨ Yes', 'Open'])
    expect(card.body).not.toContain('82.850.000')
  })

  test('says where it is from, why it is asked, and how many wait behind it', () => {
    expect(card.body).toBe(
      'TRA-12 · waiting for you\nAsked because: the ticket says 0 decimals, the currency table seeds 2\n2 more waiting',
    )
  })

  test('stays up and sounds', () => {
    expect(card.urgency).toBe('critical')
    expect(card.seconds).toBe(300)
    expect(card.sound).toBe(true)
  })
})

describe('an event notification', () => {
  test('shows its body and one button that opens the page', () => {
    const card = notificationFor(stopped)
    expect(card.body).toBe('TRA-12 · stopped\nlint failed on step 6')
    expect(card.actions.map((a) => a.label)).toEqual(['Open in command center', 'Open'])
  })

  test('a finished ticket passes quietly', () => {
    const card = notificationFor({ ...stopped, kind: 'good', state: 'finished', title: 'TRA-12 finished its steps' })
    expect(card).toMatchObject({ urgency: 'normal', seconds: 8, sound: false })
  })
})

describe('notify-send arguments', () => {
  test('escape markup in the body, so a label like <Total> survives', () => {
    const args = notifySendArgs(notificationFor({ ...stopped, body: 'the <Total> row & tax' }))
    expect(args.at(-1)).toBe('TRA-12 · stopped\nthe &lt;Total&gt; row &amp; tax')
  })

  test('name each action by id', () => {
    const args = notifySendArgs(notificationFor(question))
    expect(args).toContain('--action=option-0=No')
    expect(args).toContain('--action=option-1=✨ Yes')
    expect(args).toContain('--action=default=Open')
  })
})

describe('the answer line, the same contract as toast.ps1', () => {
  test('a picked option is a choice, by its label without the mark', () => {
    expect(answerLine(question, 'option-1', false)).toBe('choice: Yes')
  })

  test('the card or its open button opens the page', () => {
    expect(answerLine(question, 'default', false)).toBe('open')
    expect(answerLine(stopped, 'open', false)).toBe('open')
  })

  test('closed with nothing picked is later, or timeout once it expired', () => {
    expect(answerLine(question, '', false)).toBe('later')
    expect(answerLine(question, '', true)).toBe('timeout')
  })
})
