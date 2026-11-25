#!/usr/bin/env bun
// Renders design-map.md (shape: references/doc-shape.md) to the page the Artifact tool publishes: a contents rail,
// then the pages top to bottom, each component with its parts nested under it, then Shared components, the Decision
// list and the Question list. Codes (P1, P1.2, S3) are computed here, never written in the markdown. No doctype or
// <head>: the Artifact tool adds those.
//   bun scripts/render.ts <fact-base> <in.md> <out.html> --file <figma file key> --gh <github blob base>/<sha>
//                         [--inline] [--images <map.json>] [--title <section name>]
// --inline builds each crop into the page as a data: URI. --images maps an image path (img/crops/x.png) to an
// uploaded URL instead, for a page whose crops would pass the Artifact size limit.
// Prints the bytes written and every warning; exits 1 when there is any warning.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { slugify } from './lib/names.ts'
import { CHECK, CROP_VIEWER, PAGE_SCRIPT, pageHead, railShell, reviewStrip } from './lib/page.ts'
import type { SourceLine } from './lib/types.ts'

export type RenderOptions = {
  factBase: string
  fileKey: string
  githubBase: string
  /** Image path in the markdown → URL to use instead. */
  images?: Record<string, string>
  inline?: boolean
  /** The section's name: the page's heading, and its tab title with " Map" added. */
  title?: string
}

export type Rendered = { html: string; warnings: string[] }

/** Status tag → its colour class. Settled shares Revised's green and Open shares Not drawn's grey, as the legend says. */
export const STATUSES: Record<string, { cls: string; legend: string }> = {
  New: { cls: 'tg-new', legend: 'added in revision' },
  Revised: { cls: 'tg-rev', legend: 'changed in revision' },
  Settled: { cls: 'tg-rev', legend: 'answered' },
  Conflict: { cls: 'tg-con', legend: 'Figma vs grooming' },
  'Not drawn': { cls: 'tg-nd', legend: 'missing in Figma' },
  Open: { cls: 'tg-nd', legend: 'still unanswered' },
}

const BLOCK_LABELS = ['Interaction', 'Copy', 'Notes'] as const
type BlockLabel = (typeof BLOCK_LABELS)[number]

const NODE = /\{((?:I?\d+[:-]\d+)(?:;\d+[:-]\d+)*)\}/g
/** Only the six names are tags; any other {word} is copy, such as a "{bank description}" placeholder. */
const STATUS = /\{(New|Revised|Settled|Conflict|Not drawn|Open)\}/g
const CITATION = /\[(\d+)\](?!\()/g
const MAX_ID = 180

type Bullet = { text: string; children: Bullet[] }
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'img'; text: string }
  | { kind: 'list'; items: Bullet[] }
  | { kind: 'rules'; items: Bullet[] }
  | { kind: 'table'; rows: string[][] }
