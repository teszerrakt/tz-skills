#!/usr/bin/env bun
// Expands each flow's dump (base + deltas) into full per-screen records, groups the screens (one group per distinct
// layout, every other screen a state of its group's first screen), and prints the digest a section is written from.
//   bun scripts/merge.ts <fact-base> <flow-slug> [<flow-slug> …]
//       reads raw/<slug>.json; writes frames/<id>.json, merge/<slug>.json, merge/<slug>.md and signatures/<slug>.json
//   bun scripts/merge.ts --changed <fact-base> <flow-slug> <sigs.json>
//       compares a sigOnly dump with signatures/<slug>.json and prints what changed
// Signatures are kept per flow so parallel harvesters never write the same file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clickKey, countedKey } from './lib/keys.ts'
import { bareOutline } from './lib/outline.ts'
import { applyTextDelta } from './lib/text-diff.ts'
import type {
  Annotation,
  Click,
  FlowDump,
  FlowInventory,
  LayoutGroup,
  LayoutMember,
  MemberKind,
  MissingScreen,
  Outline,
  ScreenDelta,
  ScreenRecord,
  SetDiff,
  SharedCandidate,
  SharedName,
  SignatureChanges,
  Signatures,
} from './lib/types.ts'

const isMissing = (delta: ScreenDelta | MissingScreen): delta is MissingScreen => 'error' in delta

/** Rebuilds every screen of a flow in full from its dump. */
export function expand(dump: FlowDump): ScreenRecord[] {
  const { base } = dump
  const records: ScreenRecord[] = [{ ...base, outlineFrom: base.id }]
  const byId = new Map(records.map((r) => [r.id, r]))
  for (const delta of dump.deltas) {
    if (isMissing(delta)) continue
    const ref = delta.ref ? byId.get(delta.ref) : records[0]
    if (!ref) throw new Error(`${delta.id} is a difference from ${delta.ref}, which this flow's dump does not hold`)
    const removed = new Set(delta.instances.del)
    // An instance shared with the base keeps the base's id: the screen's own id needs locate.ts.
    const shared = ref.instances.filter((i) => !removed.has(i.key)).map((i) => ({ ...i, id: null, ...(i.id ? { baseId: i.id } : {}) }))
    const droppedClicks = new Set(delta.clicks.del)
    let outline: Outline = delta.outline as Outline
    let outlineFrom = delta.id
    if (delta.outline === 'same') [outline, outlineFrom] = [base.outline, base.id]
    else if (typeof delta.outline === 'string') {
      const earlier = byId.get(delta.outline.slice('sameAs:'.length))
      if (!earlier) throw new Error(`${delta.id} points at ${delta.outline}, which this flow's dump does not hold`)
      ;[outline, outlineFrom] = [earlier.outline, earlier.outlineFrom]
    }
    const record: ScreenRecord = {
      id: delta.id,
      name: delta.name,
      h: delta.h,
      sig: delta.sig,
      texts: applyTextDelta(ref.texts, delta.texts),
      annotations: delta.annotations,
      clicks: [...ref.clicks.filter((c) => !droppedClicks.has(clickKey(c))), ...delta.clicks.add],
      instances: [...shared, ...delta.instances.add.map((i) => ({ ...i, id: null }))],
      outline,
      outlineFrom,
    }
    records.push(record)
    byId.set(record.id, record)
  }
  return records
}

function setDiff(from: string[], to: string[]): SetDiff {
  const fromSet = new Set(from)
  const toSet = new Set(to)
  return { add: to.filter((x) => !fromSet.has(x)), del: from.filter((x) => !toSet.has(x)) }
}

const isEmpty = (diff: SetDiff) => diff.add.length === 0 && diff.del.length === 0
const instanceKeys = (record: ScreenRecord) => record.instances.map(countedKey)

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

/** Node id → the orchestrator's name for it, from candidates.json and shared-names.json. */
export function sharedNodeNames(candidates: SharedCandidate[], names: SharedName[]): Map<string, string> {
  const byNode = new Map<string, string>()
  for (const { name, signature, shape } of names) {
    const candidate = candidates.find((c) => c.signature === signature)
    const shapes = candidate ? (shape === undefined ? candidate.shapes : [candidate.shapes[shape]]) : []
    for (const s of shapes) for (const id of s?.ids ?? []) byNode.set(id, name)
  }
  return byNode
}

const quote = (texts: string[]) => texts.map((t) => `"${t}"`).join(' ')

