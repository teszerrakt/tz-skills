#!/usr/bin/env bun
// Saves a use_figma result to a file without the agent writing it out a second time. Claude Code logs every tool result
// to the session's transcript; this finds the newest use_figma call whose script starts with "// figma-map-tag: <tag>"
// (figma.ts --tag writes that line) and copies its result. Every recent transcript is searched and the newest result wins,
// so a tag an earlier run also used never returns that run's result.
//   bun scripts/save-result.ts --tag <tag> --out <file>
//   bun scripts/save-result.ts --tag <tag> --dump <fact-base>
// --dump splits a dump call's result into raw/<flow>.json per flow: a flow whose base the call returned starts afresh,
// one continued from an earlier call gets the new deltas appended.
// Transcripts are read from $CLAUDE_CONFIG_DIR/projects (default ~/.claude/projects), newest first.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { TAG_PREFIX } from './figma.ts'
import type { DumpResult, FlowDump } from './lib/types.ts'

/** Only transcripts touched this recently are searched: the call was made in this session. */
const RECENT_MS = 24 * 60 * 60 * 1000

type ContentBlock = {
  type: string
  id?: string
  name?: string
  input?: { code?: string; nodeId?: string }
  tool_use_id?: string
  content?: unknown
}
type TranscriptLine = { timestamp?: string; message?: { content?: unknown } }

export function transcriptRoot(env: Record<string, string | undefined> = process.env): string {
  return join(env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects')
}

/** Every .jsonl under the root changed in the last day, newest first. */
export function recentTranscripts(root: string, now = Date.now()): string[] {
  if (!existsSync(root)) return []
  const found: { path: string; mtime: number }[] = []
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.name.endsWith('.jsonl')) {
        const mtime = statSync(path).mtimeMs
        if (now - mtime < RECENT_MS) found.push({ path, mtime })
      }
    }
  }
  visit(root)
  return found.toSorted((a, b) => b.mtime - a.mtime).map((f) => f.path)
}

/** A transcript line's content blocks and when it was logged ("" when the line has no timestamp). */
export function blocksOf(line: string): { blocks: ContentBlock[]; at: string } {
  let parsed: TranscriptLine
  try {
    parsed = JSON.parse(line) as TranscriptLine
  } catch {
    return { blocks: [], at: '' }
  }
  const content = parsed.message?.content
  return { blocks: Array.isArray(content) ? (content as ContentBlock[]) : [], at: parsed.timestamp ?? '' }
}

export type Found = { text: string; at: string }

/** The newer of two finds; ISO timestamps compare as strings. */
export const newer = (a: Found | null, b: Found | null) => (!a ? b : !b ? a : b.at > a.at ? b : a)

export function resultText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part): part is { type: string; text: string } => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
}

/** The result of the newest tagged use_figma call in one transcript, or null when it has none. */
export function findTaggedResult(transcript: string, tag: string): Found | null {
  const tagLine = `${TAG_PREFIX}${tag}`
  if (!transcript.includes(tagLine)) return null
  let callId: string | null = null
  let result: Found | null = null
  for (const line of transcript.split('\n')) {
    const { blocks, at } = blocksOf(line)
    for (const block of blocks) {
      const isTaggedCall = block.type === 'tool_use' && block.input?.code?.split('\n', 1)[0] === tagLine
      // A transcript can log the same tool_use block again after its result; only a new call starts over.
      if (isTaggedCall && block.id && block.id !== callId) {
        callId = block.id
        result = null
      } else if (block.type === 'tool_result' && callId && block.tool_use_id === callId) {
        result = { text: resultText(block.content), at }
      }
    }
  }
  return result
}

/** Writes each flow of a dump call to raw/<flow>.json and returns one line per flow. */
export function saveDump(factBase: string, result: DumpResult): string[] {
  mkdirSync(join(factBase, 'raw'), { recursive: true })
  const lines: string[] = []
  for (const [slug, part] of Object.entries(result.flows)) {
    const file = join(factBase, 'raw', `${slug}.json`)
    let dump: FlowDump
    if (part.base) dump = { base: part.base, deltas: part.deltas }
    else if (existsSync(file)) {
      const existing = JSON.parse(readFileSync(file, 'utf8')) as FlowDump
      const known = new Set(existing.deltas.map((d) => d.id))
      dump = { base: existing.base, deltas: [...existing.deltas, ...part.deltas.filter((d) => !known.has(d.id))] }
    } else throw new Error(`raw/${slug}.json does not exist yet: save the call that holds the flow's first screen first`)
    writeFileSync(file, JSON.stringify(dump))
    lines.push(`raw/${slug}.json: ${dump.deltas.length + 1} screens`)
  }
  return lines
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function main(argv: string[]) {
  const tag = flag(argv, 'tag')
  const out = flag(argv, 'out')
  const factBase = flag(argv, 'dump')
  if (!tag || (!out && !factBase)) {
    console.error('usage: bun scripts/save-result.ts --tag <tag> --out <file> | --dump <fact-base>')
    process.exit(2)
  }

  let found: Found | null = null
  for (const path of recentTranscripts(transcriptRoot())) found = newer(found, findTaggedResult(readFileSync(path, 'utf8'), tag))
  if (found === null) fail(`no use_figma result tagged "${tag}" in ${transcriptRoot()}; save it by hand`)
  const text = found.text

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    fail(`the result tagged "${tag}" is not JSON, so the call likely failed:\n${text.slice(0, 400)}`)
  }

  if (factBase) {
    try {
      console.log(saveDump(factBase, value as DumpResult).join('\n'))
    } catch (error) {
      fail((error as Error).message)
    }
    return
  }
  mkdirSync(dirname(out!), { recursive: true })
  writeFileSync(out!, JSON.stringify(value))
  console.log(`${out}: ${statSync(out!).size} bytes from the call tagged "${tag}"`)
}

if (import.meta.main) main(process.argv.slice(2))
