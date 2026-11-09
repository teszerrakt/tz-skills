import { expect, test } from 'bun:test'
import { changed, expand, group } from './merge.ts'
import type { FlowDump, ScreenDelta, ScreenDump } from './lib/types.ts'

const base: ScreenDump = {
  id: '1:1',
  name: 'Screen',
  h: 800,
  sig: 'a',
  texts: ['Title', 'Select a payment', 'Save'],
  annotations: [],
  clicks: [],
  instances: [
    { key: 'Input: State=Empty @Panel', id: '1:5' },
    { key: 'Button: Primary @Bar', id: '1:6' },
  ],
  outline: [{ 'Panel#1:4': ['Input#1:5'] }, 'Bar#1:7'],
}

const delta = (id: string, over: Partial<ScreenDelta> = {}): ScreenDelta => ({
  id,
  name: 'Screen',
  h: 800,
  sig: id,
  texts: { add: [], del: [] },
  instances: { add: [], del: [] },
  outline: 'same',
  annotations: [],
  clicks: [],
  ...over,
})

const dump = (...deltas: ScreenDelta[]): FlowDump => ({ base, deltas })

test('a delta rebuilds the screen: deleted texts go, added texts land at their index', () => {
  const [, filled] = expand(dump(delta('1:2', { texts: { add: [[1, 'Toko Sinar Jaya · 8.560.000,00']], del: [[1, 'Select a payment']] } })))
  expect(filled.texts).toEqual(['Title', 'Toko Sinar Jaya · 8.560.000,00', 'Save'])
  expect(filled.outlineFrom).toBe('1:1')
})

test('a repeated text keeps its place: an added duplicate is not dropped as already in the base', () => {
  const [, filled] = expand(
    dump(
      delta('1:2', {
        texts: {
          add: [
            [1, 'Save'],
            [2, '000'],
          ],
          del: [[1, 'Select a payment']],
        },
      }),
    ),
  )
  expect(filled.texts).toEqual(['Title', 'Save', '000', 'Save'])
})

test('an instance shared with the base carries no id of its own, so a crop must locate it', () => {
  const [, other] = expand(dump(delta('1:2')))
  expect(other.instances[0]).toEqual({ key: 'Input: State=Empty @Panel', id: null, baseId: '1:5' })
})

test('a missing screen is skipped, not expanded', () => {
  expect(expand({ base, deltas: [{ id: '9:9', error: 'missing' }] })).toHaveLength(1)
})

test('same layout: identical, variant-only and text states are told apart; a new layout is its own group', () => {
  const records = expand(
    dump(
      delta('1:2'),
      delta('1:3', { instances: { add: [{ key: 'Input: State=Filled @Panel', id: '3:5' }], del: ['Input: State=Empty @Panel'] } }),
      delta('1:4', { texts: { add: [[1, 'IDR 3.000.000']], del: [[1, 'Select a payment']] } }),
      delta('1:8', { outline: [{ 'Panel#8:4': ['Input#8:5', 'Result#8:9'] }, 'Bar#8:7'] }),
    ),
  )
  const groups = group(records)
  expect(groups.map((g) => g.rep)).toEqual(['1:1', '1:8'])
  expect(groups[0].members.map((m) => [m.id, m.kind])).toEqual([
    ['1:2', 'identical'],
    ['1:3', 'variant'],
    ['1:4', 'state'],
  ])
})

test('identical screens are found between any two members, not only against the first screen', () => {
  const typed = { texts: { add: [[1, 'IDR 3.000.000']] as [number, string][], del: [[1, 'Select a payment']] as [number, string][] } }
  const groups = group(expand(dump(delta('1:2', typed), delta('1:3', typed))))
  expect(groups[0].members.map((m) => m.kind)).toEqual(['state', 'state'])
  expect(groups[0].identicalPairs).toEqual([['1:2', '1:3']])
})

test('outline ids never split a group: two screens with the same structure share a layout', () => {
  const records = expand(dump(delta('1:9', { outline: [{ 'Panel#9:4': ['Input#9:5'] }, 'Bar#9:7'] })))
  expect(group(records)).toHaveLength(1)
})

test('signature comparison names changed, added and removed screens', () => {
  expect(changed({ a: '1', b: '2', c: '3' }, { a: '1', b: '9', d: '4' })).toEqual({
    changed: ['b'],
    added: ['d'],
    removed: ['c'],
    same: ['a'],
  })
})
