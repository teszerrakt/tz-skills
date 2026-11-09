#!/usr/bin/env bun
// UserPromptSubmit hook: tells the agent how to keep a T3 Code thread's `❓ ` title mark right before it replies,
// so the Stop hook rarely has to block (a blocked stop makes the agent's last message a rename, hiding its reply).
// A marked title means the user just answered: the agent removes the mark first. Every failure path adds nothing.
import { cliPath, isMarked, MARK, RENAME_TOOL, threadTitle, unmarked, type Env } from './t3.ts'

type Output = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit'; additionalContext: string } }

/** The context to add for a thread titled `title`. */
export function contextFor(title: string): string {
  const lines = [`t3-question-marker: this T3 thread is titled "${title}".`]
  if (isMarked(title)) {
    lines.push(
      `Its ${MARK.trim()} mark is from questions the user has now answered: before anything else, rename it to "${unmarked(title)}" with ${RENAME_TOOL}.`,
    )
  }
  lines.push(
    `If this turn's reply will end with a ❓ section, rename the thread to "${MARK}${unmarked(title)}" with ${RENAME_TOOL} before you write that reply, so the reply stays the turn's last message.`,
  )
  return lines.join(' ')
}

/** The whole hook: the stdin JSON in, the stdout JSON out (empty to add nothing). */
export function run(env: Env = process.env): string {
  const threadId = env.T3CODE_THREAD_ID
  if (!threadId) return ''
  const title = threadTitle(threadId, cliPath(env))
  if (!title) return ''
  const output: Output = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: contextFor(title) } }
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
