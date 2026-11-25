import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { anchorFor, render, type RenderOptions } from './render.ts'

const options: RenderOptions = { factBase: '/fb', fileKey: 'KEY', githubBase: 'https://github.com/o/r/blob/abc123' }
const html = (md: string, extra: Partial<RenderOptions> = {}) => render(md, { ...options, ...extra }).html
const warnings = (md: string, extra: Partial<RenderOptions> = {}) => render(md, { ...options, ...extra }).warnings

const ONE_PAGE = `# Page: Bank reconciliation
## Page header
### Upload button
## Bank cards
### Bank card → [shared](#bank-card) — variant "In Progress"
# Shared components
## Bank card 🔴 new
`

test('a single-page map drops the page level: components P1, P2, their parts P1.1, shared S1', () => {
  const out = html(ONE_PAGE)
  expect(out).toContain('<div class="kick">P1</div><h2 class="h2">Page header</h2>')
  expect(out).toContain('<h3 class="h3"><span class="code">P1.1</span>Upload button</h3>')
  expect(out).toContain('<h3 class="h3"><span class="code">P2.1</span>Bank card</h3>')
  expect(out).toContain('<h3 class="h3"><span class="code">S1</span>Bank card</h3>')
  expect(out).toContain('<span>P2.1 Bank card</span>')
})

test('a map of several pages numbers pages P1, components P1.2, sub-components P1.2.3', () => {
  const out = html('# Page: List\n## Table\n# Page: Detail\n## Header\n## Panel\n### Tabs\n')
  expect(out).toContain('<div class="kick">P2</div><h2 class="h2">Detail</h2>')
  expect(out).toContain('<span class="code">P2.2</span>Panel</h3>')
  expect(out).toContain('<h4 class="h4"><span class="code">P2.2.1</span>Tabs</h4>')
  expect(out).toContain('class="rs rs2" data-nav="page-detail--panel--tabs"')
})

test('a part on a shared component links "variants in S<n>"; an inline [shared] link shows the code', () => {
  const out = html(`${ONE_PAGE.replace('## Bank cards', '## Bank cards\n- Uses: [shared](#bank-card)')}`)
  expect(out).toContain('Shared component, variant “In Progress” · <a href="#bank-card">variants in S1 →</a>')
  expect(out).toContain('Uses: <a href="#bank-card">S1</a>')
  expect(out).toContain('id="bank-card"')
})

test('a variant card has name, status tag and Figma link on top, then the three labelled blocks', () => {
  const md = `# Page: P
## Modal
#### Wrong password {9089:488307} {Conflict}
- Interaction
  - Submit → \`POST /unlock\`
- Copy: "Wrong password. Try again."
- Notes
  - Frame shows the password in clear text
`
  const out = html(md)
  expect(out).toContain(
    '<div class="v-head"><span class="vname">Wrong password</span><span class="tg tg-con">Conflict</span><a class="fig" href="https://www.figma.com/design/KEY/?node-id=9089-488307">Figma ↗</a></div>',
  )
  expect(out).toContain(
    '<div class="v-body no-shot"><div><div class="blk ix"><div class="lab">Interaction</div><ul><li>Submit → <code>POST /unlock</code></li></ul></div>',
  )
  expect(out).toContain('<div class="lab">Copy</div><ul><li>&quot;Wrong password. Try again.&quot;</li></ul>')
  expect(out).toContain('<div class="blk notes"><div class="lab">Notes</div>')
})

test('a variant with a crop puts the crop beside its blocks', () => {
  const out = html('# Page: P\n## Modal\n#### Empty\n![Empty](https://cdn.example/e.png)\n- Copy: "Nothing yet"\n')
  expect(out).toContain(
    '<div class="v-body"><div><img class="shot" loading="lazy" src="https://cdn.example/e.png" alt="Empty"></div><div><div class="blk copy">',
  )
})

test("a rules table puts each rule's status in its own column", () => {
  const out = html('# Page: P\n## Upload\n- Rules\n  - One upload at a time\n  - {New} Period fields\n')
  expect(out).toContain('<table class="k"><tr><td style="width:104px"></td><td>One upload at a time</td></tr>')
  expect(out).toContain('<td style="width:104px"><span class="tg tg-new">New</span></td><td>Period fields</td>')
})

test('every component, part, shared item and list carries a review strip and is a comment target', () => {
  const out = html(
    `${ONE_PAGE}# Decisions\n| # | Decision | Figma today | Status |\n|---|---|---|---|\n| D1 | Zero is "0,00" | "00,00" | Conflict |\n`,
  )
  for (const id of [
    'page-bank-reconciliation--page-header',
    'page-bank-reconciliation--page-header--upload-button',
    'bank-card',
    'decisions',
  ]) {
    expect(out).toContain(`id="${id}" data-comment-target`)
    expect(out).toContain(`<div class="rv" data-rv="${id}">`)
  }
  expect(out).toContain('<div class="rows" style="--narrow:48px minmax(0, 1fr);--wide:48px minmax(0, 1fr) minmax(0, 1fr) 100px">')
  expect(out).toContain('<div class="row"><div class="n">D1</div><div class="c">Zero is &quot;0,00&quot;</div>')
  expect(out).toContain('<div class="st"><span class="tg tg-con">Conflict</span></div>')
  expect(out).toContain('<span>D Decision list</span>')
  expect(out).not.toContain('Question list')
})

