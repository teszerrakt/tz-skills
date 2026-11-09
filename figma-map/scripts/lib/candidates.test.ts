import { expect, test } from 'bun:test'
import { findSharedCandidates, type ContainerSample } from './candidates.ts'

const sample = (screen: string, flow: string, id: string, name: string, childNames: string[], text = ''): ContainerSample => ({
  screen,
  flow,
  id,
  name,
  childNames,
  text,
  w: 720,
  h: 200,
  screenW: 1366,
  screenH: 900,
})

const card = (screen: string, flow: string, id: string, text: string) => sample(screen, flow, id, 'Audit Trail', ['Document Name'], text)

const bar = (screen: string, flow: string) => ({ ...sample(screen, flow, `${screen}-bar`, 'Summary Row', ['Button']), w: 1366, h: 72 })

const column = (screen: string, flow: string) => ({ ...sample(screen, flow, `${screen}-col`, 'Right', ['Content']), w: 1366, h: 900 })

const wrapper = (screen: string, flow: string) => ({ ...sample(screen, flow, `${screen}-w`, 'Content', ['Nav', 'Right']), w: 1366 })

const chip = (screen: string, flow: string) => ({ ...sample(screen, flow, screen, 'Chip', ['Avatar', 'Name']), w: 120, h: 32 })

test('a container repeated across two flows is a candidate; one repeated within a single flow is not', () => {
  const candidates = findSharedCandidates([
    sample('s1', 'detail', 'a1', 'Panel', ['Tabs', 'Body']),
    sample('s2', 'edit', 'a2', 'Panel', ['Tabs', 'Body']),
    sample('s1', 'detail', 'b1', 'Card', ['Title', 'Body']),
    sample('s3', 'detail', 'b2', 'Card', ['Title', 'Body']),
  ])
  expect(candidates).toEqual([
    {
      signature: 'Panel',
      flows: ['detail', 'edit'],
      shapes: [{ text: '', children: ['Tabs', 'Body'], size: '720×200', ids: ['a1', 'a2'] }],
    },
  ])
})

test('same-named containers with different first texts are one candidate with a shape each', () => {
  const [candidate] = findSharedCandidates([
    card('s1', 'detail', 't1', 'Trigger'),
    card('s1', 'detail', 'g1', 'Approval Gate'),
    card('s2', 'edit', 't2', 'Trigger'),
    card('s2', 'edit', 'g2', 'Approval Gate'),
    card('s3', 'edit', 'g3', 'Approval Gate'),
  ])
  expect(candidate.signature).toBe('Audit Trail')
  expect(candidate.shapes.map((s) => [s.text, s.ids])).toEqual([
    ['Approval Gate', ['g1', 'g2', 'g3']],
    ['Trigger', ['t1', 't2']],
  ])
})

test('when the first text is data, shapes go by children alone', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    sample(`s${i}`, i % 2 ? 'a' : 'b', `r${i}`, 'Vendor Item', ['Avatar', 'Name'], `Vendor ${i}`),
  )
  const [candidate] = findSharedCandidates(rows)
  expect(candidate.shapes).toHaveLength(1)
  expect(candidate.shapes[0].ids).toHaveLength(8)
})

test('a generic name groups only containers with the same children', () => {
  const candidates = findSharedCandidates([
    sample('s1', 'a', 'x1', 'Container', ['Tab', 'Container']),
    sample('s2', 'b', 'x2', 'Container', ['Tab', 'Container']),
    sample('s1', 'a', 'y1', 'Container', ['Title', 'Body']),
    sample('s3', 'a', 'y2', 'Container', ['Title', 'Body']),
  ])
  expect(candidates.map((c) => c.signature)).toEqual(['Container > Tab, Container'])
})

test('a full-width named bar is a candidate; a full-width column or a generic wrapper is page layout', () => {
  const candidates = findSharedCandidates([
    bar('s1', 'a'),
    bar('s2', 'b'),
    column('s1', 'a'),
    column('s2', 'b'),
    wrapper('s1', 'a'),
    wrapper('s2', 'b'),
  ])
  expect(candidates.map((c) => c.signature)).toEqual(['Summary Row'])
})

test('small containers are primitives and never candidates', () => {
  expect(findSharedCandidates([chip('s1', 'a'), chip('s2', 'b')])).toEqual([])
})
