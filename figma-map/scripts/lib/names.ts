// Naming rules shared by the Figma-side scripts and the Bun scripts. Pure functions only.

/** Layer names a designer never chose: Figma's defaults and layout wrappers. */
const GENERIC_NAME = /^(Frame|Group|Rectangle|Vector|Ellipse|Line|Auto layout|Container|Content|Wrapper|Text|Stack|Row|Column)\s*\d*$/i

/** Icon libraries: their instances say nothing about the screen. */
const ICON_NAME = /^(vuesax|material|iconamoon|heroicons|mdi|ic:|lucide|icon)/i

/** A label longer than this many words is copy, not a name. Real page labels run to 7: "When the user clicks on another menu". */
const MAX_NAME_WORDS = 10

export function isGenericName(name: string): boolean {
  return GENERIC_NAME.test(name)
}

export function isIconName(name: string): boolean {
  return ICON_NAME.test(name)
}

/**
 * A label that reads like a sentence holds UI copy the designer pasted above a screen, not a page name.
 * Example: "One after another, in this order. Drag to reorder."
 */
export function isSentenceLike(text: string): boolean {
  const trimmed = text.trim()
  const words = trimmed.split(/\s+/).filter(Boolean).length
  return /[.!?]$/.test(trimmed) || words > MAX_NAME_WORDS
}

/** Kebab case for file names and page anchors: "Detail Page -- Configured" → "detail-page-configured". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** FNV-1a, 32-bit, as 8 hex digits: a screen's signature for incremental runs. */
export function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
