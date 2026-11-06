import { expect, test } from 'bun:test'
import { bareOutline, buildOutline, type NodeLike } from './outline.ts'

const frame = (id: string, name: string, children: NodeLike[] = []): NodeLike => ({ id, name, type: 'FRAME', children })

test('a generic wrapper around two named containers is kept: it is a region such as a side panel', () => {
  const screen = frame('1', 'Screen', [frame('2', 'Container', [frame('3', 'Tab'), frame('4', 'Title')])])
  expect(buildOutline(screen)).toEqual([{ 'Container#2': ['Tab#3', 'Title#4'] }])
})

test('a generic wrapper around one container is see-through', () => {
  const screen = frame('1', 'Screen', [frame('2', 'Frame 12', [frame('3', 'Summary Row')])])
  expect(buildOutline(screen)).toEqual(['Summary Row#3'])
})

test('an instance is a leaf, and hidden layers are left out', () => {
  const instance: NodeLike = { id: '5', name: 'Input Field', type: 'INSTANCE', children: [frame('6', 'Inner')] }
  const hidden: NodeLike = { ...frame('7', 'Header'), visible: false }
  expect(buildOutline(frame('1', 'Screen', [instance, hidden]))).toEqual(['Input Field#5'])
})

test('the bare outline drops ids, so two screens with the same structure compare equal', () => {
  expect(bareOutline([{ 'Panel#1:4': ['Input#1:5'] }])).toBe(bareOutline([{ 'Panel#9:4': ['Input#9:5'] }]))
})
