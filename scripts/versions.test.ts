import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { shipped, unbumped } from './versions.ts'

const plugins = [
  { name: 'tz-skills', manifest: '.claude-plugin/plugin.json', paths: ['ship', 'agents'] },
  { name: 'show-media', manifest: 'plugins/show-media/.claude-plugin/plugin.json', paths: ['plugins/show-media'] },
]
const was = (v: string | undefined) => () => v

test('a shipped change under the same version is caught; a bump clears it', () => {
  expect(unbumped(plugins, ['ship/SKILL.md'], was('0.2.0'), () => '0.2.0')).toEqual(['tz-skills'])
  expect(unbumped(plugins, ['agents/tz-fresh-reviewer.md'], was('0.2.0'), () => '0.1.9')).toEqual(['tz-skills'])
  expect(unbumped(plugins, ['ship/SKILL.md'], was('0.2.0'), () => '0.2.1')).toEqual([])
})

test('tooling, a look-alike folder and a new plugin need no bump', () => {
  expect(unbumped(plugins, ['scripts/evals.ts', 'docs/authoring.md', 'evals/x/case.yaml'], was('0.2.0'), () => '0.2.0')).toEqual([])
  expect(unbumped(plugins, ['ship-epic/SKILL.md'], was('0.2.0'), () => '0.2.0')).toEqual([])
  expect(unbumped(plugins, ['plugins/show-media/index.ts'], was(undefined), () => '0.1.0')).toEqual([])
})

test('the repo-rooted plugin ships its skills and agents; a sub-folder plugin ships its folder', () => {
  const [own, media] = shipped(resolve(import.meta.dir, '..'))
  expect(own?.paths).toContain('ship')
  expect(own?.paths).toContain('agents')
  expect(own?.paths).not.toContain('scripts')
  expect(media?.paths).toEqual(['plugins/show-media'])
})
