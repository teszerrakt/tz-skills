import { afterAll, describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Notice } from './notify.ts'
import { decide, hasQuestions, lastAssistantText, lastTurn, run, worthNotifying } from './stop.ts'

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
    const reason = decide(true, 'Fix login')?.reason
    expect(reason).toContain('"❓ Fix login"')
    expect(reason).toContain('repeating your closing ❓ section')
  })
  test('asks to unmark a marked thread when the reply has none', () => {
    const reason = decide(false, '❓ Fix login')?.reason
    expect(reason).toContain('back to "Fix login"')
    expect(reason).toContain('repeating your reply in full')
  })
  test('allows when title and reply agree', () => {
    expect(decide(true, '❓ Fix login')).toBeUndefined()
    expect(decide(false, 'Fix login')).toBeUndefined()
  })
})

describe('run', () => {
  const titled = fakeCli('t3', `printf '%s' '{"thread":{"title":"Fix login","parentThreadId":null}}'`)
  const worker = fakeCli('t3-worker', `printf '%s' '{"thread":{"title":"TRA-1 worker","parentThreadId":"epic-1"}}'`)
  const home = join(dir, 't3home')
  mkdirSync(join(home, 'userdata'), { recursive: true })
  writeFileSync(join(home, 'userdata/environment-id'), 'env-1\n')
  const env = { T3CODE_THREAD_ID: 'thread-1', T3CODE_CLI_PATH: titled, T3CODE_HOME: home }
  let sent: Notice[] = []
  const send = (notice: Notice) => sent.push(notice)
  const runIt = (stdin: string, e: Record<string, string | undefined> = env) => {
    sent = []
    return run(stdin, e, send)
  }

  test('blocks with the rename when questions meet an unmarked title, and sends no notice', () => {
    const out = JSON.parse(runIt(input(), env))
    expect(out.decision).toBe('block')
    expect(out.reason).toContain('mcp__t3-code__t3_thread_update')
    expect(sent).toEqual([])
  })
  test('a finished turn sends a done notice linking to the thread', () => {
    expect(runIt(input({ last_assistant_message: 'All tests pass.' }), env)).toBe('')
    expect(sent).toEqual([{ summary: '✓ Fix login', body: 'All tests pass.', link: 't3code://threads/env-1/thread-1' }])
  })
  test('a turn ending in questions, after the rename, sends a question notice', () => {
    runIt(input({ stop_hook_active: true }), env)
    expect(sent[0]?.summary).toBe('❓ Fix login')
  })
  test('prefers last_assistant_message over the transcript', () => {
    expect(runIt(input({ last_assistant_message: 'no questions' }), env)).toBe('')
  })
  test('allows outside T3, without a notice', () => {
    expect(runIt(input(), { T3CODE_CLI_PATH: titled })).toBe('')
    expect(sent).toEqual([])
  })
  test('allows when the stop was already blocked once', () => {
    expect(runIt(input({ stop_hook_active: true }), env)).toBe('')
  })
  test('allows when the CLI is missing or fails', () => {
    expect(runIt(input(), { ...env, T3CODE_CLI_PATH: join(dir, 'missing') })).toBe('')
    expect(runIt(input(), { ...env, T3CODE_CLI_PATH: fakeCli('broken', 'exit 1') })).toBe('')
  })
  test('a worker thread sends no notice, but still gets its title fixed', () => {
    expect(runIt(input({ last_assistant_message: 'All tests pass.' }), { ...env, T3CODE_CLI_PATH: worker })).toBe('')
    expect(sent).toEqual([])
    expect(JSON.parse(runIt(input(), { ...env, T3CODE_CLI_PATH: worker })).decision).toBe('block')
  })
  test('allows on stdin that is not JSON', () => {
    expect(runIt('nope', env)).toBe('')
  })
  test("a PR-watch update's progress note sends no notice", () => {
    const path = transcript(prompt('Update on pull request #12 (https://x), which T3 Code is watching for you:'), assistant('m1', 'CI is still running.'))
    expect(runIt(JSON.stringify({ transcript_path: path }), env)).toBe('')
    expect(sent).toEqual([])
  })
})

const prompt = (text: string) => ({ type: 'user', message: { content: text } })
const toolResult = { type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }
const meta = { type: 'user', isMeta: true, message: { content: 'Stop hook feedback: rename' } }

describe('lastTurn', () => {
  test('takes the last typed or sent prompt, skipping tool results and meta entries, and the reply before it', () => {
    const jsonl = [prompt('first'), assistant('a', 'earlier'), prompt('Delegated task t-1 [completed]:'), toolResult, meta, assistant('b', 'now')]
      .map((e) => JSON.stringify(e))
      .join('\n')
    expect(lastTurn(jsonl)).toEqual({ prompt: 'Delegated task t-1 [completed]:', earlierReply: 'earlier' })
  })
})

const asking = (q: string) => `Worker is mid-run.\n\n## ❓ Questions\n\n**${q}**\n`

const update = (earlierReply = '') => ({ prompt: 'Update on pull request #1264 (https://x), which T3 Code is watching for you:', earlierReply })

describe('worthNotifying', () => {
  test('a turn you started always notifies', () => {
    expect(worthNotifying({ prompt: 'okay', earlierReply: '' }, 'Merged main.')).toBe(true)
  })
  test('an automatic progress note stays quiet', () => {
    expect(worthNotifying(update(), 'CodeRabbit left 2 minor comments.')).toBe(false)
    expect(worthNotifying({ prompt: 'Delegated task t-1 (TRA-1) [completed]:', earlierReply: '' }, 'Worker is mid-run.')).toBe(false)
  })
  test('an automatic turn notifies for a new question, not one the previous reply already asked', () => {
    expect(worthNotifying(update('All green.'), asking('Keep the old path?'))).toBe(true)
    expect(worthNotifying(update(asking('Keep the old path?')), asking('Keep the old path?'))).toBe(false)
    expect(worthNotifying(update(asking('Keep the old path?')), asking('Merge now?'))).toBe(true)
  })
  test('an automatic turn notifies when its first line says a PR is ready for review, not "not ready"', () => {
    expect(worthNotifying(update(), '**#1264 is ready for review:** all 4 checks passed.')).toBe(true)
    expect(worthNotifying(update(), '#1263: CI green. Still not ready for review.')).toBe(false)
  })
})
