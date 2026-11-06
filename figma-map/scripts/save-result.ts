#!/usr/bin/env bun
// Saves a use_figma result to a file without the agent writing it out a second time. Claude Code logs every tool result
// to the session's transcript; this finds the newest use_figma call whose script starts with "// figma-map-tag: <tag>"
// (figma.ts --tag writes that line) and copies its result.
//   bun scripts/save-result.ts --tag <tag> --out <file> [--append-deltas]
// --append-deltas adds a dump chunk's deltas to the flow dump already in <file>, for a flow dumped in several calls.
// Transcripts are read from $CLAUDE_CONFIG_DIR/projects (default ~/.claude/projects), newest first.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { TAG_PREFIX } from './figma.ts'
import type { FlowDump } from './lib/types.ts'

/** Only transcripts touched this recently are searched: the call was made in this session. */
const RECENT_MS = 24 * 60 * 60 * 1000

type ContentBlock = { type: string; id?: string; name?: string; input?: { code?: string }; tool_use_id?: string; content?: unknown }
type TranscriptLine = { message?: { content?: unknown } }

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

function blocksOf(line: string): ContentBlock[] {
  let parsed: TranscriptLine
  try {
    parsed = JSON.parse(line) as TranscriptLine
  } catch {
    return []
  }
  const content = parsed.message?.content
  return Array.isArray(content) ? (content as ContentBlock[]) : []
}

function resultText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part): part is { type: string; text: string } => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
}

/** The result of the newest tagged use_figma call in one transcript, or null when it has none. */
export function findTaggedResult(transcript: string, tag: string): string | null {
  const tagLine = `${TAG_PREFIX}${tag}`
  if (!transcript.includes(tagLine)) return null
  let callId: string | null = null
  let result: string | null = null
  for (const line of transcript.split('\n')) {
    for (const block of blocksOf(line)) {
      const isTaggedCall = block.type === 'tool_use' && block.input?.code?.split('\n', 1)[0] === tagLine
      if (isTaggedCall && block.id) {
        callId = block.id
        result = null
      } else if (block.type === 'tool_result' && callId && block.tool_use_id === callId) {
        result = resultText(block.content)
      }
    }
  }
  return result
}

/** Adds a later chunk's deltas to a flow dump; a screen already present keeps its first reading. */
export function appendDeltas(existing: FlowDump, chunk: FlowDump): FlowDump {
  if (existing.base.id !== chunk.base.id) throw new Error(`chunk base ${chunk.base.id} is not the flow's base ${existing.base.id}`)
  const known = new Set(existing.deltas.map((d) => d.id))
  return { base: existing.base, deltas: [...existing.deltas, ...chunk.deltas.filter((d) => !known.has(d.id))] }
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
  if (!tag || !out) {
    console.error('usage: bun scripts/save-result.ts --tag <tag> --out <file> [--append-deltas]')
    process.exit(2)
  }

  let text: string | null = null
  for (const path of recentTranscripts(transcriptRoot())) {
    text = findTaggedResult(readFileSync(path, 'utf8'), tag)
    if (text !== null) break
  }
  if (text === null) fail(`no use_figma result tagged "${tag}" in ${transcriptRoot()}; save it by hand`)

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    fail(`the result tagged "${tag}" is not JSON, so the call likely failed:\n${text.slice(0, 400)}`)
  }

  if (argv.includes('--append-deltas') && existsSync(out)) {
    value = appendDeltas(JSON.parse(readFileSync(out, 'utf8')) as FlowDump, value as FlowDump)
  }
  writeFileSync(out, JSON.stringify(value))
  console.log(`${out}: ${statSync(out).size} bytes from the call tagged "${tag}"`)
}

if (import.meta.main) main(process.argv.slice(2))
