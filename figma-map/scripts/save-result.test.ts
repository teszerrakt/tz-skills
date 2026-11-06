import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendDeltas, findTaggedResult, recentTranscripts, transcriptRoot } from './save-result.ts'
import type { FlowDump } from './lib/types.ts'

const call = (id: string, code: string) =>
  JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name: 'mcp__claude_ai_Figma__use_figma', input: { code } }] },
  })
const result = (id: string, text: string) =>
  JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] } })

test('the newest call with the tag wins, and its result is returned as sent', () => {
  const transcript = [
    call('t1', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'),
    result('t1', '{"old":true}'),
    call('t2', '// figma-map-tag: dump-edit-2\nconst ARGS = {}'),
    result('t2', '{"other":true}'),
    call('t3', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'),
    result('t3', '{"new":true}'),
  ].join('\n')
  expect(findTaggedResult(transcript, 'dump-edit-1')).toBe('{"new":true}')
})

test('a tag that only appears inside a script, not as its first line, does not match', () => {
  const transcript = [call('t1', 'const x = "// figma-map-tag: dump-edit-1"'), result('t1', '{}')].join('\n')
  expect(findTaggedResult(transcript, 'dump-edit-1')).toBeNull()
})

test('transcripts are searched newest first, only those changed in the last day', () => {
  const root = mkdtempSync(join(tmpdir(), 'figma-map-transcripts-'))
  mkdirSync(join(root, 'project', 'session', 'subagents'), { recursive: true })
  const older = join(root, 'project', 'session.jsonl')
  const newer = join(root, 'project', 'session', 'subagents', 'agent-1.jsonl')
  const stale = join(root, 'project', 'stale.jsonl')
  for (const path of [older, newer, stale]) writeFileSync(path, '')
  const now = Date.now()
  utimesSync(older, new Date(now - 60_000), new Date(now - 60_000))
  utimesSync(stale, new Date(now - 3 * 86_400_000), new Date(now - 3 * 86_400_000))
  expect(recentTranscripts(root, now)).toEqual([newer, older])
})

test('the transcript root follows CLAUDE_CONFIG_DIR', () => {
  expect(transcriptRoot({ CLAUDE_CONFIG_DIR: '/home/me/.claude-work' })).toBe('/home/me/.claude-work/projects')
})

test('a later dump chunk adds its deltas to the flow; a screen read twice keeps its first reading', () => {
  const base = { id: '1:1', name: 'S', h: 1, sig: 's', texts: [], annotations: [], clicks: [], instances: [], outline: [] }
  const first: FlowDump = { base, deltas: [{ id: '1:2', error: 'missing' }] }
  const second: FlowDump = {
    base,
    deltas: [
      { id: '1:2', error: 'again' },
      { id: '1:3', error: 'missing' },
    ],
  }
  expect(appendDeltas(first, second).deltas).toEqual([
    { id: '1:2', error: 'missing' },
    { id: '1:3', error: 'missing' },
  ])
  expect(() => appendDeltas(first, { base: { ...base, id: '9:9' }, deltas: [] })).toThrow()
})
