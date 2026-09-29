#!/usr/bin/env node
// Keeps the machine awake, never the display, until the given pid exits.
//   node wake-lock.mjs [--pid N] [--hours 12]
// Without --pid it holds for the nearest ancestor whose command line names claude.
// Windows, WSL (through powershell.exe), macOS and Linux.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined }
const hours = Number(arg('hours') || 12)
const wsl = process.platform === 'linux' && /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8'))

function parentOf(pid) {
  if (process.platform === 'win32') {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; "$($p.ParentProcessId)|$($p.CommandLine)"`], { encoding: 'utf8', windowsHide: true }).trim()
    const [ppid, ...cmd] = out.split('|')
    return [Number(ppid), cmd.join('|')]
  }
  const out = execFileSync('ps', ['-o', 'ppid=,args=', '-p', String(pid)], { encoding: 'utf8' }).trim()
  const m = /^(\d+)\s+(.*)$/.exec(out)
  return m ? [Number(m[1]), m[2]] : [0, '']
}

function findClaude() {
  let pid = process.ppid
  for (let i = 0; i < 12 && pid > 1; i++) {
    const [ppid, cmd] = parentOf(pid)
    if (/(^|[\\/\s])claude(\.exe)?(\s|$)|claude-code|@anthropic-ai/i.test(cmd)) return pid
    pid = ppid
  }
  return 0
}

const pid = Number(arg('pid')) || findClaude()
if (!pid) {
  console.error('wake-lock: no claude process above this one; pass --pid')
  process.exit(1)
}

// ES_CONTINUOUS | ES_SYSTEM_REQUIRED, never ES_DISPLAY_REQUIRED: the screen still sleeps on its own plan.
const HOLD_WIN = `Add-Type -Name P -Namespace W -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'; [W.P]::SetThreadExecutionState([uint32]"0x80000001") | Out-Null; while ($true) { Start-Sleep -Seconds 3600 }`
const holder = process.platform === 'win32' || wsl
  ? spawn('powershell.exe', ['-NoProfile', '-Command', HOLD_WIN], { stdio: 'ignore', windowsHide: true })
  : process.platform === 'darwin'
    ? spawn('caffeinate', ['-i', '-w', String(pid)], { stdio: 'ignore' })
    : spawn('systemd-inhibit', ['--what=idle:sleep', '--who=ship-epic', '--why=unattended run', 'sleep', 'infinity'], { stdio: 'ignore' })

const alive = (p) => { try { process.kill(p, 0); return true } catch (e) { return e.code === 'EPERM' } }
const end = (why) => { holder.kill(); console.log(`wake-lock: released (${why})`); process.exit(0) }
holder.on('exit', () => process.exit(0))
console.log(`wake-lock: held for pid ${pid}, at most ${hours} h`)
setInterval(() => { if (!alive(pid)) end(`pid ${pid} exited`) }, 15_000)
setTimeout(() => end(`${hours} h cap`), hours * 3_600_000)
