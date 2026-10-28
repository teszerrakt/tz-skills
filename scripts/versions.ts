#!/usr/bin/env bun
// Fails when a plugin's shipped files changed since the base but its version did not go up.
// `claude plugin update` compares versions only, so a change under the same version never reaches an install.
//   bun scripts/versions.ts                 against the merge base with origin/main
//   bun scripts/versions.ts --base <ref>    against another ref
import { existsSync, readFileSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'

export type Shipped = { name: string; manifest: string; paths: string[] }

const MARKETPLACE = '.claude-plugin/marketplace.json'

/** Each plugin in the marketplace, with its manifest and the paths an install copies from it. */
export function shipped(root: string): Shipped[] {
  const marketplace = JSON.parse(readFileSync(join(root, MARKETPLACE), 'utf8')) as { plugins: { name: string; source: string }[] }
  return marketplace.plugins.map(({ name, source }) => {
    const dir = normalize(source).replace(/\/$/, '')
    const manifest = join(dir, '.claude-plugin/plugin.json')
    const skills = (JSON.parse(readFileSync(join(root, manifest), 'utf8')) as { skills?: string[] }).skills
    // A plugin rooted at the repo lists its skills; every other file there is tooling, not what it ships.
    const paths = dir === '.' ? [...(skills ?? []).map((s) => normalize(s).replace(/\/$/, '')), 'agents'] : [dir]
    return { name, manifest, paths }
  })
}

/** The plugins whose shipped files changed while their version stayed put or went down. */
export function unbumped(
  plugins: Shipped[],
  changed: string[],
  before: (manifest: string) => string | undefined,
  after: (manifest: string) => string,
): string[] {
  return plugins
    .filter((p) => changed.some((file) => p.paths.some((path) => file === path || file.startsWith(`${path}/`))))
    .filter((p) => {
      const was = before(p.manifest)
      return was !== undefined && Bun.semver.order(after(p.manifest), was) <= 0
    })
    .map((p) => p.name)
}

function git(root: string, ...command: string[]): { ok: boolean; out: string } {
  const result = Bun.spawnSync(['git', ...command], { cwd: root })
  return { ok: result.exitCode === 0, out: result.stdout.toString().trim() }
}

const version = (json: string) => (JSON.parse(json) as { version: string }).version

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const args = process.argv.slice(2)
  const at = args.indexOf('--base')
  const base = git(root, 'merge-base', at >= 0 ? args[at + 1] : 'origin/main', 'HEAD')
  if (!base.ok) throw new Error('No merge base with the base ref; fetch it first (CI needs fetch-depth: 0).')

  const plugins = shipped(root)
  const changed = git(root, 'diff', '--name-only', `${base.out}...HEAD`).out.split('\n').filter(Boolean)
  const before = (manifest: string) => {
    const shown = git(root, 'show', `${base.out}:${manifest}`)
    return shown.ok ? version(shown.out) : undefined
  }
  const after = (manifest: string) => version(readFileSync(join(root, manifest), 'utf8'))
  const problems = unbumped(plugins, changed, before, after).map(
    (name) =>
      `${name}: its files changed but its version did not go up; bump "version" in ${plugins.find((p) => p.name === name)?.manifest}`,
  )

  const own = plugins.find((p) => p.paths.includes('agents'))
  const pkg = version(readFileSync(join(root, 'package.json'), 'utf8'))
  if (own && existsSync(join(root, own.manifest)) && after(own.manifest) !== pkg) {
    problems.push(`package.json is ${pkg} but ${own.manifest} is ${after(own.manifest)}; keep them equal`)
  }

  for (const problem of problems) console.error(`ERROR  ${problem}`)
  if (problems.length) process.exit(1)
  console.log('Plugin versions OK.')
}