type Variant = { name: string; node?: string; status?: string; images: string[]; blocks: Record<BlockLabel, Bullet[]> }
type Kind = 'header' | 'page' | 'component' | 'part' | 'shared-root' | 'shared' | 'decisions' | 'questions' | 'changed'
type Item = {
  kind: Kind
  name: string
  node?: string
  badge?: string
  status?: string
  refs: string[]
  shared?: { anchor: string; variant?: string }
  blocks: Block[]
  variants: Variant[]
  children: Item[]
  id: string
  code: string
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The component's name, before its badge, marker or "(shared)": the part an anchor is built from. */
export function componentName(heading: string): string {
  return heading.split(/\s*(?:🟢|🟡|🔴|\(|\{|—|→)/u)[0].trim()
}

/** A page's anchor is its whole name, so "Edit workflow — add threshold" and "Edit workflow — reorder" stay apart. */
export function anchorFor(heading: string): string {
  const withoutRefs = heading.replace(/\[\d+\]|\{[^}]*\}/g, '')
  if (withoutRefs.startsWith('Page:')) return slugify(withoutRefs.replace(/^Page:\s*/, ''))
  return slugify(componentName(withoutRefs))
}

export function parseSources(block: string): Map<string, SourceLine> {
  const sources = new Map<string, SourceLine>()
  for (const match of block.matchAll(/^\[(\d+)\]\s+(\S+)(?:\s+—\s+(.*))?$/gm)) {
    sources.set(match[1], { n: Number(match[1]), url: match[2], label: match[3] ?? match[2] })
  }
  return sources
}

const newItem = (kind: Kind, name = ''): Item => ({ kind, name, refs: [], blocks: [], variants: [], children: [], id: '', code: '' })

/** A heading's markers come off into fields: `## Side panel → [shared](#side-panel) — variant "Empty" {1:2} {New} [3]`. */
function parseHeading(kind: Kind, text: string): Item {
  const item = newItem(kind)
  let rest = text
  for (const m of rest.matchAll(NODE)) item.node ??= m[1]
  rest = rest.replace(NODE, '')
  for (const m of rest.matchAll(STATUS)) item.status = m[1]
  rest = rest.replace(STATUS, '')
  item.refs = [...rest.matchAll(CITATION)].map((m) => m[1])
  rest = rest.replace(CITATION, '')
  const shared = rest.match(/→\s*\[shared\]\(#([^)\s]+)\)(?:\s*—\s*(?:variant|state)\s+"([^"]+)")?/)
  if (shared) {
    item.shared = { anchor: shared[1], variant: shared[2] }
    rest = rest.replace(shared[0], '')
  }
  const badge = rest.match(/(?:🟢|🟡|🔴).*$/u)
  if (badge) {
    item.badge = badge[0].trim()
    rest = rest.slice(0, badge.index)
  }
  item.name = rest
    .replace(/^Page:\s*/, '')
    .replace(/\s*\(shared[^)]*\)/i, '')
    .trim()
  return item
}

/** Consecutive bullet lines → a tree; an indent of two spaces is one level. */
function bulletTree(lines: { depth: number; text: string }[]): Bullet[] {
  const roots: Bullet[] = []
  const stack: Bullet[] = []
  for (const line of lines) {
    const depth = Math.min(line.depth, stack.length)
    const bullet: Bullet = { text: line.text, children: [] }
    stack.length = depth
    if (depth === 0) roots.push(bullet)
    else stack[depth - 1].children.push(bullet)
    stack.push(bullet)
  }
  return roots
}

type Doc = { header: Item; pages: Item[]; shared?: Item; decisions?: Item; questions?: Item; changed?: Item }

class Parser {
  readonly doc: Doc = { header: newItem('header'), pages: [] }
  private item: Item = this.doc.header
  private variant: Variant | null = null
  private bullets: { depth: number; text: string }[] = []
  private table: string[][] | null = null
  private topLevel: Item | null = null
  private component: Item | null = null

  constructor(private readonly warn: (w: string) => void) {}

  private flushBullets() {
    if (!this.bullets.length) return
    const tree = bulletTree(this.bullets)
    this.bullets = []
    if (this.variant) return this.variantBullets(this.variant, tree)
    for (const bullet of tree) {
      const last = this.item.blocks.at(-1)
      if (/^Rules:?$/i.test(bullet.text)) this.item.blocks.push({ kind: 'rules', items: bullet.children })
      else if (last?.kind === 'list') last.items.push(bullet)
      else this.item.blocks.push({ kind: 'list', items: [bullet] })
    }
  }

  private variantBullets(variant: Variant, tree: Bullet[]) {
    for (const bullet of tree) {
      const m = bullet.text.match(/^(Interaction|Copy|Notes)\s*:?\s*(.*)$/i)
      if (!m) {
        this.warn(`variant "${variant.name}": bullet "${bullet.text}" is not under Interaction, Copy or Notes`)
        continue
      }
      const label = BLOCK_LABELS.find((l) => l.toLowerCase() === m[1].toLowerCase()) as BlockLabel
      if (m[2]) variant.blocks[label].push({ text: m[2], children: [] })
      variant.blocks[label].push(...bullet.children)
    }
  }

  private flushTable() {
    if (!this.table) return
    if (this.variant) this.warn(`variant "${this.variant.name}" holds a table; write its rows as variant blocks`)
    else this.item.blocks.push({ kind: 'table', rows: this.table })
    this.table = null
  }

  private flush() {
    this.flushBullets()
    this.flushTable()
  }

  private heading(level: number, text: string) {
    this.flush()
    this.variant = null
    if (level === 1) return this.topHeading(text)
    if (level === 4) return this.variantHeading(text)
    const top = this.topLevel
    const parent = level === 2 ? top : this.component
    const kind: Kind = top?.kind === 'shared-root' ? 'shared' : level === 2 ? 'component' : 'part'
    if (!parent || !(parent.kind === 'page' || parent.kind === 'shared-root' || parent.kind === 'component' || parent.kind === 'shared')) {
      this.warn(`"${'#'.repeat(level)} ${text}" has no ${level === 2 ? 'page or Shared components' : 'component'} heading above it`)
      return
    }
    const item = parseHeading(kind, text)
    parent.children.push(item)
    this.item = item
    if (level === 2) this.component = item
  }

  private topHeading(text: string) {
    this.component = null
    let item: Item
    if (text.startsWith('Page:')) {
      item = parseHeading('page', text)
      this.doc.pages.push(item)
    } else if (/^Shared components$/i.test(text)) item = this.doc.shared = newItem('shared-root', 'Shared components')
    else if (/^Decisions?( list)?$/i.test(text)) item = this.doc.decisions = newItem('decisions', 'Decision list')
    else if (/^Questions?( list)?$/i.test(text)) item = this.doc.questions = newItem('questions', 'Question list')
    else if (/^Changed since\b/i.test(text)) item = this.doc.changed = newItem('changed', text)
    else {
      this.warn(`"# ${text}" is not a page, Shared components, Decisions, Questions or Changed since heading`)
      item = newItem('changed', text)
    }
    this.topLevel = item
    this.item = item
  }

  private variantHeading(text: string) {
    const item = this.item
    if (!['page', 'component', 'part', 'shared'].includes(item.kind)) {
      this.warn(`variant "${text}" sits outside a page or component`)
      return
    }
    const head = parseHeading('part', text)
    if (/^(States|Variants)$/i.test(head.name)) this.warn(`"#### ${text}" is the old table shape; write one "#### <variant>" block per row`)
    const name = [head.name, ...head.refs.map((n) => `[${n}]`)].join(' ')
    this.variant = { name, node: head.node, status: head.status, images: [], blocks: { Interaction: [], Copy: [], Notes: [] } }
    item.variants.push(this.variant)
  }

  addLine(line: string) {
    if (line.startsWith('|')) {
      this.flushBullets()
      const cells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
      if (!cells.every((c) => /^:?-+:?$/.test(c))) (this.table ??= []).push(cells)
      return
    }
    this.flushTable()
    const heading = line.match(/^(#{1,4}) (.*)/)
    const bullet = line.match(/^( *)[-*] (.*)/)
    if (heading) return this.heading(heading[1].length, heading[2].trim())
    if (bullet) return void this.bullets.push({ depth: Math.floor(bullet[1].length / 2), text: bullet[2].trim() })
    if (!line.trim()) return
    if (/^\s+!\[/.test(line) && this.bullets.length) {
      this.bullets[this.bullets.length - 1].text += ` ${line.trim()}`
      return
    }
    this.flushBullets()
    const text = line.trim()
    const kind = /^!\[[^\]]*\]\([^)]+\)$/.test(text) ? 'img' : 'p'
    if (!this.variant) return void this.item.blocks.push({ kind, text: text.replace(/^>\s*/, '') })
    if (kind === 'img') this.variant.images.push(text)
    else this.warn(`variant "${this.variant.name}": "${text}" is not under Interaction, Copy or Notes`)
  }

  finish(): Doc {
    this.flush()
    return this.doc
  }
}

const shortId = (id: string) => id.slice(0, MAX_ID).replace(/-+$/, '')

/** P-codes per page, component and part (a single-page map drops the page level); S-codes for shared components. */
function number(doc: Doc) {
  const multi = doc.pages.length > 1
  doc.pages.forEach((page, i) => {
    page.id = `page-${slugify(page.name)}`
    page.code = multi ? `P${i + 1}` : ''
    page.children.forEach((component, j) => {
      component.id = shortId(`${page.id}--${slugify(component.name)}`)
      component.code = multi ? `P${i + 1}.${j + 1}` : `P${j + 1}`
      component.children.forEach((part, k) => {
        part.id = shortId(`${component.id}--${slugify(part.name)}`)
        part.code = `${component.code}.${k + 1}`
      })
    })
  })
  doc.shared?.children.forEach((shared, j) => {
    shared.id = anchorFor(shared.name)
    shared.code = `S${j + 1}`
    shared.children.forEach((part, k) => {
      part.id = shortId(`${shared.id}--${slugify(part.name)}`)
      part.code = `${shared.code}.${k + 1}`
    })
  })
  if (doc.shared) doc.shared.id = 'shared'
  if (doc.decisions) doc.decisions.id = 'decisions'
  if (doc.questions) doc.questions.id = 'questions'
  if (doc.changed) doc.changed.id = 'changed'
}

class Emitter {
  readonly warnings = new Set<string>()
  private readonly anchors = new Set<string>()
  private readonly anchorLinks = new Set<string>()
  private readonly sharedCodes = new Map<string, string>()
  private readonly usedStatuses = new Set<string>()
  private usedBadges = false
  private readonly reviewIds: string[] = []

  constructor(
    private readonly options: RenderOptions,
    private readonly sources: Map<string, SourceLine>,
    private readonly doc: Doc,
  ) {
    for (const shared of doc.shared?.children ?? []) this.sharedCodes.set(shared.id, shared.code)
  }

  private figmaUrl(nodeId: string) {
    return `https://www.figma.com/design/${this.options.fileKey}/?node-id=${nodeId.replace(/:/g, '-')}`
  }

  private imageSource(path: string): string {
    const mapped = this.options.images?.[path]
    if (mapped) return mapped
    if (/^(https?:|data:)/.test(path)) return path
    const file = path.startsWith('/') ? path : join(this.options.factBase, path)
    if (!existsSync(file)) {
      this.warnings.add(`image ${path} is not on disk`)
      return file
    }
    if (!this.options.inline) return file
    return `data:image/png;base64,${readFileSync(file).toString('base64')}`
  }

  private reference(n: string): string {
    const source = this.sources.get(n)
    if (!source) {
      this.warnings.add(`[${n}] has no Sources line`)
      return `[${n}]`
    }
    return `<a class="cite" href="${source.url}">[${n}]</a>`
  }

  tag(status: string): string {
    this.usedStatuses.add(status)
    return `<span class="tg ${STATUSES[status].cls}">${escapeHtml(status)}</span>`
  }

  /** One line of markdown text → HTML: images, links, [n] references, {node} markers, {Status} tags, bold and code. */
  inline(text: string): string {
    let html = escapeHtml(text).replace(/\bGH\//g, `${this.options.githubBase}/`)
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, path) => `<img class="shot" loading="lazy" src="${this.imageSource(path)}" alt="${alt}">`,
    )
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
      if (!href.startsWith('#')) return `<a href="${href}">${label}</a>`
      const anchor = href.slice(1)
      this.anchorLinks.add(anchor)
      return `<a href="${href}">${label === 'shared' ? (this.sharedCodes.get(anchor) ?? label) : label}</a>`
    })
    html = html.replace(/\[(\d+)\](?![^<]*<\/a>)/g, (_, n) => this.reference(n))
    html = html.replace(NODE, (_, id) => `<a class="fig" href="${this.figmaUrl(id)}">Figma ↗</a>`)
    html = html.replace(STATUS, (_, status: string) => this.tag(status))
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    return html.replace(/`([^`]+)`/g, '<code>$1</code>')
  }

  private list(items: Bullet[], cls = ''): string {
    const li = (b: Bullet): string => `<li>${this.inline(b.text)}${b.children.length ? this.list(b.children) : ''}</li>`
    return `<ul${cls ? ` class="${cls}"` : ''}>${items.map(li).join('')}</ul>`
  }

  private rules(rules: Bullet[]): string {
    const split = rules.map((r) => {
      const m = r.text.match(/^\{(New|Revised|Settled|Conflict|Not drawn|Open)\}\s*(.*)$/)
      return m ? { status: m[1], rule: { ...r, text: m[2] } } : { status: '', rule: r }
    })
    const tagged = split.some((r) => r.status)
    const rows = split.map(({ status, rule }) => {
      const tagCell = tagged ? `<td style="width:104px">${status ? this.tag(status) : ''}</td>` : ''
      return `<tr>${tagCell}<td>${this.inline(rule.text)}${rule.children.length ? this.list(rule.children) : ''}</td></tr>`
    })
    return `<table class="k">${rows.join('')}</table>`
  }

  /** Rows on a grid: a `#` column keeps its own track, every other cell stacks beside it on a narrow column. */
  private table(rows: string[][]): string {
    const [head, ...body] = rows
    const col = (i: number) => (head[i] ?? '').toLowerCase()
    const cls = (i: number) => (col(i) === '#' ? 'n' : col(i) === 'status' ? 'st' : 'c')
    const tracks = head.map((_, i) => (cls(i) === 'n' ? '48px' : cls(i) === 'st' ? '100px' : 'minmax(0, 1fr)'))
    const narrow = cls(0) === 'n' ? '48px minmax(0, 1fr)' : 'minmax(0, 1fr)'
    const cell = (c: string, i: number) => {
      if (cls(i) === 'st' && STATUSES[c]) return `<div class="st">${this.tag(c)}</div>`
      return `<div class="${cls(i)}">${this.inline(c)}</div>`
    }
    const headHtml = `<div class="row head" aria-hidden="true">${head.map((c, i) => `<div class="${cls(i)}">${this.inline(c)}</div>`).join('')}</div>`
    const bodyHtml = body.map((r) => `<div class="row">${r.map(cell).join('')}</div>`).join('')
    return `<div class="rows" style="--narrow:${narrow};--wide:${tracks.join(' ')}">${headHtml}${bodyHtml}</div>`
  }

  private blocks(item: Item, pClass: 'p' | 'pp'): string {
    return item.blocks
      .map((b) => {
        if (b.kind === 'p') return `<p class="${pClass}">${this.inline(b.text)}</p>`
        if (b.kind === 'img') return `<div class="crop">${this.inline(b.text)}</div>`
        if (b.kind === 'rules') return this.rules(b.items)
        if (b.kind === 'list') return this.list(b.items, 'items')
        return this.table(b.rows)
      })
      .join('')
  }

  /** Badge, status, shared use, sources and the Figma link, on one line under the item's text. */
  private metaLine(item: Item): string {
    const parts: string[] = []
    if (item.badge) {
      this.usedBadges = true
      parts.push(this.inline(item.badge))
    }
    if (item.status) parts.push(this.tag(item.status))
    if (item.shared) {
      const { anchor, variant } = item.shared
      this.anchorLinks.add(anchor)
      const code = this.sharedCodes.get(anchor) ?? anchor
      parts.push(`Shared component${variant ? `, variant “${escapeHtml(variant)}”` : ''} · <a href="#${anchor}">variants in ${code} →</a>`)
    }
    if (item.refs.length) parts.push(`Sources ${item.refs.map((n) => this.reference(n)).join(' ')}`)
    if (item.node) parts.push(`<a href="${this.figmaUrl(item.node)}">Figma ↗</a>`)
    return parts.length ? `<p class="shared-link">${parts.join(' · ')}</p>` : ''
  }

  /** One card per variant: name, status and Figma link on top; the crop beside Interaction, Copy and Notes. */
  private variants(variants: Variant[]): string {
    if (!variants.length) return ''
    const cards = variants.map((v) => {
      const link = v.node ? `<a class="fig" href="${this.figmaUrl(v.node)}">Figma ↗</a>` : ''
      const crops = v.images.map((i) => this.inline(i)).join('')
      const details = BLOCK_LABELS.map((label) =>
        v.blocks[label].length
          ? `<div class="blk ${label === 'Interaction' ? 'ix' : label.toLowerCase()}"><div class="lab">${label}</div>${this.list(v.blocks[label])}</div>`
          : '',
      ).join('')
      const head = `<div class="v-head"><span class="vname">${this.inline(v.name)}</span>${v.status ? this.tag(v.status) : ''}${link}</div>`
      const body = crops
        ? `<div class="v-body"><div>${crops}</div><div>${details}</div></div>`
        : `<div class="v-body no-shot"><div>${details}</div></div>`
      return `<article class="variant">${head}${body}</article>`
    })
    return `<div class="variants">${cards.join('')}</div>`
  }

  private anchor(id: string) {
    if (this.anchors.has(id)) this.warnings.add(`two headings share the anchor #${id}`)
    this.anchors.add(id)
  }

  private reviewable(id: string, label: string): string {
    this.anchor(id)
    this.reviewIds.push(id)
    return reviewStrip(id, label)
  }

  /** depth 0: a section with a kicker and h2; 1: a part with an h3; 2: a sub-part with an h4. */
  private item(item: Item, depth: number): string {
    const strip = this.reviewable(item.id, item.code)
    const name = this.inline(item.name)
    const body = `${this.blocks(item, depth === 0 ? 'p' : 'pp')}${this.metaLine(item)}${this.variants(item.variants)}`
    const children = item.children.map((c) => this.item(c, depth + 1)).join('')
    if (depth === 0)
      return `<section class="sec" id="${item.id}" data-comment-target><div class="kick">${item.code}</div><h2 class="h2">${name}</h2>${strip}${body}${children}</section>`
    const h = depth === 1 ? 'h3' : 'h4'
    return `<div class="part${depth > 1 ? ' sub' : ''}" id="${item.id}" data-comment-target><${h} class="${h}"><span class="code">${item.code}</span>${name}</${h}>${strip}${body}${children}</div>`
  }

  private refSection(item: Item, kick: string, intro: string, inner: string, review: boolean): string {
    const strip = review ? this.reviewable(item.id, item.name) : (this.anchor(item.id), '')
    const target = review ? ' data-comment-target' : ''
    return `<section class="ref" id="${item.id}"${target}><div class="kick">${kick}</div><h2 class="h2">${this.inline(item.name)}</h2>${strip}${intro}${inner}</section>`
  }

  private header(): string {
    const lede = this.doc.header.blocks.flatMap((b) => (b.kind === 'p' || b.kind === 'img' ? [b.text] : []))
    const meta = this.doc.header.blocks.flatMap((b) => (b.kind === 'list' ? b.items : []))
    const title = escapeHtml(this.options.title ?? 'Design map')
    return `<header class="head"><div class="kick">Design map</div><h1 class="title">${title}</h1>${lede.map((t) => `<p class="lede">${this.inline(t)}</p>`).join('')}${
      meta.length ? `<div class="meta">${meta.map((m) => `<span>${this.inline(m.text)}</span>`).join('')}</div>` : ''
    }<p class="notice" id="notice" hidden></p></header>`
  }

  private content(): string {
    const doc = this.doc
    const multi = doc.pages.length > 1
    let html = this.header()
    if (doc.changed) html += this.refSection(doc.changed, 'Refresh', '', this.blocks(doc.changed, 'pp'), false)
    for (const page of doc.pages) {
      if (multi) html += this.item(page, 0)
      else {
        this.anchor(page.id)
        const intro = `${this.blocks(page, 'p')}${this.metaLine(page)}${this.variants(page.variants)}`
        html += `<div class="intro" id="${page.id}">${intro}</div>${page.children.map((c) => this.item(c, 0)).join('')}`
      }
    }
    if (doc.shared) {
      const intro = doc.shared.blocks.length
        ? this.blocks(doc.shared, 'p')
        : '<p class="p">Used in more than one place. Each is built once; the sections above name the variant they use.</p>'
      html += this.refSection(doc.shared, 'Reference', intro, doc.shared.children.map((c) => this.item(c, 1)).join(''), false)
    }
    for (const list of [doc.decisions, doc.questions]) {
      if (!list) continue
      const prefix = list.kind === 'decisions' ? 'D' : 'Q'
      for (const block of list.blocks) {
        if (block.kind !== 'table') continue
        for (const row of block.rows.slice(1)) {
          if (!new RegExp(`^${prefix}\\d+$`).test(row[0] ?? ''))
            this.warnings.add(`${list.name} row "${row.join(' | ')}" does not start with a ${prefix}<n> code`)
        }
      }
      html += this.refSection(list, 'Reference', '', this.blocks(list, 'p'), true)
    }
    if (this.sources.size) {
      const items = [...this.sources.values()].map((s) => `<li value="${s.n}"><a href="${s.url}">${escapeHtml(s.label)}</a></li>`)
      html += `<section class="ref" id="sources"><div class="kick">Reference</div><h2 class="h2">Sources</h2><ol class="src">${items.join('')}</ol></section>`
    }
    return html
  }

  private rail(): string {
    const doc = this.doc
    const multi = doc.pages.length > 1
    const dot = `<span class="dot">${CHECK}</span>`
    const link = (item: Item, cls: string) =>
      `<a class="${cls}" data-nav="${item.id}" href="#${item.id}">${dot}<span>${item.code ? `${item.code} ` : ''}${escapeHtml(item.name)}</span></a>`
    let html = `<div class="kick">${multi ? 'Pages' : 'Page'}</div>`
    for (const page of doc.pages) {
      if (multi) html += link(page, 'rl')
      for (const c of page.children) {
        html += link(c, multi ? 'rs' : 'rl')
        for (const p of c.children) html += link(p, multi ? 'rs rs2' : 'rs')
      }
    }
    if (doc.shared || doc.decisions || doc.questions) html += `<div class="kick rail-group">Reference</div>`
    if (doc.shared) {
      html += `<a class="rl" href="#shared"><span class="dot"></span><span>S Shared components</span></a>`
      for (const s of doc.shared.children) {
        html += link(s, 'rs')
        for (const p of s.children) html += link(p, 'rs rs2')
      }
    }
    if (doc.decisions) html += link({ ...doc.decisions, code: 'D' }, 'rl')
    if (doc.questions) html += link({ ...doc.questions, code: 'Q' }, 'rl')
    const legend = Object.entries(STATUSES)
      .filter(([s]) => this.usedStatuses.has(s))
      .map(([s, { cls, legend: meaning }]) => `<div><span class="tg ${cls}">${s}</span> ${meaning}</div>`)
    if (this.usedBadges) legend.push('<div>🟢 reuse · 🟡 extend · 🔴 new</div>')
    if (legend.length) html += `<div class="legend">${legend.join('')}</div>`
    return html
  }

  finish(): Rendered {
    const content = this.content()
    const rail = this.rail()
    for (const link of this.anchorLinks) if (!this.anchors.has(link)) this.warnings.add(`a link points at #${link}, which no heading has`)
    const title = this.options.title ? `${this.options.title} Map` : 'Design map'
    const shell = railShell(this.options.title ?? 'Design map', rail, this.reviewIds.length)
    const html = `${pageHead(title)}<div class="wrap">${shell}<main id="main">${content}</main></div>\n${CROP_VIEWER}${PAGE_SCRIPT}`
    return { html, warnings: [...this.warnings] }
  }
}

export function render(markdown: string, options: RenderOptions): Rendered {
  const [body, sourcesBlock = ''] = markdown.split(/^## Sources\s*$/m)
  const parseWarnings: string[] = []
  const parser = new Parser((w) => parseWarnings.push(w))
  for (const line of body.split(/\r?\n/)) parser.addLine(line)
  const doc = parser.finish()
  number(doc)
  const emitter = new Emitter(options, parseSources(sourcesBlock), doc)
  const { html, warnings } = emitter.finish()
  return { html, warnings: [...new Set([...parseWarnings, ...warnings])] }
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}

function main(argv: string[]) {
  const [factBase, input, output] = argv
  const fileKey = flag(argv, 'file')
  const githubBase = flag(argv, 'gh')
  if (!factBase || !input || !output || !fileKey || !githubBase) {
    console.error(
      'usage: bun scripts/render.ts <fact-base> <in.md> <out.html> --file <figma file key> --gh <github blob base>/<sha> [--inline] [--images <map.json>] [--title <section name>]',
    )
    process.exit(2)
  }
  const imagesFile = flag(argv, 'images')
  const images = imagesFile ? (JSON.parse(readFileSync(imagesFile, 'utf8')) as Record<string, string>) : undefined
  const { html, warnings } = render(readFileSync(input, 'utf8'), {
    factBase,
    fileKey,
    githubBase,
    images,
    inline: argv.includes('--inline'),
    title: flag(argv, 'title'),
  })
  writeFileSync(output, html)
  console.log(`${output}: ${html.length} bytes, ${warnings.length} warnings`)
  for (const warning of warnings) console.log(`  ${warning}`)
  if (warnings.length) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
