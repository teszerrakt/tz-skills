import { host, type Host } from './host.ts'
import { launchDetached } from './process.ts'

type Opener = { command: string[]; cwd?: string }

const WINDOWS_START = ['cmd.exe', '/c', 'start', '']

const OPENERS: Record<Host, Opener | null> = {
  windows: { command: WINDOWS_START },
  // cmd.exe refuses a WSL folder as its working directory, so it starts from the Windows drive.
  wsl: { command: WINDOWS_START, cwd: '/mnt/c' },
  'linux-desktop': { command: ['xdg-open'] },
  'linux-headless': null,
  mac: { command: ['open'] },
}

/** Opens the URL in the desktop's browser. Does nothing on a host without a desktop. */
export function openUrl(url: string): void {
  const opener = OPENERS[host]
  if (!opener) return
  launchDetached([...opener.command, url], { cwd: opener.cwd })
}
