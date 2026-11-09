// Figma side, read-only. Print the paste-ready script with:
//   bun scripts/figma.ts dump --fb <fact-base> --flows <slug,slug> --part <n>
// Per flow, returns the base screen in full (only in the call that holds it) and every other screen as a delta against
// it, so a flow's shared shell is paid for once. With "sigOnly": true it returns only { flow: { id: signature } }: the
// cheap check a refresh makes first.
import { clickKey, countedKey } from '../lib/keys.ts'
import { isGenericName, isIconName, hash } from '../lib/names.ts'
import { bareOutline, buildOutline, type NodeLike } from '../lib/outline.ts'
import { diffTexts } from '../lib/text-diff.ts'
import type {
  Annotation,
  Click,
  DumpFlow,
  DumpResult,
  InstanceRef,
  MissingScreen,
  ScreenDelta,
  ScreenDump,
  Signatures,
} from '../lib/types.ts'

export type DumpArgs = { flows: DumpFlow[]; sigOnly?: boolean }

type ChainLink = { node: SceneNode; visible: boolean }
type ScreenRead = ScreenDump & { bare: string }

/** The nearest visible container a designer named: annotations and instances are filed under it. */
function nearestNamed(chain: ChainLink[], screen: SceneNode): SceneNode {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].visible && !isGenericName(chain[i].node.name)) return chain[i].node
  }
  return screen
}

function textInside(node: SceneNode): string {
  if (node.type === 'TEXT') return node.characters
  if (!('findAll' in node)) return ''
  return node
    .findAll((child) => child.type === 'TEXT' && child.visible)
    .map((child) => (child as TextNode).characters)
    .join(' ')
}

async function destinationLabel(id: string | null): Promise<string | null> {
  if (!id) return null
  const destination = await figma.getNodeByIdAsync(id)
  return destination ? `${id} ${destination.name}` : id
}

async function readScreen(id: string): Promise<ScreenRead | MissingScreen> {
  const screen = (await figma.getNodeByIdAsync(id)) as SceneNode | null
  if (!screen || !('children' in screen)) return { id, error: 'missing' }
  const originX = screen.absoluteTransform[0][2]
  const originY = screen.absoluteTransform[1][2]
  const texts: { t: string; x: number; y: number }[] = []
  const annotations: Annotation[] = []
  const clicks: Click[] = []
  const instances: InstanceRef[] = []

  function readAnnotations(node: SceneNode, chain: ChainLink[]) {
    if (!('annotations' in node)) return
    for (const annotation of node.annotations) {
      const at = nearestNamed(chain, screen!)
      annotations.push({
        node: node.id,
        on: node.name,
        within: `${at.name}#${at.id}`,
        label: annotation.label || annotation.labelMarkdown || '',
      })
    }
  }

  async function readReactions(node: SceneNode) {
    if (!('reactions' in node)) return
    for (const reaction of node.reactions) {
      const actions = reaction.actions ?? (reaction.action ? [reaction.action] : [])
      for (const action of actions) {
        const destinationId = 'destinationId' in action ? (action.destinationId ?? null) : null
        const navigation = 'navigation' in action ? action.navigation : undefined
        clicks.push({
          node: node.id,
          on: node.name,
          text: textInside(node).slice(0, 40),
          trigger: reaction.trigger?.type ?? null,
          action: [action.type, navigation].filter(Boolean).join('/'),
          to: await destinationLabel(destinationId),
        })
      }
    }
  }

  async function readInstance(node: InstanceNode, chain: ChainLink[]) {
    const mainComponent = await node.getMainComponentAsync()
    const set = mainComponent?.parent?.type === 'COMPONENT_SET' ? mainComponent.parent.name : null
    const component = mainComponent ? mainComponent.name : node.name
    if (set || !isIconName(component)) {
      instances.push({ key: `${set ?? '-'}: ${component} @${nearestNamed(chain, screen!).name}`, id: node.id })
    }
  }

  async function walk(node: SceneNode, chain: ChainLink[], parentVisible: boolean, insideInstance: boolean) {
    const visible = parentVisible && node.visible !== false
    // Annotated layers are often hidden, so annotations are read before the visibility cut.
    readAnnotations(node, chain)
    const next = [...chain, { node, visible }]
    const enteringInstance = insideInstance || node.type === 'INSTANCE'
    if (visible) {
      if (node.type === 'TEXT' && node.characters.trim()) {
        const box = node.absoluteBoundingBox
        texts.push({
          t: node.characters.trim().replace(/\s+/g, ' '),
          x: Math.round((box?.x ?? 0) - originX),
          y: Math.round((box?.y ?? 0) - originY),
        })
      }
      await readReactions(node)
      if (node.type === 'INSTANCE' && !insideInstance) await readInstance(node, chain)
    }
    if ('children' in node) for (const child of node.children) await walk(child, next, visible, enteringInstance)
  }

  for (const child of screen.children) await walk(child, [{ node: screen, visible: true }], true, false)
  const outline = buildOutline(screen as unknown as NodeLike)
  const bare = bareOutline(outline)
  // Reading order: top to bottom, then left to right within a line.
  const textList = texts.toSorted((a, b) => (Math.abs(a.y - b.y) < 6 ? a.x - b.x : a.y - b.y)).map((t) => t.t)
  const sig = hash(
    JSON.stringify([
      textList,
      instances.map((i) => i.key).toSorted(),
      bare,
      annotations.map((a) => a.label),
      clicks.map((c) => [c.text, c.action]),
    ]),
  )
  return {
    id,
    name: screen.name,
    h: Math.round(screen.height),
    sig,
    texts: textList,
    annotations,
    clicks,
    instances: grouped(instances),
    outline,
    bare,
  }
}

