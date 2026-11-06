import { afterAll, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decide, hasQuestions, lastAssistantText, run } from './stop.ts'

const dir = mkdtempSync(join(tmpdir(), 't3-question-marker-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function fakeCli(name: string, script: string): string {
  const path = join(dir, name)
  writeFileSync(path, `#!/bin/sh\n${script}\n`)
  chmodSync(path, 0o755)
  return path
}

function transcript(...entries: object[]): string {
  const path = join(dir, `t-${Math.random()}.jsonl`)
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join('\n') + '\n')
  return path
}

const assistant = (id: string, text: string) => ({ type: 'assistant', message: { id, content: [{ type: 'text', text }] } })
const QUESTIONS = 'Done.\n\n## ❓ Questions\n\nShip it now?'
const input = (extra: object = {}) => JSON.stringify({ transcript_path: transcript(assistant('m1', QUESTIONS)), ...extra })

describe('hasQuestions', () => {
  test('finds a ❓ line, bare or after # or **', () => {
    expect(hasQuestions('a\n❓ Which one?')).toBe(true)
    expect(hasQuestions('a\n### ❓ Questions')).toBe(true)
    expect(hasQuestions('a\n**❓ Questions**')).toBe(true)
  })
  test('ignores a ❓ mid-line', () => {
    expect(hasQuestions('the ❓ marker is added by the hook')).toBe(false)
  })
})

describe('lastAssistantText', () => {
  test('takes the last assistant reply, joining blocks that share its id', () => {
    const jsonl = [
      assistant('m1', 'old ❓ text'),
      { type: 'user', message: { content: 'ok' } },
      assistant('m2', 'part one'),
      { type: 'assistant', message: { id: 'm2', content: [{ type: 'tool_use', name: 'x' }] } },
      assistant('m2', '❓ part two'),
    ]
      .map((e) => JSON.stringify(e))
      .join('\n')
    expect(lastAssistantText(jsonl)).toBe('part one\n❓ part two')
  })
  test('skips lines that are not JSON', () => {
    expect(lastAssistantText(`not json\n${JSON.stringify(assistant('m1', 'hi'))}`)).toBe('hi')
  })
})

describe('decide', () => {
  test('asks to mark an unmarked thread when the reply has questions', () => {
    expect(decide(true, 'Fix login')?.reason).toContain('"❓ Fix login"')
  })
  test('asks to unmark a marked thread when the reply has none', () => {
    expect(decide(false, '❓ Fix login')?.reason).toContain('back to "Fix login"')
  })
  test('allows when title and reply agree', () => {
    expect(decide(true, '❓ Fix login')).toBeUndefined()
    expect(decide(false, 'Fix login')).toBeUndefined()
  })
})

describe('run', () => {
  const titled = fakeCli('t3', 'printf "Fix login\\nid  running\\n"')
  const env = { T3CODE_THREAD_ID: 'thread-1', T3CODE_CLI_PATH: titled }

  test('blocks with the rename when questions meet an unmarked title', () => {
    const out = JSON.parse(run(input(), env))
    expect(out.decision).toBe('block')
    expect(out.reason).toContain('mcp__t3-code__t3_thread_update')
  })
  test('prefers last_assistant_message over the transcript', () => {
    expect(run(input({ last_assistant_message: 'no questions' }), env)).toBe('')
  })
  test('allows outside T3', () => {
    expect(run(input(), { T3CODE_CLI_PATH: titled })).toBe('')
  })
  test('allows when the stop was already blocked once', () => {
    expect(run(input({ stop_hook_active: true }), env)).toBe('')
  })
  test('allows when the CLI is missing or fails', () => {
    expect(run(input(), { ...env, T3CODE_CLI_PATH: join(dir, 'missing') })).toBe('')
    expect(run(input(), { ...env, T3CODE_CLI_PATH: fakeCli('broken', 'exit 1') })).toBe('')
  })
  test('allows on stdin that is not JSON', () => {
    expect(run('nope', env)).toBe('')
  })
})
