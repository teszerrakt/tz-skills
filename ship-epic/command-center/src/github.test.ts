import { expect, test } from 'bun:test'
import { reviewBotState } from './github.ts'

const quiet = { reviews: { nodes: [] }, comments: { nodes: [] } }
const bot = (description: string) => ({ __typename: 'CheckRun' as const, name: 'CodeRabbit', description })

test('no bot check once CI has finished means the repo runs no review bot', () => {
  expect(reviewBotState(quiet, [], true)).toBe('none')
})

test('no bot check while CI still runs is still waiting', () => {
  expect(reviewBotState(quiet, [], false)).toBe('waiting')
})

test('a bot check still in progress waits, whatever CI does', () => {
  expect(reviewBotState(quiet, [bot('Review in progress')], true)).toBe('waiting')
})

test('a rate-limited bot reads limited, not none', () => {
  expect(reviewBotState(quiet, [bot('Review rate limited')], true)).toBe('limited')
})
