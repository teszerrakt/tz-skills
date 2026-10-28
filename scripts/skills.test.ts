import { afterAll, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { quotaOnly } from './evals.ts'
import { lint } from './lint-skills.ts'
import { affected, bareAgents, bareCommands, hardWraps, loadPlugin } from './skills.ts'

const root = mkdtempSync(join(tmpdir(), 'tz-skills-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function write(path: string, text: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}

const skill = (name: string, body: string) => `---\nname: ${name}\ndescription: Does ${name}.\n---\n\n${body}\n`

write('.claude-plugin/plugin.json', JSON.stringify({ name: 'tz-skills', skills: ['./ship', './ship-epic', './spec-review', './standup'] }))
write(
  'ship/SKILL.md',
  skill('ship', 'Run `/tz-skills:spec-review`, then spawn `tz-skills:tz-fresh-reviewer`. Read [the loop](references/review-loop.md).'),
)
write('ship/references/review-loop.md', '# Review loop\n\nWait on the bot.\n')
write('ship-epic/SKILL.md', skill('ship-epic', 'Spawn `/tz-skills:ship` per ticket.'))
write('spec-review/SKILL.md', skill('spec-review', 'Judge the diff.'))
write('standup/SKILL.md', skill('standup', 'Draft the standup.'))
write('agents/tz-fresh-reviewer.md', '---\nname: tz-fresh-reviewer\ndescription: Judges.\n---\n\nRead only.\n')
const plugin = loadPlugin(root)

test('a change to a skill reaches every skill that names it, transitively', () => {
  expect(affected(plugin, ['spec-review/SKILL.md'])).toEqual(['ship', 'ship-epic', 'spec-review'])
})

test('a reference file belongs to its skill', () => {
  expect(affected(plugin, ['ship/references/review-loop.md'])).toEqual(['ship', 'ship-epic'])
})

test('a changed agent affects the skills that name it', () => {
  expect(affected(plugin, ['agents/tz-fresh-reviewer.md'])).toEqual(['ship', 'ship-epic'])
})

test('an unrelated skill stays out', () => {
  expect(affected(plugin, ['standup/SKILL.md'])).toEqual(['standup'])
})

test('the manifest affects every skill', () => {
  expect(affected(plugin, ['.claude-plugin/plugin.json'])).toHaveLength(4)
})

test('the plugin as written lints clean', () => {
  expect(lint(plugin)).toEqual([])
})

test('a bare command is an error; a path and a qualified name are not', () => {
  const text = 'Run `/ship` now. See docs/ship-design.md, `/tz-skills:ship`, and > <dir>/spec-review.md'
  expect(bareCommands(text, ['ship', 'spec-review']).map((m) => m.name)).toEqual(['ship'])
})

test('a bare agent is an error; its file path and its own name line are not', () => {
  const text = 'name: tz-fresh-reviewer\nSpawn tz-fresh-reviewer.\nSee agents/tz-fresh-reviewer.md and tz-skills:tz-fresh-reviewer.'
  expect(bareAgents(text, ['tz-fresh-reviewer'])).toEqual([{ line: 2, name: 'tz-fresh-reviewer' }])
})

test('a hard-wrapped paragraph is caught; blocks and fences are not', () => {
  const text = [
    '---',
    'name: x',
    '---',
    '# Title',
    'One paragraph that',
    'wraps here.',
    '',
    '- a list item',
    '- another',
    '| a | b |',
    '|---|---|',
    '```',
    'code line one',
    'code line two',
    '```',
  ].join('\n')
  expect(hardWraps(text)).toEqual([6])
})

test('a skill over the word limit fails, and a missing pointer target fails', () => {
  write('standup/SKILL.md', skill('standup', `${'word '.repeat(5001)}\n\nRead \`references/missing.md\`.`))
  const problems = lint(loadPlugin(root)).map((p) => `${p.level} ${p.at}`)
  expect(problems).toContain('error standup/SKILL.md')
  expect(problems).toContain('error standup/SKILL.md:8')
  write('standup/SKILL.md', skill('standup', 'Draft the standup.'))
})

const run = (...arms: object[][]) => ({ cases: arms.map((runs, i) => ({ name: `case-${i}`, arms: { with: runs as never } })) })

test('a run that failed only on quota is told apart from one that failed a case', () => {
  const quota = { passed: false, error: "exit 1: You've hit your session limit · resets 11:10pm (Asia/Jakarta)" }
  const graded = { passed: false, error: null }
  const pass = { passed: true }
  expect(quotaOnly(run([quota, quota], [pass]))).toEqual(['case-0'])
  expect(quotaOnly(run([quota], [graded]))).toBeUndefined()
  expect(quotaOnly(run([pass]))).toBeUndefined()
})

test('a judge refused for quota counts as quota; a judge that voted FAIL does not', () => {
  const judgeRefused = {
    passed: false,
    error: null,
    graders: [{ passed: false, explanation: "grader threw: judge call failed: You've hit your 5-hour limit" }],
  }
  const judgeFailed = { passed: false, error: null, graders: [{ passed: false, explanation: 'judge votes: FAIL FAIL FAIL' }] }
  const timedOut = { passed: false, error: 'timeout after 300s', graders: [] }
  expect(quotaOnly(run([judgeRefused]))).toEqual(['case-0'])
  expect(quotaOnly(run([judgeRefused, judgeFailed]))).toBeUndefined()
  expect(quotaOnly(run([timedOut]))).toBeUndefined()
})
