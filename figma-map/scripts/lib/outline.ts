// The tree of named containers a screen's headings come from, and the node ids crops are cut from. Pure: it walks any
// object shaped like a Figma node, so tests can pass plain objects.
import { isGenericName } from './names.ts'
import type { Outline } from './types.ts'

export type NodeLike = { id: string; name: string; type: string; visible?: boolean; children?: readonly NodeLike[] }

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'INSTANCE', 'SECTION', 'COMPONENT'])
const MAX_DEPTH = 4
/** A generic wrapper is kept when it holds at least this many named containers: it is a region, like a side panel. */
const REGION_MIN_CHILDREN = 2

const label = (node: NodeLike) => `${node.name}#${node.id}`

function isContainer(node: NodeLike): boolean {
  return node.visible !== false && CONTAINER_TYPES.has(node.type)
}

/** An instance is opaque: its own layers belong to the component, not the screen. */
function childrenOf(node: NodeLike): readonly NodeLike[] {
  return node.type === 'INSTANCE' ? [] : (node.children ?? [])
}

export function buildOutline(node: NodeLike, depth = 1): Outline {
  if (depth > MAX_DEPTH) return []
  const out: Outline = []
  for (const child of childrenOf(node)) {
    if (!isContainer(child)) continue
    const isWrapper = isGenericName(child.name) && child.type !== 'INSTANCE'
    if (isWrapper) {
      // A wrapper costs no depth: only named levels count toward MAX_DEPTH.
      const asRegion = buildOutline(child, depth)
      if (asRegion.length >= REGION_MIN_CHILDREN) out.push({ [label(child)]: asRegion })
      else out.push(...asRegion)
      continue
    }
    const kids = buildOutline(child, depth + 1)
    out.push(kids.length ? { [label(child)]: kids } : label(child))
  }
  return out
}

/** The outline with node ids removed: two screens with the same structure compare equal. */
export function bareOutline(outline: Outline): string {
  return JSON.stringify(outline).replace(/#[^"]+"/g, '"')
}
