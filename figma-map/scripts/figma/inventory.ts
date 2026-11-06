// Figma side, read-only. Print the paste-ready script with:
//   bun scripts/figma.ts inventory --args '{"section":"<node id>"}'
// Lists the section's screens (frames at least 400px tall) grouped into flows by the label frames drawn above them.
import { groupFlows, separateCopy, type ScreenBox } from '../lib/labels.ts'
import type { FlowInventory, Label } from '../lib/types.ts'

export type InventoryArgs = { section: string }

const MIN_SCREEN_HEIGHT = 400
const MAX_LABEL_HEIGHT = 120
const LABEL_TYPES = new Set(['FRAME', 'GROUP', 'INSTANCE', 'TEXT'])

function visibleText(node: SceneNode): string {
  if (node.type === 'TEXT') return node.characters
  if (!('findAll' in node)) return ''
  return node
    .findAll((child) => child.type === 'TEXT' && child.visible)
    .map((child) => (child as TextNode).characters)
    .join(' ')
}

function countWithin(node: FrameNode, test: (n: SceneNode) => boolean): number {
  return node.findAll(test).length
}

function hasAnnotations(node: SceneNode): boolean {
  return 'annotations' in node && node.annotations.length > 0
}

function hasReactions(node: SceneNode): boolean {
  return 'reactions' in node && node.reactions.length > 0
}

function toScreen(frame: FrameNode): ScreenBox {
  return {
    id: frame.id,
    name: frame.name,
    x: Math.round(frame.x),
    y: Math.round(frame.y),
    w: Math.round(frame.width),
    h: Math.round(frame.height),
    ann: countWithin(frame, hasAnnotations),
    clicks: countWithin(frame, hasReactions),
  }
}

function toLabel(node: SceneNode): Label | null {
  const text = visibleText(node).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return { x: node.x, y: node.y, w: node.width, h: node.height, name: node.name, text }
}

async function pageOf(node: BaseNode): Promise<PageNode | null> {
  let current: BaseNode | null = node
  while (current && current.type !== 'PAGE') current = current.parent
  return current
}

export async function main(args: InventoryArgs): Promise<FlowInventory | { error: string }> {
  const section = await figma.getNodeByIdAsync(args.section)
  if (!section || !('children' in section)) return { error: `no container node ${args.section}` }
  const page = await pageOf(section)
  if (page) await figma.setCurrentPageAsync(page)

  const screens: ScreenBox[] = []
  const labels: Label[] = []
  for (const child of section.children as readonly SceneNode[]) {
    if (child.visible === false) continue
    if (child.type === 'FRAME' && child.height >= MIN_SCREEN_HEIGHT) {
      screens.push(toScreen(child))
    } else if (LABEL_TYPES.has(child.type) && child.height < MAX_LABEL_HEIGHT) {
      const label = toLabel(child)
      if (label) labels.push(label)
    }
  }

  const { names, copy } = separateCopy(labels)
  return {
    section: { id: section.id, name: section.name },
    page: page ? { id: page.id, name: page.name } : null,
    flows: groupFlows(screens, names),
    copyLabels: copy.map((l) => l.text),
  }
}
