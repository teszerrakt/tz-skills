// The wake lock: keeps the machine awake, never the display.
import { execFileSync, spawn } from 'node:child_process'
import { host, type Host } from './host.ts'

// ES_CONTINUOUS | ES_SYSTEM_REQUIRED, never ES_DISPLAY_REQUIRED: the screen still sleeps on its own plan.
const HOLD_ON_WINDOWS = `Add-Type -Name P -Namespace W -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'; [W.P]::SetThreadExecutionState([uint32]"0x80000001") | Out-Null; while ($true) { Start-Sleep -Seconds 3600 }`
const WINDOWS_HOLDER = ['powershell.exe', '-NoProfile', '-Command', HOLD_ON_WINDOWS]
// Sleep only: an idle lock would also keep the screen on.
const SYSTEMD_HOLDER = ['systemd-inhibit', '--what=sleep', '--who=ship-epic', '--why=unattended run', 'sleep', 'infinity']

const HOLDERS: Record<Host, string[]> = {
  windows: WINDOWS_HOLDER,
  wsl: WINDOWS_HOLDER,
  'linux-desktop': SYSTEMD_HOLDER,
  'linux-headless': SYSTEMD_HOLDER,
  mac: ['caffeinate', '-i'],
}

export type WakeLock = {
  release(): void
  /** Called if the holder dies on its own, which ends the lock. */
  onLost(callback: () => void): void
}

export function holdAwake(): WakeLock {
  const [program, ...args] = HOLDERS[host]
  // Its own process group, so releasing it also ends the `sleep` systemd-inhibit runs.
  const ownGroup = process.platform !== 'win32'
  const holder = spawn(program, args, { stdio: 'ignore', windowsHide: true, detached: ownGroup })

  return {
    release() {
      try {
        if (ownGroup && holder.pid) process.kill(-holder.pid)
        else holder.kill()
      } catch {
        // Already gone.
      }
    },
    onLost(callback) {
      holder.on('exit', callback)
    },
  }
}

type ProcessInfo = { parentPid: number; commandLine: string }

// Under WSL the processes above this one are Linux processes, so only native Windows asks Windows.
function parentOf(pid: number): ProcessInfo {
  if (process.platform === 'win32') return parentOnWindows(pid)
  return parentOnUnix(pid)
}

function parentOnWindows(pid: number): ProcessInfo {
  const query = `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; "$($p.ParentProcessId)|$($p.CommandLine)"`
  const printed = execFileSync('powershell.exe', ['-NoProfile', '-Command', query], { encoding: 'utf8', windowsHide: true }).trim()
  const [parentPid, ...commandLine] = printed.split('|')
  return { parentPid: Number(parentPid), commandLine: commandLine.join('|') }
}

function parentOnUnix(pid: number): ProcessInfo {
  const printed = execFileSync('ps', ['-o', 'ppid=,args=', '-p', String(pid)], { encoding: 'utf8' }).trim()
  const match = /^(\d+)\s+(.*)$/.exec(printed)
  if (!match) return { parentPid: 0, commandLine: '' }
  return { parentPid: Number(match[1]), commandLine: match[2] }
}

const CLAUDE_COMMAND = /(^|[\\/\s])claude(\.exe)?(\s|$)|claude-code|@anthropic-ai/i

/** The nearest process above this one whose command line names claude, or 0 when there is none. */
export function findClaudeAncestor(maxDepth = 12): number {
  let pid = process.ppid
  for (let depth = 0; depth < maxDepth && pid > 1; depth++) {
    const { parentPid, commandLine } = parentOf(pid)
    if (CLAUDE_COMMAND.test(commandLine)) return pid
    pid = parentPid
  }
  return 0
}

export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: it exists, but belongs to another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
