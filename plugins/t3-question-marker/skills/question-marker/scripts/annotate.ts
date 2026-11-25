#!/usr/bin/env bun
// Builds the annotated image that goes under a question: crops of a frame, the part that matters outlined and
// labelled, panels titled A/B/C, and the competing rules written beside them.
//   bun annotate.ts <spec.json> <out.png>
// A spec is one node; image paths resolve against the spec's folder.
//   {"image": "a.png", "crop": [x0,y0,x1,y1], "scale": 0.5, "extend": {"right": 220}, "marks": [<mark>…]}
//   {"panel": "A · Bulk bar", "of": <node>, "note": "Handover D-301: Reconcile only", "color": "red"}
//   {"text": ["line", "line"], "title": "RFC-024 RBR-3", "color": "blue", "width": 560}
//   {"stack": [<node>…], "dir": "row", "gap": 24}
// A mark: {"box": [x0,y0,x1,y1], "label": "Undo per row", "color": "red", "dashed": true, "text": "Sep 2026 ▾"}.
//   Boxes and "extend" are in the crop's own pixels, before scale; "extend" adds white room for a box outside the frame.
//   "dashed" outlines a thing Figma does not draw, and "text" writes its placeholder inside the box.
// Colours: red, blue, green, amber, grey, ink, or a #hex. Transparent PNGs are flattened onto white.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { OverlayOptions, Sharp } from 'sharp'

const HERE = import.meta.dir

/**
 * An installed plugin ships without node_modules: install sharp beside this script on the first run, then run again.
 * A process that started with no node_modules stays on Bun's auto-install, whose sharp hangs drawing text.
 */
function ensureSharp() {
  for (let dir = HERE; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules/sharp/package.json'))) return
    if (dirname(dir) === dir) break
  }
  if (process.env.ANNOTATE_INSTALLED) throw new Error(`bun install in ${HERE} did not leave node_modules/sharp there`)
  const install = Bun.spawnSync(['bun', 'install', '--frozen-lockfile'], { cwd: HERE, stdout: 'ignore', stderr: 'inherit' })
  if (install.exitCode !== 0) throw new Error(`bun install failed in ${HERE}`)
  if (!import.meta.main) throw new Error('sharp was just installed; start the process again')
  const env = { ...process.env, ANNOTATE_INSTALLED: '1' }
  process.exit(Bun.spawnSync([process.execPath, ...process.argv.slice(1)], { env, stdio: ['inherit', 'inherit', 'inherit'] }).exitCode ?? 1)
}
ensureSharp()
const { default: sharp } = await import('sharp')

export type Pic = { png: Buffer; width: number; height: number; scale?: number }
export type Box = [number, number, number, number]
export type Mark = { box: Box; label?: string; color?: string; dashed?: boolean; text?: string }
type Extend = { top?: number; right?: number; bottom?: number; left?: number }

export const COLORS: Record<string, string> = {
  red: '#dc2626',
  blue: '#1d3f9e',
  green: '#1a7f37',
  amber: '#d97706',
  grey: '#5a5a5a',
  ink: '#242424',
}
const FONT = 'DejaVu Sans,Inter,Helvetica,Arial'
const PAPER = '#f8f9fc'
const BADGE_H = 28
const GAP = 8

const color = (c = 'red') => COLORS[c] ?? (/^#[0-9a-f]{3,8}$/i.test(c) ? c : COLORS.red)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function pic(input: Sharp, scale?: number): Promise<Pic> {
  const { data, info } = await input.png().toBuffer({ resolveWithObject: true })
  return { png: data, width: info.width, height: info.height, scale }
}

const blank = (width: number, height: number, background = '#ffffff') =>
  sharp({ create: { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), channels: 4, background } })

/** Text measured by Pango, so a box or panel can be sized to it. Wraps at `width` when given. */
export async function text(s: string, o: { size?: number; bold?: boolean; color?: string; width?: number } = {}): Promise<Pic> {
  const body = s.trim() ? esc(s) : ' '
  const markup = `<span foreground="${color(o.color ?? 'ink')}"${o.bold ? ' font_weight="bold"' : ''}>${body}</span>`
  const width = o.width ? Math.max(1, Math.floor(o.width)) : undefined
  return pic(sharp({ text: { text: markup, font: `${FONT} ${o.size ?? 20}`, rgba: true, dpi: 72, width, wrap: 'word', spacing: 6 } }))
}

