// Desktop notification for a finished turn, with an "Open thread" button that jumps to the thread in T3 Code.
import { spawn } from 'node:child_process'
import type { Env } from './t3.ts'

export type Notice = { summary: string; body: string; link?: string }

const BODY_MAX = 140

/** The question a reply asks first: the first bold line after its ❓ heading. */
export function firstQuestion(reply: string): string | undefined {
  const lines = reply.split('\n')
  const start = lines.findIndex((line) => /^[ \t]*(?:#+[ \t]*|\*\*[ \t]*)?❓/u.test(line))
  if (start < 0) return undefined
  for (const line of lines.slice(start + 1)) {
    const bold = /^\s*\*\*(.+?)\*\*/.exec(line)
    if (bold?.[1]) return clip(bold[1])
  }
  return undefined
}

/** The reply's first line of prose, without Markdown markers. */
export function firstLine(reply: string): string {
  const line = reply
    .split('\n')
    .map((l) =>
      l
        .replace(/^[#>*\-\s|`]+/, '')
        .replace(/[*_`]/g, '')
        .trim(),
    )
    .find((l) => l !== '')
  return clip(line ?? 'Finished.')
}

function clip(text: string): string {
  return text.length > BODY_MAX ? `${text.slice(0, BODY_MAX - 1)}…` : text
}

export function noticeFor(title: string, reply: string, questions: boolean, link?: string): Notice {
  if (questions) return { summary: `❓ ${title.replace(/^❓ /, '')}`, body: firstQuestion(reply) ?? 'Has a question for you.', link }
  return { summary: `✓ ${title}`, body: firstLine(reply), link }
}

// T3 runs hooks with its bundled libnotify on LD_LIBRARY_PATH (notify-send crashes on it) and with
// ELECTRON_RUN_AS_NODE=1 (the desktop app then starts as plain Node and never sees the link).
export function desktopEnv(env: Env): Env {
  const { LD_LIBRARY_PATH: _ld, ELECTRON_RUN_AS_NODE: _node, ...rest } = env
  return rest
}

const SCRIPT = `if [ -z "$3" ]; then exec notify-send -a "T3 Code" -i com.t3tools.T3Code -- "$1" "$2"; fi
choice=$(notify-send -a "T3 Code" -i com.t3tools.T3Code -A open="Open thread" -- "$1" "$2")
[ "$choice" = open ] && exec xdg-open "$3"`

/** Shows the notice without waiting: the button needs a process that outlives the hook. */
export function notify(notice: Notice, env: Env): void {
  try {
    const child = spawn('sh', ['-c', SCRIPT, 'notify', notice.summary, notice.body, notice.link ?? ''], {
      env: desktopEnv(env),
      stdio: 'ignore',
      detached: true,
    })
    child.on('error', () => {})
    child.unref()
  } catch {
    // No notification daemon or no notify-send: the turn still ends normally.
  }
}
