// Keys that match a click or an instance across screens, shared by the Figma-side dump and merge.ts. Pure.
import type { Click, InstanceRef } from './types.ts'

export const clickKey = (c: Click) => `${c.on}|${c.text}|${c.action}|${c.to}`

/** An instance key with its count: five member cards differ from four. */
export const countedKey = (i: Pick<InstanceRef, 'key' | 'n'>) => (i.n && i.n > 1 ? `${i.key} ×${i.n}` : i.key)
