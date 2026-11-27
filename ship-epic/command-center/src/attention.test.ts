import { beforeEach, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Checks, PullRequest, Worker } from './types.ts'

// The store loads from SHIP_UI_DATA on import, so point it away from the user's own state first.
process.env.SHIP_UI_DATA ??= mkdtempSync(join(tmpdir(), 'ship-ui-'))
const { attention } = await import('./attention.ts')
const { state } = await import('./store.ts')

const T = 'TEST-1'
const handedOffAt = '2026-10-27T01:31:00.000Z'
const minutesLater = (n: number) => Date.parse(handedOffAt) + n * 60_000

function setup(checks: Partial<Checks>, stopped: Worker['stopped'] = 'review') {
  state.workers[T] = { ticket: T, step: '12/12', stopped, at: handedOffAt }
  const pr: PullRequest = { number: 34, title: '', url: '', state: 'OPEN', draft: false, mergedAt: '', branch: 'b' }
  pr.checks = { ci: 'green', failing: [], rabbit: 'waiting', threads: 0, items: [], conflict: false, head: 'abc', ...checks }
  state.prs[T] = pr
}

const lines = (at: number) =>
  attention(at)
    .filter((item) => item.key.includes(T))
    .map((item) => item.line)

beforeEach(() => {
  delete state.workers[T]
  delete state.prs[T]
  delete state.prs['TEST-0']
  state.run = null
})

test('a handed-off review wakes the worker once the bot has finished and CI has stopped', () => {
  setup({ rabbit: 'reviewed', threads: 3 })
  expect(lines(minutesLater(6))).toEqual(['resume TEST-1: review bot finished on #34, CI green, 3 threads open'])
})

test('it stays quiet while the bot or CI is still running', () => {
  setup({ rabbit: 'waiting' })
  expect(lines(minutesLater(6))).toEqual([])
  setup({ rabbit: 'reviewed', ci: 'running' })
  expect(lines(minutesLater(6))).toEqual([])
})

test('no bot check reads as no bot only ten minutes after the hand-off', () => {
  setup({ rabbit: 'none' })
  expect(lines(minutesLater(5))).toEqual([])
  expect(lines(minutesLater(11))).toEqual(['resume TEST-1: no review bot on #34, CI green'])
})

test('a rate-limited review wakes the worker too, since it has to run the fallback', () => {
  setup({ rabbit: 'limited', ci: 'failing', failing: ['test'] })
  expect(lines(minutesLater(6))).toContain('resume TEST-1: review bot rate limited on #34, CI failing')
})

test('a review hand-off is neither a stop nor a quiet worker', () => {
  setup({ rabbit: 'waiting' })
  expect(lines(minutesLater(90))).toEqual([])
})

function hold(after: string, afterState: PullRequest['state']) {
  setup({}, 'held-draft')
  state.prs[T]!.draft = true
  state.run = { id: 'r', title: '', summary: '', repo: '', afk: false, target: 'main', where: '', github: '', startedAt: '', tickets: [{ ticket: T, title: '', group: 1, after, url: '' }] }
  state.prs['TEST-0'] = { number: 33, title: '', url: '', state: afterState, draft: false, mergedAt: afterState === 'MERGED' ? '2026-10-27T01:40:00.000Z' : '', branch: 'a' }
}

test('a held draft asks for its review on each stop, and is next in line once the ticket it merges after has merged', () => {
  hold('TEST-0', 'MERGED')
  expect(lines(minutesLater(1))).toEqual([
    'held TEST-1: #34 is a draft; review it, or mark it ready when its turn comes',
    'next TEST-1: TEST-0 merged; bring #34 over, review it, then mark it ready',
  ])
})

test('a held draft gets no next line while the ticket ahead is open, or when it has no after', () => {
  hold('TEST-0', 'OPEN')
  expect(lines(minutesLater(90))).toEqual(['held TEST-1: #34 is a draft; review it, or mark it ready when its turn comes'])
  hold('', 'MERGED')
  expect(lines(minutesLater(90))).toEqual(['held TEST-1: #34 is a draft; review it, or mark it ready when its turn comes'])
})

test('a held draft stopping again after its bring-over keeps the same next key', () => {
  hold('TEST-0', 'MERGED')
  const first = attention(minutesLater(1)).find((i) => i.key.startsWith('next:'))?.key
  state.workers[T]!.at = '2026-10-27T02:00:00.000Z'
  const again = attention(minutesLater(40)).find((i) => i.key.startsWith('next:'))?.key
  expect(again).toBe(first)
})

test('a PR already ready or merged is no held draft', () => {
  hold('TEST-0', 'MERGED')
  state.prs[T]!.draft = false
  expect(lines(minutesLater(1))).toEqual([])
  hold('TEST-0', 'MERGED')
  state.prs[T]!.state = 'MERGED'
  expect(lines(minutesLater(1))).toEqual([])
})

test('a conflict waits while the PR ahead of it in merge order is still open', () => {
  hold('TEST-0', 'OPEN')
  state.workers[T]!.stopped = 'done'
  state.prs[T]!.draft = false
  state.prs[T]!.checks!.conflict = true
  expect(lines(minutesLater(1))).toEqual([])
  state.prs['TEST-0']!.state = 'MERGED'
  expect(lines(minutesLater(1))).toEqual(['resume TEST-1: #34 conflicts with main'])
})
