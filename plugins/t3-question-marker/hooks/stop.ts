#!/usr/bin/env bun
// Stop hook: keeps a T3 Code thread's title marked `❓ ` while the agent's last reply ends with open questions.
// T3 marks a thread as waiting only for AskUserQuestion; this lets a plain-text `❓` section show in the thread list.
// It blocks the stop once, asking the agent to rename the thread; every failure path allows the stop silently.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const MARK = '❓ '
const CLI_TIMEOUT_MS = 10_000

export type HookInput = { transcript_path?: string; stop_hook_active?: boolean; last_assistant_message?: string }
export type Decision = { decision: 'block'; reason: string } | undefined

type Env = Record<string, string | undefined>
type TranscriptEntry = { type?: string; message?: { id?: string; content?: unknown } }

/** True when some line opens with `❓`, optionally after Markdown heading `#`s or `**`. */
export function hasQuestions(text: string): boolean {
  return /^[ \t]*(?:#+[ \t]*|\*\*[ \t]*)?❓/mu.test(text)
}

export function isMarked(title: string): boolean {
  return title.startsWith(MARK)
}

/** The text of the transcript's last assistant message, joining the entries that share its message id. */
export function lastAssistantText(jsonl: string): string {
  const entries = jsonl
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(parseEntry)
    .filter((entry): entry is TranscriptEntry => entry?.type === 'assistant')
  const last = entries.findLast((entry) => textOf(entry) !== '')
  if (!last) return ''
  const id = last.message?.id
  if (!id) return textOf(last)
  return entries
    .filter((entry) => entry.message?.id === id)
    .map(textOf)
    .filter((text) => text !== '')
    .join('\n')
}

function parseEntry(line: string): TranscriptEntry | undefined {
  try {
    return JSON.parse(line) as TranscriptEntry
  } catch {
    return undefined
  }
}

function textOf(entry: TranscriptEntry): string {
  const content = entry.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

/** Whether to block the stop, given what the reply asks and how the thread is titled. */
export function decide(questions: boolean, title: string): Decision {
  const marked = isMarked(title)
  if (questions && !marked) {
    return blockWith(`rename this thread to "${MARK}${title}"`)
  }
  if (!questions && marked) {
    return blockWith(`rename this thread back to "${title.slice(MARK.length)}"`)
  }
  return undefined
}

function blockWith(rename: string): Decision {
  return {
    decision: 'block',
    reason:
      `t3-question-marker: ${rename} with the mcp__t3-code__t3_thread_update tool ` +
      '(action "rename", omit threadId), then stop. Do not repeat or change your reply.',
  }
}

function cliPath(env: Env): string {
  return env.T3CODE_CLI_PATH || join(homedir(), '.t3/bin/t3')
}

/** The thread's title, or undefined when the CLI is missing, fails or times out. */
export function threadTitle(threadId: string, cli: string): string | undefined {
  if (!existsSync(cli)) return undefined
  try {
    const result = Bun.spawnSync([cli, 'thread', 'show', threadId], { timeout: CLI_TIMEOUT_MS, stderr: 'ignore' })
    if (!result.success) return undefined
    const title = result.stdout.toString().split('\n')[0]?.trim()
    return title || undefined
  } catch {
    return undefined
  }
}

function replyText(input: HookInput): string {
  if (input.last_assistant_message) return input.last_assistant_message
  if (!input.transcript_path || !existsSync(input.transcript_path)) return ''
  return lastAssistantText(readFileSync(input.transcript_path, 'utf8'))
}

/** The whole hook: the stdin JSON in, the stdout JSON out (empty to allow the stop). */
export function run(stdin: string, env: Env = process.env): string {
  const threadId = env.T3CODE_THREAD_ID
  if (!threadId) return ''
  const input = parseInput(stdin)
  if (!input || input.stop_hook_active) return ''
  const title = threadTitle(threadId, cliPath(env))
  if (!title) return ''
  const decision = decide(hasQuestions(replyText(input)), title)
  return decision ? JSON.stringify(decision) : ''
}

function parseInput(stdin: string): HookInput | undefined {
  try {
    return JSON.parse(stdin) as HookInput
  } catch {
    return undefined
  }
}

if (import.meta.main) {
  try {
    const out = run(await Bun.stdin.text())
    if (out) process.stdout.write(out)
  } catch {
    // Allow the stop whatever went wrong.
  }
  process.exit(0)
}