/** A PNG flattened onto white (transparent corners otherwise turn black), cropped to `crop`, then scaled. */
export async function load(path: string, o: { crop?: Box; scale?: number } = {}): Promise<Pic> {
  let out = await pic(sharp(path).flatten({ background: '#ffffff' }))
  if (o.crop) {
    const [x0, y0, x1, y1] = o.crop.map(Math.round)
    const left = Math.max(0, x0)
    const top = Math.max(0, y0)
    const width = Math.min(out.width, x1) - left
    const height = Math.min(out.height, y1) - top
    if (width <= 0 || height <= 0) throw new Error(`crop ${JSON.stringify(o.crop)} misses ${path} (${out.width}×${out.height})`)
    out = await pic(sharp(out.png).extract({ left, top, width, height }))
  }
  const scale = o.scale ?? 1
  if (scale === 1) return out
  return pic(sharp(out.png).resize(Math.round(out.width * scale), Math.round(out.height * scale), { kernel: 'lanczos3' }), scale)
}

type Placed = { x: number; y: number; side: 'top' | 'bottom'; row: number }
const band = (rows: number) => (rows ? rows * (BADGE_H + GAP) + GAP : 0)

/**
 * Badges go in a band above or below the image, never over it, each on the side nearer its box and as close to the
 * box's left edge as the badges already placed allow. Returns positions relative to the image's top-left corner.
 */
export function placeBadges(
  width: number,
  height: number,
  items: { box: Box; w: number }[],
): { at: Placed[]; top: number; bottom: number; width: number } {
  const canvas = Math.max(width, ...items.map((i) => i.w))
  const rows: Record<Placed['side'], number[]> = { top: [], bottom: [] }
  const at: Placed[] = []
  const order = items.map((item, i) => ({ item, i })).toSorted((a, b) => a.item.box[0] - b.item.box[0])
  for (const { item, i } of order) {
    const side = (item.box[1] + item.box[3]) / 2 < height / 2 ? 'top' : 'bottom'
    const want = Math.min(Math.max(0, item.box[0]), canvas - item.w)
    let row = rows[side].findIndex((right) => Math.max(want, right + GAP) + item.w <= canvas)
    if (row < 0) {
      row = rows[side].length
      rows[side].push(-GAP)
    }
    const x = Math.max(want, rows[side][row] + GAP)
    rows[side][row] = x + item.w
    const offset = (row + 1) * (BADGE_H + GAP)
    at[i] = { x, y: side === 'top' ? -offset : height + offset - BADGE_H, side, row }
  }
  return { at, top: band(rows.top.length), bottom: band(rows.bottom.length), width: canvas }
}

/**
 * The line from a badge to its box. It drops to the gap between the badges and the image, runs along it, then drops to
 * the box, so a line from an outer row never crosses a badge in an inner row and never reads as that badge's.
 */
export function leader(badge: Box, box: Box, side: Placed['side'], height: number, width: number, inner: Box[]): [number, number][] {
  const [bx0, by0, bx1, by1] = badge
  const [x0, y0, x1, y1] = box
  const target = x1 - x0 > 16 ? Math.min(Math.max((bx0 + bx1) / 2, x0 + 8), x1 - 8) : (x0 + x1) / 2
  const free = (x: number) => inner.every(([a, , b]) => x < a - 4 || x > b + 4)
  const near = (lo: number, hi: number) =>
    Array.from({ length: Math.max(1, Math.floor(hi - lo)) }, (_, k) => lo + k)
      .filter(free)
      .toSorted((a, b) => Math.abs(a - target) - Math.abs(b - target))[0]
  const gap = side === 'top' ? -GAP / 2 : height + GAP / 2
  const edge = side === 'top' ? by1 : by0
  const tx = x1 - x0 > 16 ? Math.min(Math.max(target, x0 + 8), x1 - 8) : target
  const to: [number, number][] = [
    [tx, gap],
    [tx, side === 'top' ? y0 : y1],
  ]
  const under = near(bx0 + 6, bx1 - 6)
  if (under !== undefined) return [[under, edge], [under, gap], ...to]
  // Every point under the badge is covered: leave from its side, at mid-height, to the nearest open column.
  const out = near(4, width - 4) ?? bx1 + 6
  const side0 = out < bx0 ? bx0 : bx1
  const mid = (by0 + by1) / 2
  return [[side0, mid], [out, mid], [out, gap], ...to]
}