test('a list row without its D/Q code is a warning', () => {
  expect(warnings('# Questions\n| # | Question | Answer | Status |\n|---|---|---|---|\n| 1 | Who? | Ana | Settled |\n')).toEqual([
    'Question list row "1 | Who? | Ana | Settled" does not start with a Q<n> code',
  ])
})

test('the old States table and stray bullets under a variant are warnings', () => {
  expect(warnings('# Page: P\n## C\n#### States\n#### Empty\n- "No rows"\n')).toEqual([
    '"#### States" is the old table shape; write one "#### <variant>" block per row',
    'variant "Empty": bullet ""No rows"" is not under Interaction, Copy or Notes',
  ])
})

test('copy placeholders in braces stay copy, not tags', () => {
  const out = html('# Page: P\n## C\n- "{bank description} is reconciled"')
  expect(out).toContain('<li>&quot;{bank description} is reconciled&quot;</li>')
})

test('[n] links to its Sources line; an [n] with no line is a warning', () => {
  const md = '# Page: P\n## C\n- Click → opens [2] [7]\n\n## Sources\n[2] https://figma.example/2 — annotation "Click -> Open Details"'
  const result = render(md, options)
  expect(result.html).toContain('<a class="cite" href="https://figma.example/2">[2]</a>')
  expect(result.html.indexOf('<h2 class="h2">Sources</h2>')).toBeGreaterThan(result.html.indexOf('opens'))
  expect(result.warnings).toEqual(['[7] has no Sources line'])
})

test('an image map swaps local paths for uploaded URLs; GH/ expands to the pinned blob base', () => {
  const out = html('# Page: P\n## C 🟢 reuse [Button](GH/ui/button.tsx)\n![row](img/crops/row.png)', {
    images: { 'img/crops/row.png': 'https://cdn.example/row.png' },
  })
  expect(out).toContain('src="https://cdn.example/row.png"')
  expect(out).toContain('🟢 reuse <a href="https://github.com/o/r/blob/abc123/ui/button.tsx">Button</a>')
})

test('--inline builds a crop into the page; a crop missing from disk is a warning', () => {
  const factBase = mkdtempSync(join(tmpdir(), 'figma-map-'))
  mkdirSync(join(factBase, 'img/crops'), { recursive: true })
  writeFileSync(join(factBase, 'img/crops/row.png'), 'png-bytes')
  const md = '# Page: P\n## C\n#### A\n![row](img/crops/row.png)\n#### B\n![gone](img/crops/gone.png)'
  const result = render(md, { ...options, factBase, inline: true })
  expect(result.html).toContain(`src="data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}"`)
  expect(result.warnings).toEqual(['image img/crops/gone.png is not on disk'])
})

test('nested bullets close back to the right depth', () => {
  expect(html('# Page: P\n## C\n- a\n  - b\n    - c\n- d')).toContain(
    '<ul class="items"><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul>',
  )
})

test('a link to no heading is a warning, and so are two headings with one anchor', () => {
  expect(warnings('# Page: P\n## C\n- [shared](#side-panl)\n## C\n')).toEqual([
    'two headings share the anchor #page-p--c',
    'a link points at #side-panl, which no heading has',
  ])
})

test('an anchor is the component name before its badge, marker or "(shared)"', () => {
  expect(anchorFor('Approval Gate card (shared, inferred) 🔴 new {8118:43786}')).toBe('approval-gate-card')
  expect(anchorFor('Page: Transaction approval detail [4]')).toBe('transaction-approval-detail')
  expect(anchorFor('Page: Edit workflow — add threshold [1] [2]')).toBe('edit-workflow-add-threshold')
})

test('the banner becomes the lede and meta row; the page carries its title, theme switch and dark tokens', () => {
  const out = html('> What the flows cover.\n- 12 screens → 1 page\n', { title: 'Bank Reconciliation' })
  expect(out.startsWith('<title>Bank Reconciliation Map</title>')).toBe(true)
  expect(out).not.toContain('<!doctype')
  expect(out).toContain(
    '<h1 class="title">Bank Reconciliation</h1><p class="lede">What the flows cover.</p><div class="meta"><span>12 screens → 1 page</span></div>',
  )
  expect(out).toContain('<ui-segmented-control id="theme" class="theme" aria-label="Theme" default-value="system">')
  expect(out).toContain('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"])')
  expect(out).toContain(':root[data-theme="dark"]')
  expect(out).toContain('padding-left: max(16px, env(safe-area-inset-left, 0px))')
  expect(out).toContain('db.collection("reviews")')
  expect(out).toContain('comments.openComposer({ element: el })')
})

test('the page loads ui-sdk from browser/ beside it, and its rail pins the review head above a list that scrolls', () => {
  const out = html(ONE_PAGE, { title: 'Bank Reconciliation' })
  expect(out).toContain('<script type="module" src="browser/web.js"></script>\n<link rel="stylesheet" href="browser/web.css">')
  expect(out).toContain('<ui-collapsible id="toc" default-open>')
  expect(out).toContain('<div class="rail-pin"><div class="rail-head"><div class="kick">Review</div>')
  expect(out).toContain('<div class="rail-scroll"><div class="kick">Page</div>')
  expect(out).toContain('<ui-checkbox data-id="page-bank-reconciliation--page-header" aria-label="Mark P1 reviewed" disabled>')
  expect(out).toContain('<ui-dialog id="zoom">')
})
