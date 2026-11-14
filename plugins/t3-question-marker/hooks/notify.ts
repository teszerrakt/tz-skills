// Desktop notification for a finished turn, with an "Open thread" button that jumps to the thread in T3 Code.
import { spawn } from 'node:child_process'
import type { Env } from './t3.ts'

export type Notice = { summary: string; body: string; link?: string }

/** Noctalia's history shows two lines of body, about 105 characters. */
export const BODY_MAX = 100

/** The question a reply asks first: the first bold line after its ❓ heading. */
export function firstQuestion(reply: string): string | undefined {
  const lines = reply.split('\n')
  const start = lines.findIndex((line) => /^[ \t]*(?:#+[ \t]*|\*\*[ \t]*)?❓/u.test(line))
  if (start < 0) return undefined
  for (const line of lines.slice(start + 1)) {
    const bold = /^\s*\*\*(.+?)\*\*/.exec(line)
    if (bold?.[1]) return clip(plain(bold[1]))
  }
  return undefined
}

/** The reply's first sentence of prose, without Markdown, cut to fit the notification. */
export function firstLine(reply: string): string {
  const line = reply
    .split('\n')
    .map((l) =>
      plain(l)
        .replace(/^(?:#+\s+|[>*\-|]\s*)+/, '')
        .trim(),
    )
    .find((l) => l !== '')
  if (!line) return 'Finished.'
  // Not at a colon: "#1264: CodeRabbit left 2 comments." would shrink to "#1264:".
  return clip(line.split(/(?<=[.;])\s/)[0]!.replace(/;$/, '.'))
}

/** Links as their text, bare URLs dropped, emphasis and code marks removed. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<?https?:\/\/\S+>?/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s{2,}/g, ' ')
}

/** Cuts at the last whole word that fits. */
function clip(text: string): string {
  if (text.length <= BODY_MAX) return text
  const cut = text.lastIndexOf(' ', BODY_MAX - 1)
  return `${text.slice(0, cut > 0 ? cut : BODY_MAX - 1).replace(/[\s,;:]+$/, '')}…`
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
