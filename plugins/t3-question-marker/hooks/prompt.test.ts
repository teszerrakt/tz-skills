import { afterAll, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contextFor, run } from './prompt.ts'

const dir = mkdtempSync(join(tmpdir(), 't3-question-marker-prompt-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function fakeCli(title: string): string {
  const path = join(dir, `t3-${Math.random()}`)
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\nid  completed\\n' '${title}'\n`)
  chmodSync(path, 0o755)
  return path
}

describe('contextFor', () => {
  test('an unmarked title: says how to mark it before a reply with questions', () => {
    const context = contextFor('Fix login')
    expect(context).toContain('rename the thread to "❓ Fix login"')
    expect(context).not.toContain('before anything else')
  })
  test('a marked title: unmark first, and mark again only from the bare title', () => {
    const context = contextFor('❓ Fix login')
    expect(context).toContain('before anything else, rename it to "Fix login"')
    expect(context).toContain('rename the thread to "❓ Fix login"')
    expect(context).not.toContain('❓ ❓')
  })
})

describe('run', () => {
  test('adds the context as UserPromptSubmit output in a T3 thread', () => {
    const out = JSON.parse(run({ T3CODE_THREAD_ID: 't1', T3CODE_CLI_PATH: fakeCli('❓ Fix login') }))
    expect(out.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit')
    expect(out.hookSpecificOutput.additionalContext).toContain('rename it to "Fix login"')
  })
  test('adds nothing outside T3 or when the CLI is missing', () => {
    expect(run({ T3CODE_CLI_PATH: fakeCli('Fix login') })).toBe('')
    expect(run({ T3CODE_THREAD_ID: 't1', T3CODE_CLI_PATH: join(dir, 'missing') })).toBe('')
  })
})
