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
    expect(firstLine('## **Done.** All `5` tests pass')).toBe('Done. All 5 tests pass')
    expect(noticeFor('Fix login', 'x'.repeat(300), false).body.length).toBe(140)
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
