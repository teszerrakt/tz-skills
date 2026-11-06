import { expect, test } from 'bun:test'
import { findSharedCandidates, type ContainerSample } from './candidates.ts'

const sample = (
  screen: string,
  flow: string,
  id: string,
  name: string,
  childNames: string[],
  ancestors: string[] = [],
): ContainerSample => ({
  screen,
  flow,
  id,
  name,
  childNames,
  w: 720,
  h: 200,
  screenW: 1366,
  ancestors,
})

test('a structure repeated across two flows is a candidate; one repeated within a single flow is not', () => {
  const candidates = findSharedCandidates([
    sample('s1', 'detail', 'a1', 'Audit Trail', ['Document Name', 'Rule']),
    sample('s2', 'edit', 'a2', 'Audit Trail', ['Document Name', 'Rule']),
    sample('s1', 'detail', 'b1', 'Card', ['Title', 'Body']),
    sample('s3', 'detail', 'b2', 'Card', ['Title', 'Body']),
  ])
  expect(candidates).toEqual([
    {
      signature: 'Audit Trail > Document Name, Rule',
      flows: ['detail', 'edit'],
      nodes: [
        { screen: 's1', id: 'a1', w: 720, h: 200 },
        { screen: 's2', id: 'a2', w: 720, h: 200 },
      ],
    },
  ])
})

test('a candidate inside another candidate is dropped: the outer one is the component', () => {
  const candidates = findSharedCandidates([
    sample('s1', 'detail', 'p1', 'Panel', ['Tabs', 'Title']),
    sample('s2', 'edit', 'p2', 'Panel', ['Tabs', 'Title']),
    sample('s1', 'detail', 't1', 'Tabs', ['Tab', 'Tab'], ['p1']),
    sample('s2', 'edit', 't2', 'Tabs', ['Tab', 'Tab'], ['p2']),
  ])
  expect(candidates.map((c) => c.signature)).toEqual(['Panel > Tabs, Title'])
})

const small = (screen: string, flow: string) => ({ ...sample(screen, flow, screen, 'Chip', ['Avatar', 'Name']), w: 120, h: 32 })

const shell = (screen: string, flow: string) => ({ ...sample(screen, flow, screen, 'Content', ['Navigation Bar', 'Right']), w: 1366 })
const card = (screen: string, flow: string, ancestor: string) =>
  sample(screen, flow, `${screen}-card`, 'Card', ['Title', 'Body'], [ancestor])

test('a container nearly as wide as the screen is page layout and never a candidate', () => {
  const candidates = findSharedCandidates([shell('s1', 'a'), shell('s2', 'b'), card('s1', 'a', 's1'), card('s2', 'b', 's2')])
  expect(candidates.map((c) => c.signature)).toEqual(['Card > Title, Body'])
})

test('small containers are primitives and never candidates', () => {
  expect(findSharedCandidates([small('s1', 'a'), small('s2', 'b')])).toEqual([])
})
