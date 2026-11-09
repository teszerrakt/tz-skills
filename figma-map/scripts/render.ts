#!/usr/bin/env bun
// Renders design-map.md to the page the Artifact tool publishes: its own <title> and theme-aware styles, no doctype or
// <head> (the Artifact tool adds those), tables that scroll inside their own box, and a gutter that holds at phone width.
//   bun scripts/render.ts <fact-base> <in.md> <out.html> --file <figma file key> --gh <github blob base>/<sha>
//                         [--inline] [--images <map.json>] [--title <page title>]
// --inline builds each crop into the page as a data: URI. --images maps an image path (img/crops/x.png) to an
// uploaded URL instead, for a page whose crops would pass the Artifact size limit.
// Prints the bytes written and every warning; exits 1 when there is any warning.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { slugify } from './lib/names.ts'
import type { SourceLine } from './lib/types.ts'

export type RenderOptions = {
  factBase: string
  fileKey: string
  githubBase: string
  /** Image path in the markdown → URL to use instead. */
  images?: Record<string, string>
  inline?: boolean
  title?: string
}

export type Rendered = { html: string; warnings: string[] }

const SHARED_HEADING = /^Shared components$/i

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The component's name, before its badge, marker or "(shared)": the part an anchor is built from. */
export function componentName(heading: string): string {
  return heading.split(/\s*(?:🟢|🟡|🔴|\(|\{|—|→)/u)[0].trim()
}

export function anchorFor(heading: string): string {
  return slugify(componentName(heading.replace(/^Page:\s*/, '').replace(/\[\d+\]/g, '')))
}

export function parseSources(block: string): Map<string, SourceLine> {
  const sources = new Map<string, SourceLine>()
  for (const match of block.matchAll(/^\[(\d+)\]\s+(\S+)(?:\s+—\s+(.*))?$/gm)) {
    sources.set(match[1], { n: Number(match[1]), url: match[2], label: match[3] ?? match[2] })
  }
  return sources
}

class PageBuilder {
  private readonly out: string[] = []
  private readonly warnings = new Set<string>()
  private readonly anchors = new Set<string>()
  private readonly anchorLinks = new Set<string>()
  private listDepth = -1
  private table: string[][] | null = null
  private inShared = false

  constructor(
    private readonly options: RenderOptions,
    private readonly sources: Map<string, SourceLine>,
  ) {}

  private figmaUrl(nodeId: string) {
    return `https://www.figma.com/design/${this.options.fileKey}/?node-id=${nodeId.replace(':', '-')}`
  }

  private imageSource(path: string): string {
    const mapped = this.options.images?.[path]
    if (mapped) return mapped
    if (/^(https?:|data:)/.test(path)) return path
    const file = path.startsWith('/') ? path : join(this.options.factBase, path)
    if (!existsSync(file)) {
      this.warnings.add(`image ${path} is not on disk`)
      return file
    }
    if (!this.options.inline) return file
    return `data:image/png;base64,${readFileSync(file).toString('base64')}`
  }

  private reference(n: string): string {
    const source = this.sources.get(n)
    if (!source) {
      this.warnings.add(`[${n}] has no Sources line`)
      return `[${n}]`
    }
    return `<a class="ref" href="${source.url}">[${n}]</a>`
  }

  /** One line of markdown text → HTML: images, links, [n] references, {node} markers, bold and code. */
  inline(text: string): string {
    let html = escapeHtml(text).replace(/\bGH\//g, `${this.options.githubBase}/`)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, path) => `<img src="${this.imageSource(path)}" alt="${alt}">`)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      if (href.startsWith('#')) this.anchorLinks.add(href.slice(1))
      return `<a href="${href}">${label}</a>`
    })
    html = html.replace(/\[(\d+)\](?![^<]*<\/a>)/g, (_, n) => this.reference(n))
    html = html.replace(/\{(\d+[:-]\d+)\}/g, (_, id) => `<a class="fig" href="${this.figmaUrl(id)}">Figma ↗</a>`)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    return html.replace(/`([^`]+)`/g, '<code>$1</code>')
  }

  private closeLists() {
    while (this.listDepth >= 0) {
      this.out.push('</li></ul>')
      this.listDepth--
    }
  }

  private listItem(depth: number, text: string) {
    if (depth > this.listDepth) {
      this.out.push('<ul><li>'.repeat(depth - this.listDepth))
      this.listDepth = depth
    } else {
      while (this.listDepth > depth) {
        this.out.push('</li></ul>')
        this.listDepth--
      }
      this.out.push('</li><li>')
    }
    this.out.push(this.inline(text))
  }

  private tableRow(line: string) {
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())
    if (cells.every((c) => /^:?-+:?$/.test(c))) return
    this.closeLists()
    this.table = this.table ?? []
    this.table.push(cells)
  }

  /** A four-column table (name · what changes · image · source) reads as two on a phone: the source rides the name, the image sits under the text. */
  private flushTable() {
    if (!this.table) return
    const [head, ...rows] = this.table
    this.table = null
    const fourColumns = head.length === 4
    const headCells = fourColumns ? head.slice(0, 2) : head
    const rowCells = (row: string[]) => {
      if (!fourColumns) return row.map((c) => this.inline(c))
      const image = row[2] && row[2] !== '—' ? this.inline(row[2]) : ''
      return [`${this.inline(row[0])} ${this.inline(row[3] ?? '')}`.trim(), `${this.inline(row[1])}${image}`]
    }
    const headHtml = `<tr>${headCells.map((c) => `<th>${this.inline(c)}</th>`).join('')}</tr>`
    const bodyHtml = rows
      .map(
        (r) =>
          `<tr>${rowCells(r)
            .map((c) => `<td>${c}</td>`)
            .join('')}</tr>`,
      )
      .join('')
    this.out.push(`<div class="tw"><table>${headHtml}${bodyHtml}</table></div>`)
  }

  private heading(level: number, text: string) {
    this.closeLists()
    if (level === 1) this.inShared = SHARED_HEADING.test(text)
    let id = ''
    if (level === 1 && text.startsWith('Page:')) id = `page-${anchorFor(text)}`
    else if (this.inShared && (level === 2 || level === 3)) id = anchorFor(text)
    if (id) {
      if (this.anchors.has(id)) this.warnings.add(`two headings share the anchor #${id}`)
      this.anchors.add(id)
    }
    this.out.push(`<h${level}${id ? ` id="${id}"` : ''}>${this.inline(text)}</h${level}>`)
  }

  private paragraph(line: string) {
    this.closeLists()
    if (line.startsWith('> ')) this.out.push(`<div class="banner">${this.inline(line.slice(2))}</div>`)
    else if (line.startsWith('![')) this.out.push(this.inline(line))
    else this.out.push(`<p>${this.inline(line)}</p>`)
  }

  addLine(line: string) {
    if (line.startsWith('|')) return this.tableRow(line)
    this.flushTable()
    const heading = line.match(/^(#{1,4}) (.*)/)
    const item = line.match(/^( *)- (.*)/)
    if (heading) this.heading(heading[1].length, heading[2])
    else if (item) this.listItem(Math.floor(item[1].length / 2), item[2])
    else if (/^\s+!\[/.test(line) && this.listDepth >= 0) this.out.push(this.inline(line.trim()))
    else if (line.trim()) this.paragraph(line)
  }

  finish(): Rendered {
    this.flushTable()
    this.closeLists()
    if (this.sources.size) {
      const items = [...this.sources.values()].map((s) => `<li value="${s.n}"><a href="${s.url}">${escapeHtml(s.label)}</a></li>`)
      this.out.push(`<h1>Sources</h1><ol>${items.join('')}</ol>`)
    }
    for (const link of this.anchorLinks) if (!this.anchors.has(link)) this.warnings.add(`a link points at #${link}, which no heading has`)
    const title = this.options.title ?? 'Design map'
    return { html: `${pageHead(title)}<main>${this.out.join('')}</main>\n`, warnings: [...this.warnings] }
  }
}

export function render(markdown: string, options: RenderOptions): Rendered {
  const [body, sourcesBlock = ''] = markdown.split(/^## Sources\s*$/m)
  const page = new PageBuilder(options, parseSources(sourcesBlock))
  for (const line of body.split(/\r?\n/)) page.addLine(line)
  return page.finish()
}

/** The page's title, fonts and theme. Every color is a token, redefined for dark mode by system setting and by toggle. */
function pageHead(title: string): string {
  return `<title>${escapeHtml(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* Layout: one reading column; each page opens with a rule and a condensed heading; tables scroll in their own box. */
:root{
  --bg:#fbfbfa;--fg:#1d2128;--muted:#5d6572;--line:#dde1e6;--panel:#f0f2f4;--accent:#1f5fbf;--crop-bg:#ffffff;
  --f-display:"IBM Plex Sans Condensed","Arial Narrow",system-ui,sans-serif;
  --f-body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#14171c;--fg:#e4e7eb;--muted:#9aa3ae;--line:#2c323b;--panel:#1c2027;--accent:#7fb0ff;--crop-bg:#ffffff;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#14171c;--fg:#e4e7eb;--muted:#9aa3ae;--line:#2c323b;--panel:#1c2027;--accent:#7fb0ff;--crop-bg:#ffffff;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 var(--f-body)}
main{max-width:860px;margin:0 auto;padding-block:24px 48px;padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}
.banner{padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:6px;font-size:14px}
h1,h2,h3,h4{text-wrap:balance;line-height:1.25}
h1{font:600 22px/1.25 var(--f-display);margin:40px 0 4px;padding-top:16px;border-top:2px solid var(--fg)}
h2{font-size:17px;font-weight:600;margin:24px 0 6px}
h3{font-size:15px;font-weight:600;margin:18px 0 4px}
h4{font-size:12px;font-weight:600;margin:14px 0 4px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
p{margin:4px 0;max-width:70ch}
ul{padding-left:20px;margin:6px 0;max-width:70ch}li{margin:2px 0}
img{display:block;max-width:100%;height:auto;margin:8px 0;border:1px solid var(--line);border-radius:4px;background:var(--crop-bg)}
.tw{overflow-x:auto;margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{background:var(--panel);font-weight:600}
td:first-child{width:30%}td img{margin:6px 0 0}
a{color:var(--accent)}a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
a.ref{font:12px var(--f-mono);text-decoration:none;font-variant-numeric:tabular-nums}
a.fig{font:500 11px var(--f-body);margin-left:8px;padding:1px 6px;border:1px solid var(--line);border-radius:4px;text-decoration:none;vertical-align:middle;white-space:nowrap}
code{font:13px var(--f-mono)}
ol{padding-left:36px;font-size:13px;color:var(--muted)}ol li{overflow-wrap:anywhere}
</style>
`
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}

function main(argv: string[]) {
  const [factBase, input, output] = argv
  const fileKey = flag(argv, 'file')
  const githubBase = flag(argv, 'gh')
  if (!factBase || !input || !output || !fileKey || !githubBase) {
    console.error(
      'usage: bun scripts/render.ts <fact-base> <in.md> <out.html> --file <figma file key> --gh <github blob base>/<sha> [--inline] [--images <map.json>] [--title <title>]',
    )
    process.exit(2)
  }
  const imagesFile = flag(argv, 'images')
  const images = imagesFile ? (JSON.parse(readFileSync(imagesFile, 'utf8')) as Record<string, string>) : undefined
  const { html, warnings } = render(readFileSync(input, 'utf8'), {
    factBase,
    fileKey,
    githubBase,
    images,
    inline: argv.includes('--inline'),
    title: flag(argv, 'title'),
  })
  writeFileSync(output, html)
  console.log(`${output}: ${html.length} bytes, ${warnings.length} warnings`)
  for (const warning of warnings) console.log(`  ${warning}`)
  if (warnings.length) process.exit(1)
}

if (import.meta.main) main(process.argv.slice(2))
