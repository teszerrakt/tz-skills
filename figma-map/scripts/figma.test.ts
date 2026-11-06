import { expect, test } from 'bun:test'
import { buildScript, checkArgs, SCRIPTS, wrapForFigma } from './figma.ts'

test('arguments are checked before anything is compiled', () => {
  expect(checkArgs('dump', { ids: ['8118:43846'], base: '8118:43846' })).toEqual([])
  expect(checkArgs('dump', { ids: [], base: '8118:43846' })).toEqual(['ids: a non-empty list of screen ids is required'])
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
  const args = { section: '1:2', ids: ['1:2'], base: '1:2', nodes: ['1:3'], targets: ['1:4'], screens: [{ id: '1:2', flow: 'a' }] }
  for (const name of SCRIPTS) {
    const script = await buildScript(name, args)
    expect(script).toStartWith('const ARGS = ')
    expect(script).toEndWith('(ARGS));')
    expect(script).not.toMatch(/^\s*(import|export)\b/m)
  }
})
