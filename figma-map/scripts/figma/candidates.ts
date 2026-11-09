// Figma side, read-only. Print the paste-ready script with:
//   bun scripts/figma.ts candidates --args '{"screens":[{"id":"1:2","flow":"edit"}]}'
// Before the harvest: lists containers that repeat across two or more flows, each with its distinct looks, so the
// orchestrator can name each shared component once, before any subagent describes it.
import { findSharedCandidates, type ContainerSample } from '../lib/candidates.ts'
import type { SharedCandidate } from '../lib/types.ts'

export type CandidatesArgs = { screens: { id: string; flow: string }[] }

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'])
const MAX_DEPTH = 8

function isContainer(node: SceneNode): boolean {
  return node.visible !== false && CONTAINER_TYPES.has(node.type)
}

function containerChildren(node: SceneNode): SceneNode[] {
  if (node.type === 'INSTANCE' || !('children' in node)) return []
  return node.children.filter(isContainer)
}

function firstText(node: SceneNode): string {
  if (!('findOne' in node)) return ''
  const text = node.findOne((n) => n.type === 'TEXT' && n.visible && (n as TextNode).characters.trim() !== '') as TextNode | null
  return text ? text.characters.trim().replace(/\s+/g, ' ').slice(0, 40) : ''
}

function sampleScreen(screen: FrameNode, flow: string): ContainerSample[] {
  const samples: ContainerSample[] = []
  const visit = (node: SceneNode, depth: number) => {
    if (depth > MAX_DEPTH) return
    const children = containerChildren(node)
    samples.push({
      screen: screen.id,
      flow,
      id: node.id,
      name: node.name,
      childNames: children.map((c) => c.name),
      text: firstText(node),
      w: node.width,
      h: node.height,
      screenW: screen.width,
      screenH: screen.height,
    })
    for (const child of children) visit(child, depth + 1)
  }
  for (const child of screen.children.filter(isContainer)) visit(child, 1)
  return samples
}

export async function main(args: CandidatesArgs): Promise<SharedCandidate[]> {
  const samples: ContainerSample[] = []
  for (const { id, flow } of args.screens) {
    const screen = await figma.getNodeByIdAsync(id)
    if (screen?.type === 'FRAME') samples.push(...sampleScreen(screen, flow))
  }
  return findSharedCandidates(samples)
}
