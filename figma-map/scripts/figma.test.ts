import { expect, test } from 'bun:test'
import { buildScript, checkArgs, planDump, SCRIPTS, wrapForFigma } from './figma.ts'
import type { FlowInventory } from './lib/types.ts'

test('arguments are checked before anything is compiled', () => {
  expect(checkArgs('dump', { flows: [{ slug: 'edit', ids: ['8118:43846'], base: '8118:43846' }] })).toEqual([])
  expect(checkArgs('dump', { flows: [{ slug: 'edit', ids: [], base: '8118:43846' }] })).toEqual([
    'flows: each needs "slug", "base" (the flow\'s first screen) and a non-empty "ids"',
  ])
  expect(checkArgs('inventory', { section: '8118-43676' })).toEqual([])
  expect(checkArgs('locate', { base: '1:1', nodes: ['nope'], targets: ['1:2'] })).toEqual([
    'ids: "nope" is not a Figma node id like "8118:43846"',
  ])
  expect(checkArgs('candidates', { screens: [{ id: '1:1' }] })).toEqual(['screens: a non-empty list of { "id", "flow" } is required'])
  expect(checkArgs('dump', [])).toEqual(['--args must be a JSON object'])
})

test('the export line becomes a call whose result returns as JSON, under the tag line and ARGS', () => {
  const script = wrapForFigma('async function m(a){return a}\nexport{m as main};', { section: '1:2' }, 'inv-1')
  expect(script.split('\n')).toEqual([
    '// figma-map-tag: inv-1',
    'const ARGS = {"section":"1:2"};',
    'async function m(a){return a}',
    'return JSON.stringify(await m(ARGS));',
  ])
})

test('every Figma-side script compiles to plain JS with no import or export left', async () => {
  const args = {
    section: '1:2',
    flows: [{ slug: 'a', ids: ['1:2'], base: '1:2' }],
    base: '1:2',
    nodes: ['1:3'],
    targets: ['1:4'],
    screens: [{ id: '1:2', flow: 'a' }],
  }
  for (const name of SCRIPTS) {
    const script = await buildScript(name, args)
    expect(script).toStartWith('const ARGS = ')
    expect(script).toEndWith('(ARGS));')
    expect(script).not.toMatch(/^\s*(import|export)\b/m)
  }
})

const flow = (slug: string, n: number) => ({ name: slug, slug, screens: Array.from({ length: n }, (_, i) => ({ id: `${slug}:${i}` })) })

test('a dump plan packs whole flows into calls; a flow split across calls returns its base once', () => {
  const inventory = { flows: [flow('a', 2), flow('b', 4), flow('c', 1)] } as unknown as FlowInventory
  expect(planDump(inventory, ['a', 'b', 'c'], 4)).toEqual([
    [
      { slug: 'a', base: 'a:0', ids: ['a:0', 'a:1'] },
      { slug: 'b', base: 'b:0', ids: ['b:0', 'b:1'] },
    ],
    [
      { slug: 'b', base: 'b:0', ids: ['b:2', 'b:3'], withBase: false },
      { slug: 'c', base: 'c:0', ids: ['c:0'] },
    ],
  ])
  expect(() => planDump(inventory, ['nope'])).toThrow('no flow "nope"')
})
