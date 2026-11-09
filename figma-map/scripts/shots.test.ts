import { expect, test } from 'bun:test'
import { findShots, parsePairs } from './shots.ts'

const call = (id: string, nodeId: string) =>
  JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name: 'mcp__claude_ai_Figma__get_screenshot', input: { nodeId } }] },
  })
const result = (id: string, url: string) =>
  JSON.stringify({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: id,
          content: [{ type: 'text', text: `{"image_url":"${url}","width":800,"height":450,"format":"png"}` }],
        },
      ],
    },
  })

test('each node id gets its newest screenshot; nodes not asked for are skipped', () => {
  const transcript = [
    call('a', '1:2'),
    result('a', 'u-old'),
    call('b', '1:3'),
    result('b', 'u-other'),
    call('c', '1:2'),
    result('c', 'u-new'),
  ].join('\n')
  const shots = findShots(transcript, new Set(['1:2']))
  expect([...shots]).toEqual([['1:2', { url: 'u-new', width: 800, height: 450 }]])
})

test('pairs are <node id>=<name>, with an optional .png', () => {
  expect([...parsePairs(['8118:1=edit-gate.png', 'I1:2;3:4=side'])]).toEqual([
    ['8118:1', 'edit-gate'],
    ['I1:2;3:4', 'side'],
  ])
  expect(() => parsePairs(['8118:1'])).toThrow('is not <node id>=<name>')
})
