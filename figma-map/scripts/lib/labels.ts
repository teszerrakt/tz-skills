// Places each screen under the label frames drawn above it: the outermost band names the flow, the labels nested under
// it name the page. Pure: scripts/figma/inventory.ts feeds it boxes read from the canvas.
import { isSentenceLike, slugify } from './names.ts'
import type { Box, InventoryFlow, InventoryScreen, Label } from './types.ts'

export type ScreenBox = Box & { id: string; name: string; ann: number; clicks: number }

const NO_FLOW = '(no flow label)'
/** Screens whose tops sit within this many pixels share a row. */
const ROW_TOLERANCE = 50

const bottom = (b: Box) => b.y + b.h
const overlapsHorizontally = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w
const spans = (outer: Box, inner: Box) => outer.w > inner.w + 1 && outer.x <= inner.x + 1 && outer.x + outer.w >= inner.x + inner.w - 1

/** Splits the labels into names and pasted copy; copy never names a flow or a page. */
export function separateCopy(labels: Label[]): { names: Label[]; copy: Label[] } {
  const names: Label[] = []
  const copy: Label[] = []
  for (const label of labels) (isSentenceLike(label.text) ? copy : names).push(label)
  return { names, copy }
}

/**
 * Labels named "Flow" or "Page" say what they are. Without those names, a label wider than a screen is a flow band.
 */
export function flowBandTest(labels: Label[], screenWidth: number): (label: Label) => boolean {
  const named = labels.some((l) => /^(flow|page)$/i.test(l.name))
  if (named) return (l) => /^flow$/i.test(l.name)
  return (l) => l.w > screenWidth * 1.2
}

/** True when a screen sits between `upper` and `lower` in the column `lower` occupies. */
export function screenBetween(upper: Box, lower: Box, screens: Box[]): boolean {
  return screens.some((s) => bottom(s) > bottom(upper) && s.y < lower.y && overlapsHorizontally(s, lower))
}

/** The nearest label, then each wider label straight above that spans it, outermost first. */
function chainUpwards(nearestFirst: Label[], joins: (upper: Label, lower: Label) => boolean): Label[] {
  if (nearestFirst.length === 0) return []
  const chain = [nearestFirst[0]]
  for (const label of nearestFirst.slice(1)) {
    const top = chain[0]
    if (bottom(label) <= top.y && spans(label, top) && joins(label, top)) chain.unshift(label)
  }
  return chain
}

/** The flow and page labels for one screen. */
export function placeScreen(screen: Box, labels: Label[], screens: Box[], isFlowBand: (l: Label) => boolean) {
  const above = labels.filter((l) => bottom(l) <= screen.y + 5 && overlapsHorizontally(l, screen)).toSorted((p, q) => bottom(q) - bottom(p))

  // A band only nests under a wider band with no row of screens between them, or every row would inherit the bands above it.
  const bands = chainUpwards(above.filter(isFlowBand), (upper, lower) => !screenBetween(upper, lower, screens))
  const innermostBand = bands.at(-1)

  // A page label belongs to this screen only when no other screen sits between them.
  const pageLabels = above.filter((l) => !isFlowBand(l) && (!innermostBand || l.y > innermostBand.y) && !screenBetween(l, screen, screens))
  const pages = chainUpwards(pageLabels, () => true)

  const [flowBand, ...nestedBands] = bands
  const pageParts = [...nestedBands, ...pages].map((l) => l.text)
  return { flow: flowBand?.text ?? NO_FLOW, page: pageParts.length ? pageParts.join(' › ') : null }
}

const byPosition = (a: Box, b: Box) => a.y - b.y || a.x - b.x

/** Screens with no label at all are grouped by row, each row named after its first screen. */
function nameUnlabelledRows(screens: InventoryScreen[]): void {
  const unlabelled = screens.filter((s) => s.flow === NO_FLOW).toSorted(byPosition)
  let rowTop = Number.NEGATIVE_INFINITY
  let rowName = ''
  for (const screen of unlabelled) {
    if (screen.y - rowTop > ROW_TOLERANCE) {
      rowTop = screen.y
      rowName = `${screen.name} (row at y ${Math.round(screen.y)})`
    }
    screen.flow = rowName
  }
}

/** Groups placed screens into flows, in canvas order, each with a unique file-name slug. */
export function groupFlows(screens: ScreenBox[], labels: Label[]): InventoryFlow[] {
  const screenWidth = Math.max(0, ...screens.map((s) => s.w))
  const isFlowBand = flowBandTest(labels, screenWidth)
  const placed: InventoryScreen[] = screens.map((s) => ({ ...s, ...placeScreen(s, labels, screens, isFlowBand) }))
  nameUnlabelledRows(placed)

  const flows = new Map<string, InventoryScreen[]>()
  for (const screen of placed.toSorted(byPosition)) {
    const list = flows.get(screen.flow) ?? []
    list.push(screen)
    flows.set(screen.flow, list)
  }

  const taken = new Set<string>()
  return [...flows].map(([name, list]) => {
    let slug = slugify(name) || 'flow'
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(name)}-${n}`
    taken.add(slug)
    return { name, slug, screens: list }
  })
}
