// Finds containers whose structure repeats across flows: the shared-component candidates the orchestrator names before
// the harvest. Pure: scripts/figma/candidates.ts feeds it the containers it read from each screen.
import type { SharedCandidate } from './types.ts'

export type ContainerSample = {
  screen: string
  flow: string
  id: string
  name: string
  childNames: string[]
  w: number
  h: number
  /** The screen's width: a container nearly as wide is page layout, not a component. */
  screenW: number
  /** Ids of the containers above this one, inside the same screen. */
  ancestors: string[]
}

/** Smaller containers are buttons, chips and rows: design-system primitives, never shared entries. */
const MIN_WIDTH = 200
const MIN_HEIGHT = 60
const MIN_CHILDREN = 2
/** Containers at least this share of the screen's width are the page's shell and columns. */
const LAYOUT_WIDTH_SHARE = 0.9

export function signatureOf(sample: Pick<ContainerSample, 'name' | 'childNames'>): string {
  return `${sample.name} > ${sample.childNames.join(', ')}`
}

function isComponentSized(sample: ContainerSample): boolean {
  const largeEnough = sample.w >= MIN_WIDTH && sample.h >= MIN_HEIGHT && sample.childNames.length >= MIN_CHILDREN
  const isLayout = sample.w >= sample.screenW * LAYOUT_WIDTH_SHARE
  return largeEnough && !isLayout
}

/** Candidates seen in two or more flows, outermost first: a candidate inside another candidate's node is dropped. */
export function findSharedCandidates(samples: ContainerSample[]): SharedCandidate[] {
  const bySignature = new Map<string, ContainerSample[]>()
  for (const sample of samples.filter(isComponentSized)) {
    const signature = signatureOf(sample)
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), sample])
  }

  const repeated = [...bySignature].filter(([, list]) => new Set(list.map((s) => s.flow)).size >= 2)
  const candidateIds = new Set(repeated.flatMap(([, list]) => list.map((s) => s.id)))

  const candidates: SharedCandidate[] = []
  for (const [signature, list] of repeated) {
    const outermost = list.filter((s) => !s.ancestors.some((id) => candidateIds.has(id)))
    if (outermost.length === 0) continue
    candidates.push({
      signature,
      flows: [...new Set(outermost.map((s) => s.flow))],
      nodes: firstPerScreen(outermost).map((s) => ({ screen: s.screen, id: s.id, w: Math.round(s.w), h: Math.round(s.h) })),
    })
  }
  return candidates.filter((c) => c.flows.length >= 2).toSorted((a, b) => b.flows.length - a.flows.length)
}

function firstPerScreen(samples: ContainerSample[]): ContainerSample[] {
  const seen = new Set<string>()
  const first: ContainerSample[] = []
  for (const sample of samples) {
    if (seen.has(sample.screen)) continue
    seen.add(sample.screen)
    first.push(sample)
  }
  return first
}