function nodeLabel(label: string, shared: Map<string, string>): string {
  const at = label.lastIndexOf('#')
  const id = label.slice(at + 1)
  const name = shared.get(id)
  return `${label.slice(0, at)} ${id}${name ? ` = ${name} (shared)` : ''}`
}

/** One line per container; a container whose children are all leaves lists them on its own line. */
function outlineLines(outline: Outline, shared: Map<string, string>, depth = 1): string[] {
  const lines: string[] = []
  for (const node of outline) {
    const [label, kids] = typeof node === 'string' ? [node, []] : Object.entries(node)[0]
    const indent = '  '.repeat(depth)
    if (kids.length && kids.every((k) => typeof k === 'string')) {
      lines.push(`${indent}${nodeLabel(label, shared)}: ${(kids as string[]).map((k) => nodeLabel(k, shared)).join(', ')}`)
    } else {
      lines.push(`${indent}${nodeLabel(label, shared)}`, ...outlineLines(kids, shared, depth + 1))
    }
  }
  return lines
}

type OutlineEntry = [label: string, kids: Outline]
const entryOf = (node: Outline[number]): OutlineEntry => (typeof node === 'string' ? [node, []] : (Object.entries(node)[0] as OutlineEntry))
const nameOf = (label: string) => label.slice(0, label.lastIndexOf('#'))
const idsIn = (outline: Outline): string[] =>
  JSON.stringify(outline)
    .match(/#[^"]+(?=")/g)
    ?.map((m) => m.slice(1)) ?? []

/**
 * A later layout's outline, against the first layout's: a container whose subtree matches the first layout's at the
 * same place and holds no shared component is left out, since only its node ids differ.
 */
function changedOutlineLines(outline: Outline, first: Outline, shared: Map<string, string>, depth = 1): string[] {
  const lines: string[] = []
  outline.forEach((node, i) => {
    const [label, kids] = entryOf(node)
    const twin = first[i] === undefined ? undefined : entryOf(first[i])
    const sameName = twin !== undefined && nameOf(twin[0]) === nameOf(label)
    if (sameName && bareOutline([node]) === bareOutline([first[i]]) && !idsIn([node]).some((id) => shared.has(id))) return
    if (!sameName) return lines.push(...outlineLines([node], shared, depth))
    lines.push(`${'  '.repeat(depth)}${nodeLabel(label, shared)}`, ...changedOutlineLines(kids, twin[1], shared, depth + 1))
  })
  return lines
}

/** "Button: Type=Primary, State=Disabled @Bar" → "Button: Primary, Disabled @Bar": the values say enough. */
const shortKey = (key: string) => key.replace(/[\w ?]+=/g, (m) => (m.startsWith(' ') ? ' ' : ''))

const clickLine = (c: Click) => `click ${c.on} "${c.text}" ${c.node} → ${c.to ?? 'nowhere'}`
const noteLine = (a: Annotation) => `annotation on ${a.on} ${a.node} within ${a.within}: "${a.label}"`

/** What `next` changes from `from`: texts, instances, and the clicks and annotations `from` lacks. */
function difference(from: ScreenRecord, next: ScreenRecord): string[] {
  const texts = setDiff(from.texts, next.texts)
  const instances = setDiff(instanceKeys(from), instanceKeys(next))
  const parts: string[] = []
  if (texts.add.length) parts.push(`+${quote(texts.add)}`)
  if (texts.del.length) parts.push(`−${quote(texts.del)}`)
  if (instances.add.length) parts.push(`+instances ${instances.add.map(shortKey).join('; ')}`)
  if (instances.del.length) parts.push(`−instances ${instances.del.map(shortKey).join('; ')}`)
  const clicks = new Set(from.clicks.map(clickKey))
  parts.push(...next.clicks.filter((c) => !clicks.has(clickKey(c))).map(clickLine))
  const notes = new Set(from.annotations.map((a) => a.label))
  parts.push(...next.annotations.filter((a) => !notes.has(a.label)).map(noteLine))
  return parts
}

/**
 * The flow as the harvester reads it. The first layout is printed in full; every later layout and every state is
 * printed as what it changes from the screen before it, so nothing the reader has seen is printed twice.
 */
export function digest(
  slug: string,
  records: ScreenRecord[],
  groups: LayoutGroup[],
  pages: Map<string, string | null>,
  shared: Map<string, string>,
): string {
  const byId = new Map(records.map((r) => [r.id, r]))
  const page = (id: string) => pages.get(id) ?? '(no page label)'
  const states = groups.reduce((n, g) => n + g.members.length, 0)
  const out = [`# ${slug}: ${records.length} screens → ${groups.length} layouts, ${states} states`]
  const first = byId.get(groups[0].rep)!
  groups.forEach((g, i) => {
    const rep = byId.get(g.rep)!
    out.push('', `## Layout ${i + 1}: ${rep.id} "${rep.name}", page "${page(rep.id)}"`)
    if (rep.outlineFrom !== rep.id) out.push(`node ids below are from ${rep.outlineFrom}; locate them for this screen`)
    if (i === 0) {
      out.push('outline:', ...outlineLines(rep.outline, shared))
      out.push(`texts: ${quote(rep.texts)}`)
      if (rep.instances.length) out.push(`instances: ${instanceKeys(rep).map(shortKey).join('; ')}`)
      out.push(...rep.annotations.map(noteLine), ...rep.clicks.map(clickLine))
    } else {
      out.push(
        'outline, where it differs from layout 1 or names a shared component:',
        ...changedOutlineLines(rep.outline, first.outline, shared),
      )
      out.push(`changes from layout 1 (${first.id}): ${difference(first, rep).join(' · ') || 'none'}`)
    }
    let previous = rep
    for (const m of g.members) {
      const record = byId.get(m.id)!
      const changes = difference(previous, record)
      out.push(`- ${m.id} "${record.name}", page "${page(m.id)}", from ${previous.id}: ${changes.join(' · ') || 'same content'}`)
      previous = record
    }
    if (g.identicalPairs.length) out.push(`same content, compare their images: ${g.identicalPairs.map(([a, b]) => `${a}=${b}`).join(', ')}`)
  })
  return out.join('\n')
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 1))
}

