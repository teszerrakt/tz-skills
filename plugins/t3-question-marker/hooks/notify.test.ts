import { describe, expect, test } from 'bun:test'
import { desktopEnv, firstLine, firstQuestion, noticeFor } from './notify.ts'
import { isPlaceholder, threadLink } from './t3.ts'

const REPLY = 'Built it.\n\n## ❓ Questions\n\n**Q1. Ship it now?**\n\n- **Yes** — today.\n'

describe('notice text', () => {
  test('a question notice shows the first question', () => {
    expect(firstQuestion(REPLY)).toBe('Q1. Ship it now?')
    expect(noticeFor('❓ Fix login', REPLY, true)).toEqual({ summary: '❓ Fix login', body: 'Q1. Ship it now?', link: undefined })
  })
  test('a done notice shows the first line, without Markdown', () => {
    expect(firstLine('## **Done.** All `5` tests pass')).toBe('Done.')
    expect(firstLine('## **Done** with all `5` tests passing')).toBe('Done with all 5 tests passing')
    expect(noticeFor('Fix login', 'x'.repeat(300), false).body.length).toBe(100)
  })
  test('links show as their text, and a # with no space after it stays', () => {
    expect(firstLine('[#1264](https://github.com/o/r/pull/1264) is ready for review.')).toBe('#1264 is ready for review.')
    expect(firstLine('#1263 CI is green on b35bdeb.')).toBe('#1263 CI is green on b35bdeb.')
  })
  test('keeps the first sentence, not cutting at a colon', () => {
    expect(firstLine('#1264: CodeRabbit left 2 minor comments; both were right, so I fixed them.')).toBe('#1264: CodeRabbit left 2 minor comments.')
  })
  test('cuts a long sentence at the last whole word, within 100 characters', () => {
    const body = firstLine(`All four PRs are ready for review: ${'green checks and answered threads '.repeat(4)}`)
    expect(body.length).toBeLessThanOrEqual(100)
    expect(body).toMatch(/ready for review: .*[a-z]…$/)
  })
})

describe('desktop handoff', () => {
  test("drops T3's Electron variables, keeps the rest", () => {
    expect(desktopEnv({ LD_LIBRARY_PATH: '/opt', ELECTRON_RUN_AS_NODE: '1', DISPLAY: ':0' })).toEqual({ DISPLAY: ':0' })
  })
  test('links to the thread in the desktop app', () => {
    expect(threadLink('env 1', 't-1')).toBe('t3code://threads/env%201/t-1')
  })
  test('a truncated first message counts as a placeholder title', () => {
    expect(isPlaceholder('❓ Read figma-map from the tz-skills plugin and follo...')).toBe(true)
    expect(isPlaceholder('Fix login')).toBe(false)
  })
})
