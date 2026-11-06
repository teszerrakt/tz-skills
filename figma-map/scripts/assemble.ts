#!/usr/bin/env bun
// Joins the fact base's pieces into design-map.md, in reading order: banner.md, changed.md on a refresh, each flow's
// sections/<slug>.md in inventory order, then shared.md. Every piece numbers its own [n] from 1; this renumbers them
// in order of first appearance into one closing ## Sources block, merging identical source lines.
//   bun scripts/assemble.ts <fact-base>
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FlowInventory } from './lib/types.ts'

export type Piece = { name: string; text: string }

/** A piece's [n] → its source line, read from the piece's own ## Sources block. */
function localSources(sourcesBlock: string): Map<string, string> {
  const sources = new Map<string, string>()
  for (const match of sourcesBlock.matchAll(/^\[(\d+)\]\s+(.*)$/gm)) sources.set(match[1], match[2].trim())
  return sources
}

/** A citation [n], but not the text of a markdown link such as [3](url). */
const CITATION = /\[(\d+)\](?!\()/g

export function assemble(pieces: Piece[]): { markdown: string; sourceCount: number; problems: string[] } {
  const globalNumbers = new Map<string, number>()
  const problems: string[] = []
  const bodies: string[] = []

  for (const piece of pieces) {
    const [body, sourcesBlock = ''] = piece.text.split(/^## Sources\s*$/m)
    const sources = localSources(sourcesBlock)
    const renumbered = body.trimEnd().replace(CITATION, (citation, n: string) => {
      const line = sources.get(n)
      if (!line) {
        problems.push(`${piece.name}: [${n}] has no line in its Sources block`)
        return citation
      }
      if (!globalNumbers.has(line)) globalNumbers.set(line, globalNumbers.size + 1)
      return `[${globalNumbers.get(line)}]`
    })
    bodies.push(renumbered)
  }

  const sourceLines = [...globalNumbers].map(([line, n]) => `[${n}] ${line}`)
  const markdown = `${bodies.join('\n\n')}\n\n## Sources\n${sourceLines.join('\n')}\n`
  return { markdown, sourceCount: globalNumbers.size, problems }
}

function readPieces(factBase: string): { pieces: Piece[]; missing: string[] } {
  const inventory = JSON.parse(readFileSync(join(factBase, 'flows.json'), 'utf8')) as FlowInventory
  const names = ['banner.md', 'changed.md', ...inventory.flows.map((f) => `sections/${f.slug}.md`), 'shared.md']
  const optional = new Set(['changed.md', 'shared.md'])
  const pieces: Piece[] = []
  const missing: string[] = []
  for (const name of names) {
    const path = join(factBase, name)
    if (existsSync(path)) pieces.push({ name, text: readFileSync(path, 'utf8') })
    else if (!optional.has(name)) missing.push(name)
  }
  return { pieces, missing }
}

function main(argv: string[]) {
  const [factBase] = argv
  if (!factBase) {
    console.error('usage: bun scripts/assemble.ts <fact-base>')
    process.exit(2)
  }
  const { pieces, missing } = readPieces(factBase)
  const { markdown, sourceCount, problems } = assemble(pieces)
  writeFileSync(join(factBase, 'design-map.md'), markdown)
  const pages = (markdown.match(/^# Page:/gm) ?? []).length
  const words = markdown.split(/\s+/).filter(Boolean).length
  console.log(`design-map.md: ${pages} pages, ${sourceCount} sources, ${words} words`)
  for (const name of missing) console.log(`  missing ${name}`)
  for (const problem of problems) console.log(`  ${problem}`)
  if (missing.length || problems.length) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
