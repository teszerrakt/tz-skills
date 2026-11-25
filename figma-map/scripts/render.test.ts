import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
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
  expect(out).toContain('<div class="kick">P1</div><div class="stick"><h2 class="h2">Page header</h2>')
  expect(out).toContain('<h3 class="h3"><span class="code">P1.1</span>Upload button</h3>')
  expect(out).toContain('<h3 class="h3"><span class="code">P2.1</span>Bank card</h3>')
  expect(out).toContain('<h3 class="h3"><span class="code">S1</span>Bank card</h3>')
  expect(out).toContain('<span>P2.1 Bank card</span>')
})

test('a map of several pages numbers pages P1, components P1.2, sub-components P1.2.3', () => {
  const out = html('# Page: List\n## Table\n# Page: Detail\n## Header\n## Panel\n### Tabs\n')
  expect(out).toContain('<div class="kick">P2</div><div class="stick"><h2 class="h2">Detail</h2>')
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
    '<div class="v-body no-shot"><div><div class="blk ix"><div class="lab">Interaction</div><ul><li>Submit → <span class="m m-post">POST</span> <code>/unlock</code></li></ul></div>',
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
  expect(out).toContain('<div class="row" id="d1"><div class="n">D1</div><div class="c">Zero is &quot;0,00&quot;</div>')
  expect(out).toContain('<div class="st"><span class="tg tg-con">Conflict</span></div>')
  expect(out).toContain('<span>D Decision list</span>')
  expect(out).not.toContain('Question list')
})

test('a list row without its D/Q code is a warning', () => {
  expect(warnings('# Questions\n| # | Question | Answer | Status |\n|---|---|---|---|\n| 1 | Who? | Ana | Settled |\n')).toEqual([
    'Question list row "1 | Who? | Ana | Settled" does not start with a Q<n> code, or its own list letter such as T2',
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

test('GH/ expands to the pinned blob base; a remote crop keeps its URL', () => {
  const out = html('# Page: P\n## C 🟢 reuse [Button](GH/ui/button.tsx)\n#### A\n![row](https://cdn.example/row.png)')
  expect(out).toContain('src="https://cdn.example/row.png"')
  expect(out).toContain('🟢 reuse <a href="https://github.com/o/r/blob/abc123/ui/button.tsx">Button</a>')
})

const withCrop = () => {
  const factBase = mkdtempSync(join(tmpdir(), 'figma-map-'))
  mkdirSync(join(factBase, 'img/crops'), { recursive: true })
  writeFileSync(join(factBase, 'img/crops/row.png'), 'png-bytes')
  return factBase
}
const CROPS = '# Page: P\n## C\n#### A\n![row](img/crops/row.png)\n#### B\n![gone](img/crops/gone.png)'

test('a crop is referenced by its path beside the page and listed for the files map, never built in', () => {
  const factBase = withCrop()
  const result = render(CROPS, { ...options, factBase })
  expect(result.html).toContain('src="img/crops/row.png"')
  expect(result.html).not.toContain('data:image')
  expect(result.files).toEqual({ 'img/crops/row.png': join(factBase, 'img/crops/row.png') })
  expect(result.warnings).toEqual(['image img/crops/gone.png is not on disk'])
})

test('a page written outside the fact base gets its crops copied beside it', () => {
  const factBase = withCrop()
  const pageDir = mkdtempSync(join(tmpdir(), 'figma-map-page-'))
  const result = render(CROPS, { ...options, factBase, pageDir })
  expect(result.files).toEqual({ 'img/crops/row.png': join(pageDir, 'img/crops/row.png') })
  expect(readFileSync(join(pageDir, 'img/crops/row.png'), 'utf8')).toBe('png-bytes')
})

test('two different crops that would publish under one path are a warning', () => {
  const factBase = withCrop()
  const other = mkdtempSync(join(tmpdir(), 'figma-map-other-'))
  writeFileSync(join(other, 'row.png'), 'other-bytes')
  const md = `# Page: P\n## C\n#### A\n![a](${join(factBase, 'img/crops/row.png')})\n#### B\n![b](${join(other, 'row.png')})`
  expect(render(md, { ...options, factBase }).warnings).toEqual(['two crops publish as img/row.png'])
})

test('--local keeps absolute file paths for html_render and lists nothing to publish', () => {
  const factBase = withCrop()
  const result = render(CROPS, { ...options, factBase, local: true })
  expect(result.html).toContain(`src="${join(factBase, 'img/crops/row.png')}"`)
  expect(result.files).toEqual({})
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

test('an item heading and its review strip sit in one sticky bar', () => {
  const out = html(ONE_PAGE)
  expect(out).toContain('<div class="stick"><h3 class="h3"><span class="code">P1.1</span>Upload button</h3><div class="rv" data-rv=')
})

test('a REST method before a path becomes a badge, in prose and in code', () => {
  const out = html('# Page: P\n## C\n- Save → PATCH …/drafts/:id, then `POST /submit`; GETS stays text\n')
  expect(out).toContain('Save → <span class="m m-patch">PATCH</span> …/drafts/:id, then <span class="m m-post">POST</span> <code>/submit</code>; GETS stays text')
})

test('a cited list code links to its row; a cited code with no row is a warning', () => {
  const md = `# Page: P\n## C\n- Both boxes needed (Q16), audit per T2\n# Questions\n| # | Question | Answer | Status |\n|---|---|---|---|\n| Q16 | When? | Reconciled only | Settled |\n`
  const result = render(md, options)
  expect(result.html).toContain('Both boxes needed (<a class="xref" href="#q16">Q16</a>), audit per T2')
  expect(result.html).toContain('<div class="row" id="q16"><div class="n">Q16</div>')
  expect(result.warnings).toEqual(['T2 is cited but no Decision or Question row has that code'])
})

test('a drawn variant or heading without a crop is a warning; a Not drawn one is not', () => {
  const md = '# Page: P\n## Header {1:2}\n#### Toast {1:3}\n- Copy: "Saved"\n#### Retry limit {1:4} {Not drawn}\n- Notes: none\n'
  expect(warnings(md)).toEqual([
    '"Header" is drawn at 1:2 but has no crop under its heading',
    'variant "Toast" is drawn at 1:3 but has no crop; only a {Not drawn} row goes without one',
  ])
})

test('the page carries a generator stamp naming the host and the fact base by repo and slug', () => {
  const out = html('# Page: P\n## C\n', { stamp: { version: '0.6.0', host: 'tz-pc', factBase: 'klay/bank-reconciliation' } })
  expect(out).toStartWith('<meta name="figma-map" content="render.ts 0.6.0; host=tz-pc; fact-base=klay/bank-reconciliation">\n<title>')
  expect(html('# Page: P\n## C\n')).toStartWith('<title>')
})
