#!/usr/bin/env bun
// Runs the eval cases of every skill this branch changes or affects, on the machine's own Claude login.
//   bun run evals                 cases for the skills changed since the merge base with origin/main
//   bun run evals --all           every case
//   bun run evals --base <ref>    diff against another ref
// Other flags pass through to `claude plugin eval` (e.g. --case <glob>, --runs 1).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { affected, loadPlugin } from './skills.ts'

const root = resolve(import.meta.dir, '..')
const args = process.argv.slice(2)
const all = take('--all')
const base = takeValue('--base') ?? 'origin/main'

function take(flag: string): boolean {
  const at = args.indexOf(flag)
  if (at >= 0) args.splice(at, 1)
  return at >= 0
}

function takeValue(flag: string): string | undefined {
  const at = args.indexOf(flag)
  if (at < 0) return undefined
  return args.splice(at, 2)[1]
}

function git(...command: string[]): string {
  const result = Bun.spawnSync(['git', ...command], { cwd: root })
  if (result.exitCode !== 0) throw new Error(`git ${command.join(' ')}: ${result.stderr.toString().trim()}`)
  return result.stdout.toString().trim()
}

export function caseTags(dir: string): Map<string, string[]> {
  const cases = new Map<string, string[]>()
  if (!existsSync(dir)) return cases
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'case.yaml')
    if (!existsSync(file)) continue
    const tags = readFileSync(file, 'utf8').match(/^tags:\s*\[([^\]]*)\]/m)?.[1] ?? ''
    cases.set(
      name,
      tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    )
  }
  return cases
}

if (import.meta.main) {
  const plugin = loadPlugin(root)
  const skills = all
    ? plugin.skills.map((s) => s.name)
    : affected(
        plugin,
        git('diff', '--name-only', `${git('merge-base', base, 'HEAD')}...HEAD`)
          .split('\n')
          .filter(Boolean),
      )
  const cases = [...caseTags(join(root, 'evals'))].filter(([, tags]) => tags.some((t) => skills.includes(t)))

  if (skills.length === 0 || cases.length === 0) {
    console.log(skills.length ? `No eval case covers ${skills.join(', ')}.` : 'No skill changed; no eval to run.')
    process.exit(0)
  }
  console.log(`Skills changed or affected: ${skills.join(', ')}`)
  console.log(`Cases: ${cases.map(([name]) => name).join(', ')}\n`)

  // --scaffold copies each case's fixture/ into its workspace; the scaffold scripts are this repo's own.
  const command = ['claude', 'plugin', 'eval', root, '--ablation', 'none', '--no-publish', '--trust-plugin', '--scaffold']
  // The default Haiku judge failed correct long answers; a flaky judge blocks a push as surely as a regression.
  command.push('--judge-model', 'sonnet', '--threshold', '1', '--concurrency', '4')
  command.push(...skills.flatMap((s) => ['--tag', s]), ...args)
  const run = Bun.spawnSync(command, { cwd: root, stdio: ['inherit', 'inherit', 'inherit'] })
  process.exit(run.exitCode ?? 1)
}
