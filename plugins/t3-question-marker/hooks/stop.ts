#!/usr/bin/env bun
// Stop hook: keeps a T3 Code thread's title marked `❓ ` while the agent's last reply ends with open questions.
// T3 marks a thread as waiting only for AskUserQuestion; this lets a plain-text `❓` section show in the thread list.
// The agent normally renames before it replies (prompt.ts tells it how); this hook is the fallback. It blocks the stop
// once, and because T3 shows only a turn's last message, it asks the agent to repeat its reply after the rename.
// A stop it allows ends the turn, so it also sends the desktop notification (notify.ts).
// Every failure path allows the stop silently.
import { existsSync, readFileSync } from 'node:fs'
import { noticeFor, notify, type Notice } from './notify.ts'
import { cliPath, environmentId, isMarked, isPlaceholder, MARK, RENAME_TOOL, threadLink, threadTitle, unmarked, type Env } from './t3.ts'

export type HookInput = { transcript_path?: string; stop_hook_active?: boolean; last_assistant_message?: string }
export type Decision = { decision: 'block'; reason: string } | undefined

type TranscriptEntry = { type?: string; message?: { id?: string; content?: unknown } }

/** True when some line opens with `❓`, optionally after Markdown heading `#`s or `**`. */
export function hasQuestions(text: string): boolean {
  return /^[ \t]*(?:#+[ \t]*|\*\*[ \t]*)?❓/mu.test(text)
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
    const target = isPlaceholder(title)
      ? `"${MARK}<a 3–6 word title for this thread>" (its title is still the truncated first message)`
      : `"${MARK}${title}"`
    return blockWith(`rename this thread to ${target}`, 'your closing ❓ section, word for word')
  }
  if (!questions && marked) {
    return blockWith(`rename this thread back to "${unmarked(title)}"`, 'your reply in full')
  }
  return undefined
}

function blockWith(rename: string, repeat: string): Decision {
  return {
    decision: 'block',
    reason:
      `t3-question-marker: ${rename} with ${RENAME_TOOL}. T3 shows only a turn's last message, ` +
      `so then end the turn by repeating ${repeat}. Next time, rename before you write the reply.`,
  }
}

function replyText(input: HookInput): string {
  if (input.last_assistant_message) return input.last_assistant_message
  if (!input.transcript_path || !existsSync(input.transcript_path)) return ''
  return lastAssistantText(readFileSync(input.transcript_path, 'utf8'))
}

/** The whole hook: the stdin JSON in, the stdout JSON out (empty to allow the stop). */
export function run(stdin: string, env: Env = process.env, send: (notice: Notice) => void = (n) => notify(n, env)): string {
  const threadId = env.T3CODE_THREAD_ID
  if (!threadId) return ''
  const input = parseInput(stdin)
  if (!input) return ''
  const title = threadTitle(threadId, cliPath(env))
  const reply = replyText(input)
  const questions = hasQuestions(reply)
  const decision = title && !input.stop_hook_active ? decide(questions, title) : undefined
  if (decision) return JSON.stringify(decision)
  const environment = environmentId(env)
  send(noticeFor(unmarked(title ?? 'T3 Code'), reply, questions, environment && threadLink(environment, threadId)))
  return ''
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
