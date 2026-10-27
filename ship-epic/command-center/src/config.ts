import os from 'node:os'
import path from 'node:path'

export const PORT = Number(process.env.SHIP_UI_PORT || 4777)
export const ORIGIN = `http://127.0.0.1:${PORT}`

export const DATA_DIR = process.env.SHIP_UI_DATA || path.join(os.homedir(), '.claude', 'orchestrate', 'ui')
export const STATE_FILE = path.join(DATA_DIR, 'state.json')
export const RUNS_DIR = path.join(DATA_DIR, 'runs')
/** Extra origins allowed to post, one per line, such as a `tailscale serve` address. */
export const ORIGINS_FILE = path.join(DATA_DIR, 'origins')

export const COMMAND_CENTER_DIR = path.resolve(import.meta.dir, '..')

export const TOASTS_SILENCED = Boolean(process.env.SHIP_UI_NO_PING)

/** How long one `ask` request waits before telling the CLI to ask again. */
export const ANSWER_WAIT_MS = 25_000

// The pilot's longest healthy silence was 27 minutes; its hidden stalls ran 29 and up.
export const QUIET_AFTER_MS = Number(process.env.SHIP_UI_QUIET_MIN || 30) * 60_000

export const PR_REFRESH_MS = 120_000
export const SESSION_REFRESH_MS = 60_000
export const TOAST_CHECK_MS = 15_000
