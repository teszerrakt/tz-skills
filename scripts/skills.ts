// The plugin's skills and agents as data: what each document names, and which skills a changed file affects.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

export const PLUGIN = 'tz-skills'
const MANIFEST = '.claude-plugin/plugin.json'

export type Doc = { path: string; text: string }
export type Skill = { name: string; dir: string; docs: Doc[] }
export type Agent = { name: string; path: string; text: string }
export type Plugin = { root: string; skills: Skill[]; agents: Agent[] }

export function loadPlugin(root: string): Plugin {
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')) as { skills?: string[] }
  const skills = (manifest.skills ?? []).map((entry) => {
    const dir = normalize(entry).replace(/\/$/, '')
    return { name: dir.split('/').pop() ?? dir, dir, docs: markdownUnder(root, dir) }
  })
  const agentsDir = join(root, 'agents')
  const agents = existsSync(agentsDir)
    ? readdirSync(agentsDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => ({ name: file.slice(0, -3), path: `agents/${file}`, text: readFileSync(join(agentsDir, file), 'utf8') }))
    : []
  return { root, skills, agents }
}

function markdownUnder(root: string, dir: string): Doc[] {
  const found: Doc[] = []
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(root, rel)).toSorted()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const path = `${rel}/${entry}`
      if (statSync(join(root, path)).isDirectory()) walk(path)
      else if (entry.endsWith('.md')) found.push({ path, text: readFileSync(join(root, path), 'utf8') })
    }
  }
  if (existsSync(join(root, dir))) walk(dir)
  // SKILL.md first: it is the document every run reads.
  return found.toSorted((a, b) => Number(b.path.endsWith('/SKILL.md')) - Number(a.path.endsWith('/SKILL.md')))
}

export function frontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([\w-]+):\s*(.*)$/)
    if (field) fields[field[1]] = field[2].replace(/^["']|["']$/g, '')
  }
  return fields
}

export const words = (text: string) => text.split(/\s+/).filter(Boolean).length

export type Mention = { line: number; name: string }

function mentions(text: string, pattern: RegExp): Mention[] {
  const found: Mention[] = []
  text.split('\n').forEach((line, index) => {
    // An agent file's own `name:` line names itself, bare by design.
    if (line.startsWith('name:')) return
    for (const match of line.matchAll(pattern)) found.push({ line: index + 1, name: match[1] })
  })
  return found
}

const escape = (names: string[]) => names.toSorted((a, b) => b.length - a.length).map((n) => n.replace(/[-.]/g, '\\$&'))

/** `/tz-skills:<name>` commands and `tz-skills:<name>` agents a document names. */
export const qualified = (text: string) => mentions(text, new RegExp(`(?<![\\w-])/?${PLUGIN}:([a-z0-9-]+)`, 'g'))

/** A skill named as a bare command (`/ship`), which does not resolve inside a plugin. */
export function bareCommands(text: string, skills: string[]): Mention[] {
  if (skills.length === 0) return []
  return mentions(text, new RegExp(`(?<![\\w:./~>-])/(${escape(skills).join('|')})(?![\\w/-]|\\.\\w)`, 'g'))
}

/** An agent named without the plugin prefix. A path such as `agents/x.md` is not a name. */
export function bareAgents(text: string, agents: string[]): Mention[] {
  if (agents.length === 0) return []
  return mentions(text, new RegExp(`(?<![\\w:/-])(${escape(agents).join('|')})(?![\\w-]|\\.md)`, 'g'))
}

/** Repo-relative files a document points at: markdown links, and backticked `references/` or `scripts/` paths. */
export function pointers(doc: Doc, skillDir: string): Mention[] {
  const found: Mention[] = []
  doc.text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
      const target = match[1].split('#')[0]
      // A template's placeholder link (`{figma-url}`, `<id>`, `…`) points at nothing yet.
      if (!target || /^[a-z]+:/i.test(target) || /[{<…]/.test(target)) continue
      found.push({ line: index + 1, name: normalize(join(dirname(doc.path), target)) })
    }
    for (const match of line.matchAll(/`((?:references|scripts)\/[\w./-]+)`/g)) {
      found.push({ line: index + 1, name: normalize(join(skillDir, match[1])) })
    }
  })
  return found
}

const opensBlock = (line: string) => /^\s*(#|\||>|<|[-*+] |\d+[.)] |```|~~~|---|!\[)/.test(line) || /^( {4}|\t)/.test(line)

/**
 * Hard-wrapped lines: a prose line that continues the line above instead of starting a block.
 * Skill markdown keeps one paragraph or list item per line.
 */
export function hardWraps(text: string): number[] {
  const lines = text.split('\n')
  const wrapped: number[] = []
  let fenced = false
  let start = 0
  if (lines[0] === '---') start = lines.indexOf('---', 1) + 1

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (fenced || i === start) continue
    const above = lines[i - 1]
    const aboveIsText = above.trim() !== '' && !/^\s*(#|\||```|~~~|---|<)/.test(above) && !/( {2}|\\)$/.test(above)
    if (aboveIsText && line.trim() !== '' && !opensBlock(line)) wrapped.push(i + 1)
  }
  return wrapped
}

/** Skills whose behaviour a change to these repo-relative files can alter, named ones and the skills that name them. */
export function affected(plugin: Plugin, changed: string[]): string[] {
  if (changed.includes(MANIFEST)) return plugin.skills.map((s) => s.name).toSorted()

  const hit = new Set<string>()
  for (const skill of plugin.skills) {
    const owns = changed.some((file) => file === skill.dir || file.startsWith(`${skill.dir}/`))
    const points = skill.docs.some((doc) => pointers(doc, skill.dir).some((p) => changed.includes(p.name)))
    const agents = changed.filter((f) => f.startsWith('agents/')).map((f) => f.slice('agents/'.length, -'.md'.length))
    const namesAgent = skill.docs.some((doc) => qualified(doc.text).some((m) => agents.includes(m.name)))
    if (owns || points || namesAgent) hit.add(skill.name)
  }

  // A skill that names an affected skill drives it, so a change to `ship` reaches `ship-epic`.
  let grew = true
  while (grew) {
    grew = false
    for (const skill of plugin.skills) {
      if (hit.has(skill.name)) continue
      if (skill.docs.some((doc) => qualified(doc.text).some((m) => hit.has(m.name)))) {
        hit.add(skill.name)
        grew = true
      }
    }
  }
  return [...hit].toSorted()
}
