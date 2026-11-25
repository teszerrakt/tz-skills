// Figma side, read-only. Print the paste-ready script with:
//   bun scripts/figma.ts outline --args '{"node":"<node id>","depth":3}'
// One line per visible container under the node: indent, id, type, name, size and offset. An instance is a leaf, so a
// header's logo vectors never come back; text and shapes are left out. Use it to find a component's node to crop.

export type OutlineArgs = { node: string; depth?: number }
export type OutlineResult = { root: string; lines: string[] } | { error: string }

const LEAF_TYPES = new Set(['TEXT', 'VECTOR', 'ELLIPSE', 'LINE', 'RECTANGLE', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION'])

function line(node: SceneNode, depth: number): string {
  const name = node.name.length > 40 ? `${node.name.slice(0, 39)}…` : node.name
  return `${'  '.repeat(depth)}${node.id} ${node.type} "${name}" ${Math.round(node.width)}x${Math.round(node.height)} @${Math.round(node.x)},${Math.round(node.y)}`
}

export async function main(args: OutlineArgs): Promise<OutlineResult> {
  const root = await figma.getNodeByIdAsync(args.node)
  if (!root || !('children' in root)) return { error: `${args.node} is not a node with children` }
  const max = args.depth ?? 3
  const lines: string[] = []
  const walk = (node: SceneNode, depth: number) => {
    if (!node.visible || LEAF_TYPES.has(node.type)) return
    lines.push(line(node, depth))
    if (depth + 1 >= max || node.type === 'INSTANCE' || !('children' in node)) return
    for (const child of node.children) walk(child, depth + 1)
  }
  for (const child of (root as ChildrenMixin).children) walk(child, 0)
  const size = 'width' in root ? ` ${Math.round((root as SceneNode).width)}x${Math.round((root as SceneNode).height)}` : ''
  return { root: `${root.id} ${root.type} "${root.name}"${size}`, lines }
}
