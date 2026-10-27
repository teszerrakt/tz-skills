import { expect, test } from 'bun:test'
import { parseToastOutput } from './toast.ts'

test('a choice and typed words come back together', () => {
  expect(parseToastOutput('choice: Yes\r\ntext: only on mobile\r\n')).toEqual({ kind: 'answered', choice: 'Yes', note: 'only on mobile' })
})

test('typed words alone are an answer', () => {
  expect(parseToastOutput('text: neither\n')).toEqual({ kind: 'answered', choice: '', note: 'neither' })
})

test('open and later pass through', () => {
  expect(parseToastOutput('open\n')).toEqual({ kind: 'open' })
  expect(parseToastOutput('later\n')).toEqual({ kind: 'later' })
})

test('nothing printed, as from a killed script, is a timeout', () => {
  expect(parseToastOutput('')).toEqual({ kind: 'timeout' })
})
