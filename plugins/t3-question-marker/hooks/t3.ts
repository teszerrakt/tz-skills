// What both hooks need from T3 Code: the thread's title, read with the `t3` CLI, and the `❓ ` mark on it.
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const MARK = '❓ '
const CLI_TIMEOUT_MS = 10_000

export type Env = Record<string, string | undefined>

export function isMarked(title: string): boolean {
  return title.startsWith(MARK)
}

export function unmarked(title: string): string {
  return isMarked(title) ? title.slice(MARK.length) : title
}

export function cliPath(env: Env): string {
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

export const RENAME_TOOL = 'the mcp__t3-code__t3_thread_update tool (action "rename", omit threadId)'
