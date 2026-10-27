// Which desktop this process can reach. Every OS-specific job looks itself up by host.
import { execFileSync } from 'node:child_process'
import os from 'node:os'

export const HOSTS = ['windows', 'wsl', 'linux-desktop', 'linux-headless', 'mac'] as const
export type Host = (typeof HOSTS)[number]

type Machine = {
  platform: NodeJS.Platform
  kernelRelease: string
  env: Record<string, string | undefined>
}

const thisMachine: Machine = { platform: process.platform, kernelRelease: os.release(), env: process.env }

export function detectHost(machine: Machine = thisMachine): Host {
  const override = machine.env.SHIP_UI_HOST
  if (override) {
    if (!isHost(override)) throw new Error(`SHIP_UI_HOST must be one of: ${HOSTS.join(', ')}`)
    return override
  }

  if (machine.platform === 'win32') return 'windows'
  if (machine.platform === 'darwin') return 'mac'
  if (/microsoft/i.test(machine.kernelRelease)) return 'wsl'

  // A claude started from an SSH shell or a service has no display to show anything on.
  const hasDisplay = Boolean(machine.env.WAYLAND_DISPLAY || machine.env.DISPLAY)
  return hasDisplay ? 'linux-desktop' : 'linux-headless'
}

function isHost(value: string): value is Host {
  return (HOSTS as readonly string[]).includes(value)
}

export const host: Host = detectHost()

/** Under WSL a Windows program needs a Windows path; everywhere else a path is already right. */
export function pathForDesktop(linuxPath: string): string {
  if (host !== 'wsl') return linuxPath
  return execFileSync('wslpath', ['-w', linuxPath], { encoding: 'utf8' }).trim()
}
