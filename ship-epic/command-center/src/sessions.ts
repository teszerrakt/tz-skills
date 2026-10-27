// Which Claude session works each ticket, read from `claude agents --json`.
// Sessions are named after their ticket (ship-epic's spawn line); the orchestrator's name starts with the run id.
import fs from 'node:fs'
import os from 'node:os'
import { outputOf } from './desktop/process.ts'
import { RequestError, text } from './http.ts'
import { save, state } from './store.ts'
import type { Session } from './types.ts'

const MAX_PROFILES = 8

type Agent = {
  id: string
  sessionId: string
  name?: string
  /** An interactive session reports `status`, a background one `state`. */
  status?: string
  state?: string
  cwd?: string
  startedAt?: number
  profile: string
}

export function expandHome(folder: string): string {
  return folder.replace(/^~(?=$|[\\/])/, os.homedir())
}

/**
 * The Claude config folders to read sessions from. Each profile lists only its own sessions,
 * and attach works only under the profile that owns the session. '' means this server's own.
 */
function profilesToRead(): string[] {
  return state.profiles.length ? state.profiles : ['']
}

export function setProfiles(value: unknown[]): void {
  const folders = [...new Set(value.map((folder) => text(folder, 200).trim()).filter(Boolean))].slice(0, MAX_PROFILES)
  // Listing a folder that is not there would create it, as an empty profile.
  const missing = folders.find((folder) => !fs.existsSync(expandHome(folder)))
  if (missing) throw new RequestError(400, `no such folder: ${missing}`)
  state.profiles = folders
}

async function listAgents(profile: string): Promise<Agent[] | null> {
  const env = profile ? { ...process.env, CLAUDE_CONFIG_DIR: expandHome(profile) } : process.env
  const printed = await outputOf(['claude', 'agents', '--json'], { env })
  if (printed === null) return null
  try {
    return (JSON.parse(printed) as Omit<Agent, 'profile'>[]).map((agent) => ({ ...agent, profile }))
  } catch {
    return null
  }
}

export async function readSessions(): Promise<void> {
  const run = state.run
  if (!run) return

  const perProfile = await Promise.all(profilesToRead().map(listAgents))
  // A profile that could not be read says nothing about its sessions, so none is marked gone.
  if (perProfile.includes(null)) return
  const agents = (perProfile as Agent[][]).flat()

  const tickets = [...new Set([...run.tickets.map((t) => t.ticket), ...Object.keys(state.workers)])]
  const sessionKey = (name: string): string => {
    const ticket = tickets.find((t) => t.toLowerCase() === name.toLowerCase())
    if (ticket) return ticket
    return name.toLowerCase().startsWith(run.id.toLowerCase()) ? 'orchestrator' : ''
  }

  const next: Record<string, Session> = {}
  for (const [key, session] of Object.entries(state.sessions)) next[key] = { ...session, status: 'gone' }

  // Oldest first: a session resumed under another profile after a usage limit is the newer one, and wins.
  agents.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
  for (const agent of agents) {
    const name = String(agent.name || '')
    const key = sessionKey(name)
    if (!key) continue
    next[key] = {
      id: agent.id,
      sessionId: agent.sessionId,
      name,
      status: agent.status || agent.state || '',
      cwd: agent.cwd || '',
      profile: agent.profile,
    }
  }

  if (JSON.stringify(next) === JSON.stringify(state.sessions)) return
  state.sessions = next
  save()
}
