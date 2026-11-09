#!/usr/bin/env bun
// Prints the component index reuse verdicts are searched in: one line per file that exports a component, with the
// components it exports, grouped by folder. Read it once instead of listing and opening folders.
//   bun scripts/components.ts <repo root> <path> [<path> …]
// Paths are the config's `## Sources` paths, in order. Tests, stories and barrel files are left out.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SOURCE = /\.(tsx|ts|jsx|vue|svelte)$/
const SKIP = /\.(test|spec|stories)\.|^index\.|\.d\.ts$/

/** Exported names that start with a capital letter: components, not hooks, helpers or variant maps. */
export function exportedComponents(source: string): string[] {
  const names = new Set<string>()
  for (const m of source.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|let)\s+([A-Z]\w*)/g)) names.add(m[1])
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name && /^[A-Z]/.test(name) && !part.trim().startsWith('type ')) names.add(name)
    }
  }
  return [...names]
}

/** A folder's own files first, then its subfolders, so each folder heads one block. */
function files(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== 'node_modules' && !e.name.startsWith('.'))
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const own = entries.filter((e) => e.isFile() && SOURCE.test(e.name) && !SKIP.test(e.name)).map((e) => join(dir, e.name))
  return [...own, ...entries.filter((e) => e.isDirectory()).flatMap((e) => files(join(dir, e.name)))]
}

export function index(root: string, paths: string[]): string {
  const lines: string[] = []
  for (const path of paths) {
    let folder = ''
    for (const file of files(join(root, path))) {
      const names = exportedComponents(readFileSync(file, 'utf8'))
      if (names.length === 0) continue
      const rel = relative(root, file)
      const dir = rel.slice(0, rel.lastIndexOf('/') + 1)
      if (dir !== folder) lines.push(dir)
      folder = dir
      lines.push(`  ${rel.slice(dir.length)}: ${names.join(', ')}`)
    }
  }
  return lines.join('\n')
}

if (import.meta.main) {
  const [root, ...paths] = process.argv.slice(2)
  if (!root || paths.length === 0) {
    console.error('usage: bun scripts/components.ts <repo root> <path> [<path> …]')
    process.exit(2)
  }
  console.log(index(root, paths))
}
