// Finds containers that repeat across flows: the shared-component candidates the orchestrator names before the
// harvest. Pure: scripts/figma/candidates.ts feeds it the containers it read from each screen.
import { isGenericName } from './names.ts'
import type { CandidateShape, SharedCandidate } from './types.ts'

export type ContainerSample = {
  screen: string
  flow: string
  id: string
  name: string
  childNames: string[]
  /** The first visible text inside, cut to 40 characters. */
  text: string
  w: number
  h: number
  screenW: number
  screenH: number
}

/** Smaller containers are buttons, chips and rows: design-system primitives, never shared entries. */
const MIN_WIDTH = 200
const MIN_HEIGHT = 48
/** Containers at least this share of the screen's width are the page's shell and columns. */
const LAYOUT_WIDTH_SHARE = 0.9
const LAYOUT_HEIGHT_SHARE = 0.5
/** Past this many looks, the first text is data (a vendor's name), so shapes go by children alone. */
const MAX_SHAPES = 6

/** A designer-chosen name groups containers whatever their children; a generic one needs the same children too. */
export function signatureOf(sample: Pick<ContainerSample, 'name' | 'childNames'>): string {
  return isGenericName(sample.name) ? `${sample.name} > ${sample.childNames.join(', ')}` : sample.name
}

function isComponentSized(s: ContainerSample): boolean {
  if (s.w < MIN_WIDTH || s.h < MIN_HEIGHT) return false
  const fullWidth = s.w >= s.screenW * LAYOUT_WIDTH_SHARE
  if (isGenericName(s.name)) return s.childNames.length >= 2 && !fullWidth
  // A named full-width bar (an action bar) is a component; a named full-width column is the page's shell.
  return s.childNames.length >= 1 && !(fullWidth && s.h >= s.screenH * LAYOUT_HEIGHT_SHARE)
}

function shapesOf(samples: ContainerSample[], byText: boolean): CandidateShape[] {
  const shapes = new Map<string, ContainerSample[]>()
  for (const s of samples) {
    const key = `${s.childNames.join(', ')}|${byText ? s.text : ''}`
    shapes.set(key, [...(shapes.get(key) ?? []), s])
  }
  return [...shapes.values()]
    .map((list) => {
      const perScreen = firstPerScreen(list)
      const first = perScreen[0]
      return {
        text: first.text,
        children: first.childNames,
        size: `${Math.round(first.w)}×${Math.round(first.h)}`,
        ids: perScreen.map((s) => s.id),
      }
    })
    .toSorted((a, b) => b.ids.length - a.ids.length)
}

/** Candidates seen in two or more flows, most flows first. */
export function findSharedCandidates(samples: ContainerSample[]): SharedCandidate[] {
  const bySignature = new Map<string, ContainerSample[]>()
  for (const sample of samples.filter(isComponentSized)) {
    const signature = signatureOf(sample)
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), sample])
  }

  const candidates: SharedCandidate[] = []
  for (const [signature, list] of bySignature) {
    const flows = [...new Set(list.map((s) => s.flow))]
    if (flows.length < 2) continue
    let shapes = shapesOf(list, true)
    if (shapes.length > MAX_SHAPES) shapes = shapesOf(list, false)
    const candidate: SharedCandidate = { signature, flows, shapes: shapes.slice(0, MAX_SHAPES) }
    if (shapes.length > MAX_SHAPES) candidate.moreShapes = shapes.length - MAX_SHAPES
    candidates.push(candidate)
  }
  return candidates.toSorted((a, b) => b.flows.length - a.flows.length)
}

function firstPerScreen(samples: ContainerSample[]): ContainerSample[] {
  const seen = new Set<string>()
  return samples.filter((s) => !seen.has(s.screen) && seen.add(s.screen))
}