/** Outlines (solid, or dashed for "not drawn"), placeholder text and badges on one image. */
export async function annotate(base: Pic, marks: Mark[], extend: Extend = {}): Promise<Pic> {
  const s = base.scale ?? 1
  const [et, er, eb, el] = [extend.top ?? 0, extend.right ?? 0, extend.bottom ?? 0, extend.left ?? 0].map((n) => Math.round(n * s))
  const w = base.width + el + er
  const h = base.height + et + eb
  const boxes = marks.map((m) => m.box.map((v, i) => Math.round(v * s) + (i % 2 ? et : el)) as Box)
  const labels = await Promise.all(marks.map((m) => (m.label ? text(m.label, { size: 16, bold: true, color: '#ffffff' }) : undefined)))
  const labelled = marks.map((_, i) => i).filter((i) => labels[i])
  const layout = placeBadges(
    w,
    h,
    labelled.map((i) => ({ box: boxes[i], w: (labels[i] as Pic).width + 18 })),
  )
  const top = layout.top
  const svg: string[] = []
  const texts: OverlayOptions[] = []
  for (const [i, m] of marks.entries()) {
    const [x0, y0, x1, y1] = boxes[i]
    const dash = m.dashed ? ' stroke-dasharray="12 8"' : ''
    svg.push(
      `<rect x="${x0}" y="${y0 + top}" width="${x1 - x0}" height="${y1 - y0}" rx="8" fill="none" stroke="${color(m.color)}" stroke-width="${m.dashed ? 3 : 4}"${dash}/>`,
    )
    if (m.text) {
      const t = await text(m.text, { size: 17, bold: true, color: m.color ?? 'red', width: Math.max(20, x1 - x0 - 20) })
      texts.push({ input: t.png, left: x0 + 10, top: y0 + top + 10 })
    }
  }
  const widths = labelled.map((i) => (labels[i] as Pic).width + 18)
  const badges: string[] = []
  for (const [n, i] of labelled.entries()) {
    const label = labels[i] as Pic
    const { x, y, side, row } = layout.at[n]
    const bw = widths[n]
    const inner = layout.at.flatMap((p, m): Box[] => (p.side === side && p.row < row ? [[p.x, p.y, p.x + widths[m], p.y + BADGE_H]] : []))
    const points = leader([x, y, x + bw, y + BADGE_H], boxes[i], side, h, layout.width, inner)
    const c = color(marks[i].color)
    const path = points.map(([px, py]) => `${px},${py + top}`).join(' ')
    svg.push(`<polyline points="${path}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`)
    badges.push(`<rect x="${x}" y="${y + top}" width="${bw}" height="${BADGE_H}" rx="6" fill="${c}"/>`)
    texts.push({ input: label.png, left: Math.round(x + 9), top: Math.round(y + top + (BADGE_H - label.height) / 2) })
  }
  svg.push(...badges)
  const W = Math.max(w, layout.width)
  const H = h + top + layout.bottom
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join('')}</svg>`)
  return pic(blank(W, H).composite([{ input: base.png, left: el, top: et + top }, { input: overlay, left: 0, top: 0 }, ...texts]))
}

/** A titled panel: the title, the image, then an optional note. As wide as the widest of the three, so nothing clips. */
export async function panel(title: string, of: Pic, o: { note?: string; color?: string; width?: number } = {}): Promise<Pic> {
  const head = await text(title, { size: 22, bold: true })
  const width = Math.max(of.width, head.width, o.width ?? 0)
  const note = o.note ? await text(o.note, { size: 19, color: o.color ?? 'blue', width }) : undefined
  const imageTop = head.height + 14
  const height = imageTop + of.height + (note ? 12 + note.height : 0)
  const layers: OverlayOptions[] = [
    { input: head.png, left: 0, top: 0 },
    { input: of.png, left: 0, top: imageTop },
  ]
  if (note) layers.push({ input: note.png, left: 0, top: imageTop + of.height + 12 })
  return pic(blank(width, height).composite(layers))
}

/** A bordered box of wrapped lines under an optional title in the border's colour: a rule, a source, a legend. */
export async function textBox(
  lines: string[],
  o: { title?: string; color?: string; width?: number; textColor?: string } = {},
): Promise<Pic> {
  const width = o.width ?? 560
  const inner = width - 40
  const head = o.title ? await text(o.title, { size: 21, bold: true, color: o.color ?? 'blue', width: inner }) : undefined
  const body = await text(lines.join('\n'), { size: 20, color: o.textColor ?? 'ink', width: inner })
  const bodyTop = 18 + (head ? head.height + 14 : 0)
  const height = bodyTop + body.height + 20
  const border = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10" fill="${PAPER}" stroke="${color(o.color ?? 'blue')}" stroke-width="2"/></svg>`
  const layers: OverlayOptions[] = [{ input: Buffer.from(border), left: 0, top: 0 }]
  if (head) layers.push({ input: head.png, left: 20, top: 18 })
  layers.push({ input: body.png, left: 20, top: bodyTop })
  return pic(blank(width, height).composite(layers))
}

