// Figma side, read-only. Print the paste-ready script with:
//   bun scripts/figma.ts locate --args '{"base":"<screen id>","nodes":["<node id in base>"],"targets":["<screen id>"]}'
// A record whose outline came from another screen carries that screen's node ids. This finds the matching node in each
// target screen: first by the same child-index path, accepted only when the node there has the same name and type;
// otherwise by a search for that name and type, accepted only when exactly one node matches.
import type { LocatedNode, LocateResult } from '../lib/types.ts'

export type LocateArgs = { base: string; nodes: string[]; targets: string[] }

type Found = { node: BaseNode; path: number[] }

/** The child-index path from the screen down to the node, or null when the node is not inside the screen. */
async function pathFrom(screenId: string, nodeId: string): Promise<Found | null> {
  const node = await figma.getNodeByIdAsync(nodeId)
  if (!node) return null
  const path: number[] = []
  let current: BaseNode = node
  while (current.id !== screenId) {
    const parent: (BaseNode & ChildrenMixin) | null = current.parent
    if (!parent) return null
    path.unshift(parent.children.indexOf(current as SceneNode))
    current = parent
  }
  return { node, path }
}

async function followPath(screenId: string, path: number[]): Promise<BaseNode | null> {
  let current: BaseNode | null = await figma.getNodeByIdAsync(screenId)
  for (const index of path) {
    if (!current || !('children' in current) || !current.children[index]) return null
    current = current.children[index]
  }
  return current
}

const sameKind = (a: BaseNode, b: BaseNode) => a.name === b.name && a.type === b.type

async function searchByName(screenId: string, like: BaseNode): Promise<BaseNode | null> {
  const screen = await figma.getNodeByIdAsync(screenId)
  if (!screen || !('findAll' in screen)) return null
  const matches = screen.findAll((n) => sameKind(n, like))
  return matches.length === 1 ? matches[0] : null
}

async function locateIn(screenId: string, found: Found): Promise<LocatedNode | null> {
  const byPath = await followPath(screenId, found.path)
  if (byPath && sameKind(byPath, found.node)) return { id: byPath.id, name: byPath.name, via: 'path' }
  const byName = await searchByName(screenId, found.node)
  return byName ? { id: byName.id, name: byName.name, via: 'name' } : null
}

export async function main(args: LocateArgs): Promise<LocateResult> {
  const result: LocateResult = {}
  for (const nodeId of args.nodes) {
    const found = await pathFrom(args.base, nodeId)
    result[nodeId] = {}
    for (const target of args.targets) result[nodeId][target] = found ? await locateIn(target, found) : null
  }
  return result
}
