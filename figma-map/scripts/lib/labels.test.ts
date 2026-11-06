import { expect, test } from 'bun:test'
import { groupFlows, separateCopy, type ScreenBox } from './labels.ts'
import type { Label } from './types.ts'

const screen = (id: string, x: number, y: number): ScreenBox => ({
  id,
  name: 'Approval Workflow',
  x,
  y,
  w: 1366,
  h: 768,
  ann: 0,
  clicks: 0,
})
const label = (text: string, x: number, y: number, w: number): Label => ({ x, y, w, h: 60, name: 'Label', text })

test('the outermost band names the flow; the bands and labels nested under it name the page', () => {
  const screens = [screen('bill-1', 2000, 2000), screen('bill-2', 3500, 2000), screen('inv-1', 5000, 2000)]
  const labels = [
    label('Detail Page -- Configured', 2000, 1800, 5000),
    label('Bill', 2000, 1880, 2866),
    label('Invoices', 5000, 1880, 1700),
    label('1 Approver', 2000, 1940, 1366),
    label('>1 Approver', 3500, 1940, 1366),
    label('1 Approver', 5000, 1940, 1366),
  ]
  const [flow] = groupFlows(screens, labels)
  expect(flow.name).toBe('Detail Page -- Configured')
  expect(flow.slug).toBe('detail-page-configured')
  expect(flow.screens.map((s) => s.page)).toEqual(['Bill › 1 Approver', 'Bill › >1 Approver', 'Invoices › 1 Approver'])
})

test('a label with a row of screens between it and the screen does not name that screen', () => {
  const screens = [screen('row-1', 2000, 3300), screen('row-2', 2000, 4400)]
  const labels = [label('Edit', 2000, 3150, 4000), label('Add Threshold', 2000, 3220, 1366)]
  const [edit] = groupFlows(screens, labels)
  expect(edit.screens.map((s) => [s.id, s.page])).toEqual([
    ['row-1', 'Add Threshold'],
    ['row-2', null],
  ])
})

test('a label that reads like a sentence is copy, never a name', () => {
  const { names, copy } = separateCopy([
    label('One after another, in this order. Drag to reorder.', 0, 0, 900),
    label('When the user clicks on another menu', 0, 0, 900),
    label('Add Threshold', 0, 0, 900),
  ])
  expect(names.map((l) => l.text)).toEqual(['When the user clicks on another menu', 'Add Threshold'])
  expect(copy.map((l) => l.text)).toEqual(['One after another, in this order. Drag to reorder.'])
})

test('screens with no label are grouped by row, each row named after its first screen', () => {
  const flows = groupFlows([screen('a', 0, 0), screen('b', 1500, 20), screen('c', 0, 1000)], [])
  expect(flows.map((f) => f.screens.map((s) => s.id))).toEqual([['a', 'b'], ['c']])
  expect(flows[0].name).toBe('Approval Workflow (row at y 0)')
})
