import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { annotate, build, load, panel, placeBadges, stack, text, textBox, type Box } from './annotate.ts'

const dir = mkdtempSync(join(tmpdir(), 'annotate-'))

/** A PNG of one colour, fully transparent when alpha is 0. */
async function png(name: string, width: number, height: number, background: { r: number; g: number; b: number; alpha: number }) {
  const path = join(dir, name)
  await sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toFile(path)
  return path
}

const pixel = async (buffer: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const at = (y * info.width + x) * info.channels
  return [...data.subarray(at, at + 3)]
}

test('a transparent crop is flattened onto white, not black', async () => {
  const loaded = await load(await png('clear.png', 20, 20, { r: 0, g: 0, b: 0, alpha: 0 }))
  expect(await pixel(loaded.png, 0, 0)).toEqual([255, 255, 255])
})

test('crop clamps to the image, then scale resizes it', async () => {
  const path = await png('grey.png', 200, 100, { r: 90, g: 90, b: 90, alpha: 1 })
  const loaded = await load(path, { crop: [50, 0, 400, 80], scale: 0.5 })
  expect([loaded.width, loaded.height, loaded.scale]).toEqual([75, 40, 0.5])
})

test('badges sit in bands above and below the image, never over it or each other', () => {
  const boxes: Box[] = [
    [10, 5, 60, 30],
    [20, 5, 80, 30],
    [500, 5, 590, 30],
    [10, 150, 60, 190],
  ]
  const { at, top, bottom, width } = placeBadges(
    600,
    200,
    boxes.map((box) => ({ box, w: 300 })),
  )
  const rects = at.map((p) => [p.x, p.y, p.x + 300, p.y + 28])
  for (const [x0, y0, x1, y1] of rects) {
    expect(y1 <= 0 || y0 >= 200).toBe(true)
    expect(x0 >= 0 && x1 <= width).toBe(true)
    expect(y0 >= -top && y1 <= 200 + bottom).toBe(true)
  }
  for (const [i, a] of rects.entries())
    for (const b of rects.slice(i + 1)) expect(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]).toBe(true)
  expect(at.map((p) => p.side)).toEqual(['top', 'top', 'top', 'bottom'])
})

test('a badge wider than its image widens the canvas instead of clipping', () => {
  const { width } = placeBadges(100, 50, [{ box: [0, 0, 50, 20], w: 240 }])
  expect(width).toBe(240)
})

test('a labelled mark adds its band and leaves the image itself uncovered', async () => {
  const base = await load(await png('blue.png', 300, 120, { r: 0, g: 0, b: 255, alpha: 1 }))
  const out = await annotate(base, [{ box: [100, 10, 200, 40], label: 'Undo per row' }])
  const band = out.height - base.height
  expect(band).toBeGreaterThan(28)
  expect(await pixel(out.png, 10, band + 60)).toEqual([0, 0, 255])
})

test('extend makes room for a dashed "not drawn" box outside the frame', async () => {
  const base = await load(await png('w.png', 200, 80, { r: 255, g: 255, b: 255, alpha: 1 }))
  const out = await annotate(base, [{ box: [210, 10, 300, 70], dashed: true, text: 'JE No.' }], { right: 110 })
  expect([out.width, out.height]).toEqual([310, 80])
})

test('a panel is never narrower than its title, so the title cannot clip', async () => {
  const small = await load(await png('small.png', 40, 40, { r: 200, g: 0, b: 0, alpha: 1 }))
  const title = 'D · Confirm, only when the account is Reconciled'
  const out = await panel(title, small, { note: 'Not in the handover.' })
  expect(out.width).toBe((await text(title, { size: 22, bold: true })).width)
})

test('a text box keeps its width and wraps long lines inside it', async () => {
  const one = await textBox(['short'], { width: 400, title: 'Rule' })
  const many = await textBox(['a much longer line that cannot fit on one row of a four hundred pixel box at all'], {
    width: 400,
    title: 'Rule',
  })
  expect([one.width, many.width]).toEqual([400, 400])
  expect(many.height).toBeGreaterThan(one.height)
})

test('a row stack is as wide as its parts and gaps, as tall as its tallest part', async () => {
  const a = await load(await png('a.png', 100, 30, { r: 0, g: 0, b: 0, alpha: 1 }))
  const b = await load(await png('b.png', 50, 80, { r: 0, g: 0, b: 0, alpha: 1 }))
  const out = await stack([a, b], { dir: 'row', gap: 10 })
  expect([out.width, out.height]).toEqual([160, 80])
})

test('a spec node that is none of the four shapes is named in the error', async () => {
  expect(build({ imgae: 'x.png' }, dir)).rejects.toThrow('not a node (image, panel, text or stack): {"imgae":"x.png"}')
})