const frameFile = (id: string) => `${id.replace(':', '-')}.json`

/** Writes the flow's records, groups, digest and signatures, and returns the digest. */
export function mergeFlow(factBase: string, slug: string): string {
  const dump = JSON.parse(readFileSync(join(factBase, 'raw', `${slug}.json`), 'utf8')) as FlowDump
  const records = expand(dump)
  for (const dir of ['frames', 'merge', 'signatures']) mkdirSync(join(factBase, dir), { recursive: true })
  for (const record of records) writeJson(join(factBase, 'frames', frameFile(record.id)), record)

  const groups = group(records)
  writeJson(join(factBase, 'merge', `${slug}.json`), groups)
  writeJson(join(factBase, 'signatures', `${slug}.json`), Object.fromEntries(records.map((r) => [r.id, r.sig])))

  const inventory = readJson<FlowInventory | null>(join(factBase, 'flows.json'), null)
  const pages = new Map(inventory?.flows.flatMap((f) => f.screens.map((s) => [s.id, s.page] as const)) ?? [])
  const shared = sharedNodeNames(
    readJson<SharedCandidate[]>(join(factBase, 'candidates.json'), []),
    readJson<SharedName[]>(join(factBase, 'shared-names.json'), []),
  )
  const text = digest(slug, records, groups, pages, shared)
  writeFileSync(join(factBase, 'merge', `${slug}.md`), text)
  return text
}

function main(argv: string[]) {
  if (argv[0] === '--changed') {
    const [factBase, slug, sigsFile] = argv.slice(1)
    const previous = readJson<Signatures>(join(factBase, 'signatures', `${slug}.json`), {})
    const current = readJson<Record<string, Signatures>>(sigsFile, {})[slug] ?? {}
    const result = changed(previous, current)
    console.log(JSON.stringify({ ...result, same: result.same.length }))
    return
  }
  const [factBase, ...slugs] = argv
  if (!factBase || slugs.length === 0) {
    console.error(
      'usage: bun scripts/merge.ts <fact-base> <flow-slug> [<flow-slug> …] | bun scripts/merge.ts --changed <fact-base> <flow-slug> <sigs.json>',
    )
    process.exit(2)
  }
  for (const slug of slugs) {
    if (!existsSync(join(factBase, 'raw', `${slug}.json`))) {
      console.error(`no raw/${slug}.json in ${factBase}`)
      process.exit(1)
    }
  }
  console.log(slugs.map((slug) => mergeFlow(factBase, slug)).join('\n\n'))
}

if (import.meta.main) main(process.argv.slice(2))
