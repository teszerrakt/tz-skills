#!/usr/bin/env bun
// Downloads get_screenshot images without the agent retyping their URLs: finds the newest get_screenshot result for
// each node id across recent transcripts and saves its image as <dir>/<name>.png.
//   bun scripts/shots.ts --dir <dir> <node id>=<name> [<node id>=<name> …]
// Run it outside the sandbox: inside it, Figma's CDN answers with an empty HTTP 202.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { blocksOf, recentTranscripts, resultText, transcriptRoot } from './save-result.ts'

export type Shot = { url: string; width: number; height: number; at: string }

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

/** node id → its newest screenshot in one transcript. */
export function findShots(transcript: string, nodeIds: Set<string>): Map<string, Shot> {
  const calls = new Map<string, string>()
  const shots = new Map<string, Shot>()
  for (const line of transcript.split('\n')) {
    if (!line.includes('get_screenshot') && !line.includes('image_url')) continue
    const { blocks, at } = blocksOf(line)
    for (const block of blocks) {
      const nodeId = block.input?.nodeId
      if (block.type === 'tool_use' && block.name?.endsWith('get_screenshot') && block.id && nodeId && nodeIds.has(nodeId)) {
        calls.set(block.id, nodeId)
      } else if (block.type === 'tool_result' && block.tool_use_id && calls.has(block.tool_use_id)) {
        const shot = parseShot(resultText(block.content), at)
        if (shot) shots.set(calls.get(block.tool_use_id)!, shot)
      }
    }
  }
  return shots
}

function parseShot(text: string, at: string): Shot | null {
  const json = text.match(/\{"image_url"[^}]*\}/)?.[0]
  if (!json) return null
  const { image_url: url, width, height } = JSON.parse(json) as { image_url: string; width: number; height: number }
  return { url, width, height, at }
}

export function parsePairs(args: string[]): Map<string, string> {
  const pairs = new Map<string, string>()
  for (const arg of args) {
    const at = arg.indexOf('=')
    if (at <= 0 || at === arg.length - 1) throw new Error(`"${arg}" is not <node id>=<name>`)
    pairs.set(arg.slice(0, at), arg.slice(at + 1).replace(/\.png$/, ''))
  }
  return pairs
}

async function main(argv: string[]) {
  const dirAt = argv.indexOf('--dir')
  const dir = dirAt >= 0 ? argv[dirAt + 1] : undefined
  const rest = argv.filter((_, i) => i !== dirAt && i !== dirAt + 1)
  if (!dir || rest.length === 0) {
    console.error('usage: bun scripts/shots.ts --dir <dir> <node id>=<name> [<node id>=<name> …]')
    process.exit(2)
  }
  const pairs = parsePairs(rest)
  const shots = new Map<string, Shot>()
  // The newest screenshot of a node wins: an older run's URL has expired.
  const wanted = new Set(pairs.keys())
  for (const path of recentTranscripts(transcriptRoot())) {
    for (const [id, shot] of findShots(readFileSync(path, 'utf8'), wanted)) {
      if (!shots.has(id) || shot.at > shots.get(id)!.at) shots.set(id, shot)
    }
  }
  mkdirSync(dir, { recursive: true })
  let failed = false
  for (const [id, name] of pairs) {
    const shot = shots.get(id)
    const file = join(dir, `${name}.png`)
    if (!shot) {
      console.log(`${name}.png: no get_screenshot result for ${id} in this session`)
      failed = true
      continue
    }
    const bytes = new Uint8Array(await (await fetch(shot.url)).arrayBuffer())
    if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) {
      console.log(`${name}.png: not a PNG (${bytes.length} bytes); run outside the sandbox`)
      failed = true
      continue
    }
    writeFileSync(file, bytes)
    console.log(`${name}.png ${shot.width}×${shot.height} ${Math.round(bytes.length / 1024)} KB`)
  }
  if (failed) process.exit(1)
}

if (import.meta.main) await main(process.argv.slice(2))
