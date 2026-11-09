import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { findTaggedResult, newer, recentTranscripts, saveDump, transcriptRoot } from './save-result.ts'
import type { FlowDump } from './lib/types.ts'

const call = (id: string, code: string) =>
  JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name: 'mcp__claude_ai_Figma__use_figma', input: { code } }] },
  })
const result = (id: string, text: string, timestamp = '2026-11-09T10:00:00Z') =>
  JSON.stringify({
    type: 'user',
    timestamp,
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] },
  })

test('the newest call with the tag wins, and its result is returned as sent', () => {
  const transcript = [
    call('t1', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'),
    result('t1', '{"old":true}'),
    call('t2', '// figma-map-tag: dump-edit-2\nconst ARGS = {}'),
    result('t2', '{"other":true}'),
    call('t3', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'),
    result('t3', '{"new":true}'),
  ].join('\n')
  expect(findTaggedResult(transcript, 'dump-edit-1')?.text).toBe('{"new":true}')
})

test('the same call logged again after its result keeps that result', () => {
  const transcript = [
    call('t1', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'),
    result('t1', '{"ok":true}'),
    call('t1', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'),
  ].join('\n')
  expect(findTaggedResult(transcript, 'dump-edit-1')?.text).toBe('{"ok":true}')
})

const tagged = (stamp: string, text: string) =>
  findTaggedResult([call('t', '// figma-map-tag: dump-edit-1\nconst ARGS = {}'), result('t', text, stamp)].join('\n'), 'dump-edit-1')

test('across transcripts the newest result wins, so an earlier run with the same tag never does', () => {
  const today = tagged('2026-11-09T10:00:00Z', 'today')
  const yesterday = tagged('2026-11-08T10:00:00Z', 'yesterday')
  expect(newer(today, yesterday)?.text).toBe('today')
  expect(newer(yesterday, today)?.text).toBe('today')
})

test('a tag that only appears inside a script, not as its first line, does not match', () => {
  const transcript = [call('t1', 'const x = "// figma-map-tag: dump-edit-1"'), result('t1', '{}')].join('\n')
  expect(findTaggedResult(transcript, 'dump-edit-1')).toBeNull()
})

test('transcripts are searched newest first, only those changed in the last day', () => {
  const root = mkdtempSync(join(tmpdir(), 'figma-map-transcripts-'))
  mkdirSync(join(root, 'project', 'session', 'subagents'), { recursive: true })
  const older = join(root, 'project', 'session.jsonl')
  const recent = join(root, 'project', 'session', 'subagents', 'agent-1.jsonl')
  const stale = join(root, 'project', 'stale.jsonl')
  for (const path of [older, recent, stale]) writeFileSync(path, '')
  const now = Date.now()
  utimesSync(older, new Date(now - 60_000), new Date(now - 60_000))
  utimesSync(stale, new Date(now - 3 * 86_400_000), new Date(now - 3 * 86_400_000))
  expect(recentTranscripts(root, now)).toEqual([recent, older])
})

test('the transcript root follows CLAUDE_CONFIG_DIR', () => {
  expect(transcriptRoot({ CLAUDE_CONFIG_DIR: '/home/me/.claude-work' })).toBe('/home/me/.claude-work/projects')
})

test("a dump call splits into one raw file per flow; a continued flow appends, keeping a screen's first reading", () => {
  const fb = mkdtempSync(join(tmpdir(), 'figma-map-fb-'))
  const base = { id: '1:1', name: 'S', h: 1, sig: 's', texts: [], annotations: [], clicks: [], instances: [], outline: [] }
  expect(
    saveDump(fb, { flows: { a: { base, deltas: [{ id: '1:2', error: 'missing' }] }, b: { base: { ...base, id: '2:1' }, deltas: [] } } }),
  ).toEqual(['raw/a.json: 2 screens', 'raw/b.json: 1 screens'])
  saveDump(fb, {
    flows: {
      a: {
        deltas: [
          { id: '1:2', error: 'again' },
          { id: '1:3', error: 'missing' },
        ],
      },
    },
  })
  const a = JSON.parse(readFileSync(join(fb, 'raw', 'a.json'), 'utf8')) as FlowDump
  expect(a.deltas).toEqual([
    { id: '1:2', error: 'missing' },
    { id: '1:3', error: 'missing' },
  ])
  expect(() => saveDump(fb, { flows: { c: { deltas: [] } } })).toThrow('raw/c.json does not exist yet')
  expect(existsSync(join(fb, 'raw', 'c.json'))).toBe(false)
})
