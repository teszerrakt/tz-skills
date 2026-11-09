import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { anchorFor, render, type RenderOptions } from './render.ts'

const options: RenderOptions = { factBase: '/fb', fileKey: 'KEY', githubBase: 'https://github.com/o/r/blob/abc123' }
const html = (md: string, extra: Partial<RenderOptions> = {}) => render(md, { ...options, ...extra }).html
const warnings = (md: string, extra: Partial<RenderOptions> = {}) => render(md, { ...options, ...extra }).warnings

test('a heading marker becomes a Figma link to that node', () => {
  expect(html('## Payment picker 🔴 new {8118:49658}')).toContain(
    '<h2>Payment picker 🔴 new <a class="fig" href="https://www.figma.com/design/KEY/?node-id=8118-49658">Figma ↗</a></h2>',
  )
})

test('[n] links to its Sources line, and Sources render last', () => {
  const out = html('- Click → opens [2]\n\n## Sources\n[2] https://figma.example/2 — annotation "Click -> Open Details"')
  expect(out).toContain('<a class="ref" href="https://figma.example/2">[2]</a>')
  expect(out.indexOf('<h1>Sources</h1>')).toBeGreaterThan(out.indexOf('opens'))
})

test('an [n] with no Sources line is a warning', () => {
  expect(warnings('- opens [7]\n\n## Sources\n[1] https://figma.example/1')).toEqual(['[7] has no Sources line'])
})

test('a four-column variants table renders as two columns in a scroll box, the image under the text', () => {
  const out = html(
    '| Variant | What changes | Image | Source |\n|---|---|---|---|\n| Empty | "No payments" | ![e](img/crops/e.png) | [1] |\n| Typed | one row | — | [1] |',
  )
  expect(out).toContain('<div class="tw"><table><tr><th>Variant</th><th>What changes</th></tr>')
  expect(out).toContain('<td>"No payments"<img src="/fb/img/crops/e.png" alt="e"></td>')
  expect(out).toContain('<td>one row</td>')
})

test('an image map swaps local paths for uploaded URLs; GH/ expands to the pinned blob base', () => {
  const out = html('![row](img/crops/row.png) [Button](GH/ui/button.tsx)', {
    images: { 'img/crops/row.png': 'https://cdn.example/row.png' },
  })
  expect(out).toContain('src="https://cdn.example/row.png"')
  expect(out).toContain('href="https://github.com/o/r/blob/abc123/ui/button.tsx"')
})

test('--inline builds a crop into the page; a crop missing from disk is a warning', () => {
  const factBase = mkdtempSync(join(tmpdir(), 'figma-map-'))
  mkdirSync(join(factBase, 'img/crops'), { recursive: true })
  writeFileSync(join(factBase, 'img/crops/row.png'), 'png-bytes')
  const result = render('![row](img/crops/row.png)\n![gone](img/crops/gone.png)', { ...options, factBase, inline: true })
  expect(result.html).toContain(`src="data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}"`)
  expect(result.warnings).toEqual(['image img/crops/gone.png is not on disk'])
})

test('nested bullets close back to the right depth', () => {
  expect(html('- a\n  - b\n    - c\n- d')).toContain('<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul>')
})

test('shared headings get anchors a page entry can link to; a link to no heading is a warning', () => {
  const md =
    '# Page: Bill [1]\n- Uses: Action bar → [shared](#action-bar)\n- Side panel → [shared](#side-panl)\n# Shared components\n## Action bar 🟢 reuse {1:2}\n\n## Sources\n[1] https://figma.example/1'
  const result = render(md, options)
  expect(result.html).toContain('<h1 id="page-bill">')
  expect(result.html).toContain('<h2 id="action-bar">Action bar 🟢 reuse')
  expect(result.warnings).toEqual(['a link points at #side-panl, which no heading has'])
})

test('an anchor is the component name before its badge, marker or "(shared)"', () => {
  expect(anchorFor('Approval Gate card (shared, inferred) 🔴 new {8118:43786}')).toBe('approval-gate-card')
  expect(anchorFor('Page: Transaction approval detail [4]')).toBe('transaction-approval-detail')
})

test('a page anchor keeps the whole name, so pages named "<flow> — <step>" do not collide', () => {
  expect(anchorFor('Page: Edit workflow — add threshold [1] [2]')).toBe('edit-workflow-add-threshold')
  expect(anchorFor('Page: Edit workflow — reorder approvers [3]')).toBe('edit-workflow-reorder-approvers')
})

test('the page carries its own title and a theme that redefines every color for dark mode', () => {
  const out = html('> banner', { title: 'Approval Workflow Design Map' })
  expect(out.startsWith('<title>Approval Workflow Design Map</title>')).toBe(true)
  expect(out).not.toContain('<!doctype')
  expect(out).toContain('@media (prefers-color-scheme: dark){:root:not([data-theme="light"])')
  expect(out).toContain(':root[data-theme="dark"]')
  expect(out).toContain('padding-left:max(16px, env(safe-area-inset-left, 0px))')
})
