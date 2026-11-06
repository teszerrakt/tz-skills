// The shapes of every file in a figma-map fact base, and of what the Figma-side scripts return.
// No runtime code here: both the Bun scripts and the Figma-side scripts import these types.

/** A label frame drawn above a group of screens. */
export type Label = { x: number; y: number; w: number; h: number; name: string; text: string }

/** A frame's position on the canvas. */
export type Box = { x: number; y: number; w: number; h: number }

/** One screen in the inventory: `flows.json`. */
export type InventoryScreen = Box & {
  id: string
  name: string
  /** The outermost label above the screen; screens with none share "(no flow label)". */
  flow: string
  /** The nested labels under the flow label, joined with " › "; null when none sits above the screen. */
  page: string | null
  /** Annotated layers in the screen. */
  ann: number
  /** Layers with a prototype reaction. */
  clicks: number
}

export type InventoryFlow = { name: string; slug: string; screens: InventoryScreen[] }

/** `flows.json`: what scripts/figma/inventory.ts returns. */
export type FlowInventory = {
  section: { id: string; name: string }
  page: { id: string; name: string } | null
  flows: InventoryFlow[]
  /** Label frames that hold sentence copy rather than a name; they never name a flow or a page. */
  copyLabels: string[]
}

export type Annotation = {
  /** The annotated layer. Inside an instance its id starts with "I"; link `within` instead. */
  node: string
  on: string
  /** "<name>#<id>" of the nearest visible, named container. */
  within: string
  label: string
}

export type Click = {
  node: string
  on: string
  text: string
  trigger: string | null
  action: string
  /** "<id> <name>" of the destination, or null when the prototype link has none. */
  to: string | null
}

/** A component instance: `key` is "<set>: <variant> @<container>", stable across screens. */
export type InstanceRef = { key: string; id: string }

/** A named container: a leaf "<name>#<id>", or { "<name>#<id>": children }. */
export type OutlineNode = string | { [nameAndId: string]: OutlineNode[] }
export type Outline = OutlineNode[]

/** One screen read in full. */
export type ScreenDump = {
  id: string
  name: string
  h: number
  sig: string
  texts: string[]
  annotations: Annotation[]
  clicks: Click[]
  instances: InstanceRef[]
  outline: Outline
}

/** [index, text] pairs: a positional diff against the base's texts, since texts repeat. */
export type TextDelta = { add: [number, string][]; del: [number, string][] }

export type ScreenDelta = {
  id: string
  name: string
  h: number
  sig: string
  texts: TextDelta
  instances: { add: InstanceRef[]; del: string[] }
  /** "same" when the outline matches the base's once ids are stripped. */
  outline: 'same' | Outline
  annotations: Annotation[]
  clicks: Click[]
}

export type MissingScreen = { id: string; error: string }

/** `raw/<flow>.json`: what scripts/figma/dump.ts returns. */
export type FlowDump = { base: ScreenDump; deltas: (ScreenDelta | MissingScreen)[] }

/** An instance in an expanded record; one shared with the base keeps only the base's id. */
export type RecordInstance = { key: string; id: string | null; baseId?: string }

/** `frames/<id>.json`: one screen rebuilt in full from its flow's dump. */
export type ScreenRecord = {
  id: string
  name: string
  h: number
  sig: string
  texts: string[]
  annotations: Annotation[]
  clicks: Click[]
  instances: RecordInstance[]
  outline: Outline
  /** The screen whose node ids the outline carries: this screen, or the flow's base. */
  outlineFrom: string
}

export type SetDiff = { add: string[]; del: string[] }

/** How a layout member differs from the layout's first screen. */
export type MemberKind = 'identical' | 'variant' | 'state'

export type LayoutMember = { id: string; kind: MemberKind; texts: SetDiff; instances: SetDiff }

/** `merge/<flow>.json`: one entry per distinct layout. */
export type LayoutGroup = {
  rep: string
  members: LayoutMember[]
  /** Any two screens in the layout with the same texts and instances: a duplicate, or a difference only an image shows. */
  identicalPairs: [string, string][]
}

/** `signatures/<flow>.json`: screen id → signature. */
export type Signatures = Record<string, string>

export type SignatureChanges = { changed: string[]; added: string[]; removed: string[]; same: string[] }

/** What scripts/figma/locate.ts returns: base node → target screen → the matching node. */
export type LocateResult = Record<string, Record<string, LocatedNode | null>>

export type LocatedNode = {
  id: string
  name: string
  /** "path" when the same child-index path held a node of the same name and type; "name" when a search by name found exactly one. */
  via: 'path' | 'name'
}

/** A container whose structure repeats across flows: one entry of `candidates.json`. */
export type SharedCandidate = {
  /** The container's name and its children's names, in order. */
  signature: string
  flows: string[]
  /** One node per screen it appears on. */
  nodes: { screen: string; id: string; w: number; h: number }[]
}

/** `shared-names.json`: the orchestrator's names for the candidates, written before the harvest. */
export type SharedName = { name: string; signature: string; nodes: string[] }

/** One line of a `## Sources` block. */
export type SourceLine = { n: number; url: string; label: string }
