// Figma side, read-only. Print the paste-ready script with:
//   bun scripts/figma.ts candidates --args '{"screens":[{"id":"1:2","flow":"edit"}]}'
// Before the harvest: lists containers whose name and children's names repeat across two or more flows, so the
// orchestrator can name each shared component once, before any subagent describes it.
import { findSharedCandidates, type ContainerSample } from '../lib/candidates.ts'
import type { SharedCandidate } from '../lib/types.ts'

export type CandidatesArgs = { screens: { id: string; flow: string }[] }

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'])
const MAX_DEPTH = 6

function isContainer(node: SceneNode): boolean {
  return node.visible !== false && CONTAINER_TYPES.has(node.type)
}

function containerChildren(node: SceneNode): SceneNode[] {
  if (node.type === 'INSTANCE' || !('children' in node)) return []
  return node.children.filter(isContainer)
}

function sampleScreen(screen: FrameNode, flow: string): ContainerSample[] {
  const samples: ContainerSample[] = []
  const visit = (node: SceneNode, ancestors: string[], depth: number) => {
    if (depth > MAX_DEPTH) return
    const children = containerChildren(node)
    samples.push({
      screen: screen.id,
      flow,
      id: node.id,
      name: node.name,
      childNames: children.map((c) => c.name),
      w: node.width,
      h: node.height,
      screenW: screen.width,
      ancestors,
    })
    for (const child of children) visit(child, [...ancestors, node.id], depth + 1)
  }
  for (const child of screen.children.filter(isContainer)) visit(child, [], 1)
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
