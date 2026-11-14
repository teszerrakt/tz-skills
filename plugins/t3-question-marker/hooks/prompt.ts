#!/usr/bin/env bun
// UserPromptSubmit hook: tells the agent how to keep a T3 Code thread's `❓ ` title mark right before it replies,
// so the Stop hook rarely has to block (a blocked stop makes the agent's last message a rename, hiding its reply).
// A marked title means the user just answered: the agent removes the mark first. Every failure path adds nothing.
import { BODY_MAX } from './notify.ts'
import { cliPath, isMarked, isPlaceholder, MARK, RENAME_TOOL, threadInfo, unmarked, type Env } from './t3.ts'

type Output = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit'; additionalContext: string } }

/** The context to add for a thread titled `title`; `notifies` is false for a worker, whose parent reports for it. */
export function contextFor(title: string, notifies = true): string {
  const lines = [`t3-question-marker: this T3 thread is titled "${title}".`]
  if (notifies) {
    lines.push(
      `Open your reply with one plain sentence of at most ${BODY_MAX} characters that says the outcome, with no links or Markdown: the desktop notification shows that line.`,
    )
  }
  if (isMarked(title)) {
    lines.push(
      `Its ${MARK.trim()} mark is from questions the user has now answered: before anything else, rename it to "${unmarked(title)}" with ${RENAME_TOOL}.`,
    )
  }
  const target = isPlaceholder(title)
    ? `"${MARK}<a 3–6 word title for this thread>" (the current title is just the truncated first message)`
    : `"${MARK}${unmarked(title)}"`
  lines.push(
    `If this turn's reply will end with a ❓ section, rename the thread to ${target} with ${RENAME_TOOL} before you write that reply, so the reply stays the turn's last message.`,
  )
  return lines.join(' ')
}

/** The whole hook: the stdin JSON in, the stdout JSON out (empty to add nothing). */
export function run(env: Env = process.env): string {
  const threadId = env.T3CODE_THREAD_ID
  if (!threadId) return ''
  const thread = threadInfo(threadId, cliPath(env))
  if (!thread) return ''
  const context = contextFor(thread.title, !thread.parentThreadId)
  const output: Output = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } }
  return JSON.stringify(output)
}

if (import.meta.main) {
  try {
    const out = run()
    if (out) process.stdout.write(out)
  } catch {
    // Add nothing whatever went wrong.
  }
  process.exit(0)
}
