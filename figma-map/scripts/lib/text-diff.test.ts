import { expect, test } from 'bun:test'
import { applyTextDelta, diffTexts } from './text-diff.ts'

test('a delta applied to the base gives back the other screen, repeated texts included', () => {
  const base = ['Klay.', 'IDR', 'Severus Snape', 'IDR', 'Save']
  const next = ['Klay.', 'IDR', 'Albus Dumbledore', 'Severus Snape', 'IDR', 'Unsaved changes', 'Save']
  const delta = diffTexts(base, next)
  expect(applyTextDelta(base, delta)).toEqual(next)
  expect(delta.del).toEqual([])
})

test('identical texts give an empty delta', () => {
  expect(diffTexts(['a', 'b'], ['a', 'b'])).toEqual({ add: [], del: [] })
})