/** Parts one under another (column) or side by side (row), aligned to the top-left. */
export async function stack(parts: Pic[], o: { dir?: 'column' | 'row'; gap?: number } = {}): Promise<Pic> {
  const gap = o.gap ?? 24
  const row = o.dir === 'row'
  const along = parts.reduce((n, p) => n + (row ? p.width : p.height), 0) + gap * Math.max(0, parts.length - 1)
  const across = Math.max(...parts.map((p) => (row ? p.height : p.width)))
  let at = 0
  const layers = parts.map((p) => {
    const layer = { input: p.png, left: row ? at : 0, top: row ? 0 : at }
    at += (row ? p.width : p.height) + gap
    return layer
  })
  return pic(blank(row ? along : across, row ? across : along).composite(layers))
}

/** Writes the PNG with a white margin. */
export async function save(p: Pic, out: string, pad = 24): Promise<void> {
  await sharp(p.png).extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' }).png().toFile(out)
}

type Node = Record<string, unknown>

/** One spec node → its picture. Unknown shapes fail with the node, so a typo is named rather than dropped. */
export async function build(node: Node, base: string): Promise<Pic> {
  if (typeof node.image === 'string') {
    const loaded = await load(resolve(base, node.image), { crop: node.crop as Box | undefined, scale: node.scale as number | undefined })
    const marks = (node.marks as Mark[] | undefined) ?? []
    return marks.length || node.extend ? annotate(loaded, marks, node.extend as Extend | undefined) : loaded
  }
  if (typeof node.panel === 'string') {
    if (!node.of) throw new Error(`panel "${node.panel}" has no "of" node`)
    return panel(node.panel, await build(node.of as Node, base), {
      note: node.note as string,
      color: node.color as string,
      width: node.width as number,
    })
  }
  if (Array.isArray(node.text)) {
    return textBox(node.text as string[], { title: node.title as string, color: node.color as string, width: node.width as number })
  }
  if (Array.isArray(node.stack)) {
    const parts = await Promise.all((node.stack as Node[]).map((n) => build(n, base)))
    return stack(parts, { dir: node.dir as 'row' | 'column', gap: node.gap as number })
  }
  throw new Error(`not a node (image, panel, text or stack): ${JSON.stringify(node).slice(0, 200)}`)
}

if (import.meta.main) {
  const [spec, out] = process.argv.slice(2)
  if (!spec || !out || !existsSync(spec)) {
    console.error('usage: bun annotate.ts <spec.json> <out.png>   (spec format: this file’s header)')
    process.exit(2)
  }
  const result = await build(JSON.parse(readFileSync(spec, 'utf8')) as Node, dirname(resolve(spec)))
  await save(result, out)
  console.log(`${out}: ${result.width + 48}×${result.height + 48}`)
}
