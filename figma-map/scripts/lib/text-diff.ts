// Positional text diffs. Texts repeat on a screen ("IDR", an approver's name), so a delta is a list of [index, text]
// pairs from a longest-common-subsequence walk, not a set difference.
import type { TextDelta } from './types.ts'

/** The pairs that turn `base` into `next`: `del` indexes into `base`, `add` into `next`. */
export function diffTexts(base: string[], next: string[]): TextDelta {
  const common = commonSuffixLengths(base, next)
  const add: [number, string][] = []
  const del: [number, string][] = []
  let i = 0
  let j = 0
  while (i < base.length || j < next.length) {
    if (i < base.length && j < next.length && base[i] === next[j]) {
      i++
      j++
    } else if (j < next.length && (i === base.length || common[i][j + 1] >= common[i + 1][j])) {
      add.push([j, next[j]])
      j++
    } else {
      del.push([i, base[i]])
      i++
    }
  }
  return { add, del }
}

/** Rebuilds the screen's texts from the base and a delta. */
export function applyTextDelta(base: string[], delta: TextDelta): string[] {
  const deleted = new Set(delta.del.map(([index]) => index))
  const texts = base.filter((_, index) => !deleted.has(index))
  const additions = delta.add.toSorted((a, b) => a[0] - b[0])
  for (const [index, text] of additions) texts.splice(Math.min(index, texts.length), 0, text)
  return texts
}

/** table[i][j] = length of the longest common subsequence of a[i..] and b[j..]. */
function commonSuffixLengths(a: string[], b: string[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  return table
}
