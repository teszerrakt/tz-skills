#!/usr/bin/env bun
// Keeps the machine awake, never the display, until the given pid exits.
//   bun wake-lock.ts [--pid N] [--hours 12]
// Without --pid it holds for the nearest process above it whose command line names claude.
import { findClaudeAncestor, holdAwake, isRunning } from '../command-center/src/desktop/awake.ts'

const POLL_MS = 15_000

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index > 0 ? process.argv[index + 1] : undefined
}

const hours = Number(flag('hours') || 12)
const watchedPid = Number(flag('pid')) || findClaudeAncestor()
if (!watchedPid) {
  console.error('wake-lock: no claude process above this one; pass --pid')
  process.exit(1)
}

const lock = holdAwake()
lock.onLost(() => process.exit(0))
console.log(`wake-lock: held for pid ${watchedPid}, at most ${hours} h`)

function releaseAndExit(reason: string): never {
  lock.release()
  console.log(`wake-lock: released (${reason})`)
  process.exit(0)
}

setInterval(() => {
  if (!isRunning(watchedPid)) releaseAndExit(`pid ${watchedPid} exited`)
}, POLL_MS)
setTimeout(() => releaseAndExit(`${hours} h cap`), hours * 3_600_000)
