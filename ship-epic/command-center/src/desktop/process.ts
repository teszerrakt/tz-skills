import { execFile, spawn } from 'node:child_process'

/** Starts a program that outlives this one, and ignores it from then on. */
export function launchDetached(command: string[], options: { cwd?: string } = {}): void {
  const [program, ...args] = command
  const child = spawn(program, args, { cwd: options.cwd, detached: true, stdio: 'ignore', windowsHide: true })
  child.on('error', () => {})
  child.unref()
}

/** A program's stdout, or null when it fails or runs too long. */
export function outputOf(
  command: string[],
  options: { env?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<string | null> {
  const [program, ...args] = command
  const execOptions = {
    env: options.env ?? process.env,
    timeout: options.timeoutMs ?? 20_000,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  }
  return new Promise((resolve) => {
    execFile(program, args, execOptions, (error, stdout) => resolve(error ? null : String(stdout)))
  })
}

export function commandExists(program: string): boolean {
  return Bun.which(program) !== null
}
