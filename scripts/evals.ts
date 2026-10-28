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

type Grader = { passed: boolean; explanation?: string }
type Arm = { passed: boolean; error?: string | null; graders?: Grader[] }
type Result = { cases: { name: string; arms: Record<string, Arm[]> }[] }

// The error a run or its judge gets when the Claude login is out of quota, e.g. "You've hit your 5-hour limit · resets 12:10pm".
const QUOTA = /hit your [\w-]+ limit/i

// A run fails on quota when the run itself was refused, or every grader it failed was.
function refused(r: Arm): boolean {
  if (r.error) return QUOTA.test(r.error)
  const failed = (r.graders ?? []).filter((g) => !g.passed)
  return failed.length > 0 && failed.every((g) => QUOTA.test(g.explanation ?? ''))
}

/** The cases that failed only because the login ran out of quota, or undefined when any failure is a real one. */
export function quotaOnly(result: Result): string[] | undefined {
  const failed = result.cases.filter((c) => Object.values(c.arms).some((runs) => runs.some((r) => !r.passed)))
  const real = failed.some((c) => Object.values(c.arms).some((runs) => runs.some((r) => !r.passed && !refused(r))))
  return failed.length && !real ? failed.map((c) => c.name) : undefined
}

function latestResult(since: Date): Result | undefined {
  const dir = join(root, 'evals', 'results')
  if (!existsSync(dir)) return undefined
  const file = join(dir, readdirSync(dir).toSorted().at(-1) ?? '', 'aggregate-result.json')
  if (!existsSync(file)) return undefined
  const result = JSON.parse(readFileSync(file, 'utf8'))
  return new Date(result.startedAt) >= since ? result : undefined
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
  const started = new Date()
  const run = Bun.spawnSync(command, { cwd: root, stdio: ['inherit', 'inherit', 'inherit'] })
  const result = run.exitCode === 0 ? undefined : latestResult(started)
  const skipped = result && quotaOnly(result)
  if (skipped) {
    // Lint and unit tests already passed; an empty quota says nothing about the skills.
    console.warn(`\n⚠ Out of Claude quota: ${skipped.join(', ')} did not run. Run \`bun run evals\` once it resets.`)
    process.exit(0)
  }
  process.exit(run.exitCode ?? 1)
}