/** Repeats of one key (five member cards) become one entry with a count. */
function grouped(instances: InstanceRef[]): InstanceRef[] {
  const byKey = new Map<string, InstanceRef>()
  for (const instance of instances) {
    const seen = byKey.get(instance.key)
    if (seen) seen.n = (seen.n ?? 1) + 1
    else byKey.set(instance.key, { ...instance })
  }
  return [...byKey.values()]
}

const isMissing = (read: ScreenRead | MissingScreen): read is MissingScreen => 'error' in read

function deltaAgainst(base: ScreenRead, screen: ScreenRead, outline: ScreenDelta['outline']): ScreenDelta {
  const baseInstances = new Set(base.instances.map(countedKey))
  const screenInstances = new Set(screen.instances.map(countedKey))
  const baseClicks = new Set(base.clicks.map(clickKey))
  const screenClicks = new Set(screen.clicks.map(clickKey))
  return {
    id: screen.id,
    name: screen.name,
    h: screen.h,
    sig: screen.sig,
    texts: diffTexts(base.texts, screen.texts),
    instances: {
      add: screen.instances.filter((i) => !baseInstances.has(countedKey(i))),
      del: base.instances.filter((i) => !screenInstances.has(countedKey(i))).map((i) => i.key),
    },
    outline,
    annotations: screen.annotations,
    clicks: {
      add: screen.clicks.filter((c) => !baseClicks.has(clickKey(c))),
      del: base.clicks.filter((c) => !screenClicks.has(clickKey(c))).map(clickKey),
    },
  }
}

function withoutBare(read: ScreenRead): ScreenDump {
  const { bare: _bare, ...dump } = read
  return dump
}

async function dumpFlow(flow: DumpFlow): Promise<DumpResult['flows'][string]> {
  const base = await readScreen(flow.base)
  if (isMissing(base)) return { deltas: [base] }
  // A screen whose layout an earlier screen in this call already returned points at it instead of repeating it.
  const layouts = new Map<string, string>()
  const deltas: (ScreenDelta | MissingScreen)[] = []
  for (const id of flow.ids) {
    if (id === flow.base) continue
    const read = await readScreen(id)
    if (isMissing(read)) {
      deltas.push(read)
      continue
    }
    const earlier = layouts.get(read.bare)
    const outline = read.bare === base.bare ? 'same' : earlier ? (`sameAs:${earlier}` as const) : read.outline
    if (outline === read.outline) layouts.set(read.bare, id)
    deltas.push(deltaAgainst(base, read, outline))
  }
  return flow.withBase === false ? { deltas } : { base: withoutBare(base), deltas }
}

export async function main(args: DumpArgs): Promise<DumpResult | Record<string, Signatures>> {
  if (args.sigOnly) {
    const signatures: Record<string, Signatures> = {}
    for (const flow of args.flows) {
      signatures[flow.slug] = {}
      for (const id of flow.ids) {
        const read = await readScreen(id)
        signatures[flow.slug][id] = isMissing(read) ? 'missing' : read.sig
      }
    }
    return signatures
  }
  const result: DumpResult = { flows: {} }
  for (const flow of args.flows) result.flows[flow.slug] = await dumpFlow(flow)
  return result
}
