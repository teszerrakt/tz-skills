#!/usr/bin/env bun
// Expands one flow's dump (base + deltas) into full per-screen records, then groups the screens: one group per
// distinct layout, every other screen a state of its group's first screen.
//   bun scripts/merge.ts <fact-base> <flow-slug>
//       reads raw/<slug>.json; writes frames/<id>.json, merge/<slug>.json and signatures/<slug>.json
//   bun scripts/merge.ts --changed <fact-base> <flow-slug> <sigs.json>
//       compares a sigOnly dump with signatures/<slug>.json and prints what changed
// Signatures are kept per flow so parallel harvesters never write the same file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bareOutline } from './lib/outline.ts'
import { applyTextDelta } from './lib/text-diff.ts'
import type {
  FlowDump,
  LayoutGroup,
  LayoutMember,
  MemberKind,
  MissingScreen,
  ScreenDelta,
  ScreenRecord,
  SetDiff,
  SignatureChanges,
  Signatures,
} from './lib/types.ts'

const isMissing = (delta: ScreenDelta | MissingScreen): delta is MissingScreen => 'error' in delta

/** Rebuilds every screen of a flow in full from its dump. */
export function expand(dump: FlowDump): ScreenRecord[] {
  const { base } = dump
  const records: ScreenRecord[] = [{ ...base, outlineFrom: base.id }]
  for (const delta of dump.deltas) {
    if (isMissing(delta)) continue
    const removed = new Set(delta.instances.del)
    // An instance shared with the base keeps the base's id: the screen's own id needs locate.ts.
    const shared = base.instances.filter((i) => !removed.has(i.key)).map((i) => ({ key: i.key, id: null, baseId: i.id }))
    records.push({
      id: delta.id,
      name: delta.name,
      h: delta.h,
      sig: delta.sig,
      texts: applyTextDelta(base.texts, delta.texts),
      annotations: delta.annotations,
      clicks: delta.clicks,
      instances: [...shared, ...delta.instances.add],
      outline: delta.outline === 'same' ? base.outline : delta.outline,
      outlineFrom: delta.outline === 'same' ? base.id : delta.id,
    })
  }
  return records
}

function setDiff(from: string[], to: string[]): SetDiff {
  const fromSet = new Set(from)
  const toSet = new Set(to)
  return { add: to.filter((x) => !fromSet.has(x)), del: from.filter((x) => !toSet.has(x)) }
}

const isEmpty = (diff: SetDiff) => diff.add.length === 0 && diff.del.length === 0
const instanceKeys = (record: ScreenRecord) => record.instances.map((i) => i.key)

/** Texts and instances in a canonical order: two screens with the same content compare equal. */
function contentKey(record: ScreenRecord): string {
  return JSON.stringify([record.texts.toSorted(), instanceKeys(record).toSorted()])
}

function describeMember(rep: ScreenRecord, record: ScreenRecord): LayoutMember {
  const texts = setDiff(rep.texts, record.texts)
  const instances = setDiff(instanceKeys(rep), instanceKeys(record))
  let kind: MemberKind = 'state'
  if (isEmpty(texts) && isEmpty(instances)) kind = 'identical'
  else if (isEmpty(texts)) kind = 'variant'
  return { id: record.id, kind, texts, instances }
}

/** Every pair of screens in the layout with the same content, not only pairs with the first screen. */
function identicalPairs(records: ScreenRecord[]): [string, string][] {
  const pairs: [string, string][] = []
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      if (contentKey(records[i]) === contentKey(records[j])) pairs.push([records[i].id, records[j].id])
    }
  }
  return pairs
}

/** One group per distinct outline, ids ignored. */
export function group(records: ScreenRecord[]): LayoutGroup[] {
  const layouts = new Map<string, ScreenRecord[]>()
  for (const record of records) {
    const key = bareOutline(record.outline)
    layouts.set(key, [...(layouts.get(key) ?? []), record])
  }
  return [...layouts.values()].map((list) => {
    const [rep, ...rest] = list
    return { rep: rep.id, members: rest.map((r) => describeMember(rep, r)), identicalPairs: identicalPairs(list) }
  })
}

export function changed(previous: Signatures, current: Signatures): SignatureChanges {
  const out: SignatureChanges = { changed: [], added: [], removed: [], same: [] }
  for (const id of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (!(id in previous)) out.added.push(id)
    else if (!(id in current)) out.removed.push(id)
    else if (previous[id] !== current[id]) out.changed.push(id)
    else out.same.push(id)
  }
  return out
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 1))
}

const frameFile = (id: string) => `${id.replace(':', '-')}.json`

/** Writes the flow's records, groups and signatures, and returns the line to print. */
export function mergeFlow(factBase: string, slug: string): string {
  const dump = JSON.parse(readFileSync(join(factBase, 'raw', `${slug}.json`), 'utf8')) as FlowDump
  const records = expand(dump)
  for (const dir of ['frames', 'merge', 'signatures']) mkdirSync(join(factBase, dir), { recursive: true })
  for (const record of records) writeJson(join(factBase, 'frames', frameFile(record.id)), record)

  const groups = group(records)
  writeJson(join(factBase, 'merge', `${slug}.json`), groups)
  writeJson(join(factBase, 'signatures', `${slug}.json`), Object.fromEntries(records.map((r) => [r.id, r.sig])))

  const states = groups.reduce((n, g) => n + g.members.length, 0)
  const pairs = groups.flatMap((g) => g.identicalPairs.map(([a, b]) => `${a}=${b}`))
  const look = pairs.length ? `; same content, compare their images: ${pairs.join(', ')}` : ''
  return `${records.length} screens → ${groups.length} layouts, ${states} states${look}`
}

function main(argv: string[]) {
  if (argv[0] === '--changed') {
    const [factBase, slug, sigsFile] = argv.slice(1)
    const previous = readJson<Signatures>(join(factBase, 'signatures', `${slug}.json`), {})
    const result = changed(previous, readJson<Signatures>(sigsFile, {}))
    console.log(JSON.stringify({ ...result, same: result.same.length }))
    return
  }
  const [factBase, slug] = argv
  if (!factBase || !slug) {
    console.error(
      'usage: bun scripts/merge.ts <fact-base> <flow-slug> | bun scripts/merge.ts --changed <fact-base> <flow-slug> <sigs.json>',
    )
    process.exit(2)
  }
  if (!existsSync(join(factBase, 'raw', `${slug}.json`))) {
    console.error(`no raw/${slug}.json in ${factBase}`)
    process.exit(1)
  }
  console.log(mergeFlow(factBase, slug))
}

if (import.meta.main) main(process.argv.slice(2))
