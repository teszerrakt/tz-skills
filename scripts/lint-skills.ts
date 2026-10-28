#!/usr/bin/env bun
// Checks the plugin's skills, agents and eval cases. Exits 1 on any error; warnings print but pass.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { bareAgents, bareCommands, frontmatter, hardWraps, loadPlugin, pointers, qualified, words, type Plugin } from './skills.ts'

// Anthropic's skill-creator caps SKILL.md at 500 lines; skills here never hard-wrap, so 500 lines is about 5,000 words.
export const FAIL_WORDS = 5000
// The largest skill in mattpocock/skills and cursor/plugins' pstack.
export const WARN_WORDS = 3000

export type Problem = { level: 'error' | 'warn'; at: string; message: string }

export function lint(plugin: Plugin): Problem[] {
  const problems: Problem[] = []
  const error = (at: string, message: string) => problems.push({ level: 'error', at, message })
  const skillNames = plugin.skills.map((s) => s.name)
  const agentNames = plugin.agents.map((a) => a.name)
  const known = new Set([...skillNames, ...agentNames])

  for (const entry of readdirSync(plugin.root)) {
    if (existsSync(join(plugin.root, entry, 'SKILL.md')) && !skillNames.includes(entry)) {
      error(`${entry}/SKILL.md`, 'is not listed in .claude-plugin/plugin.json, so the plugin never ships it')
    }
  }

  for (const skill of plugin.skills) {
    const main = skill.docs.find((doc) => doc.path === `${skill.dir}/SKILL.md`)
    if (!main) {
      error(skill.dir, 'is listed in plugin.json but holds no SKILL.md')
      continue
    }
    const fields = frontmatter(main.text)
    if (fields?.name !== skill.name) error(main.path, `frontmatter name must be "${skill.name}", the folder's name`)
    if (!fields?.description) error(main.path, 'frontmatter needs a description: it is what triggers the skill')
    else if (fields.description.length > 1024) error(main.path, `description is ${fields.description.length} characters; the cap is 1024`)

    const count = words(main.text)
    const size = `is ${count} words; move what only some runs need into references/`
    if (count > FAIL_WORDS) error(main.path, `${size} (limit ${FAIL_WORDS})`)
    else if (count > WARN_WORDS) problems.push({ level: 'warn', at: main.path, message: `${size} (warning above ${WARN_WORDS})` })

    for (const doc of skill.docs) {
      checkDoc(doc.path, doc.text)
      for (const pointer of pointers(doc, skill.dir)) {
        if (!existsSync(join(plugin.root, pointer.name)))
          error(`${doc.path}:${pointer.line}`, `points at ${pointer.name}, which does not exist`)
      }
    }
  }

  for (const agent of plugin.agents) {
    const fields = frontmatter(agent.text)
    if (fields?.name !== agent.name) error(agent.path, `frontmatter name must be "${agent.name}", the file's name`)
    if (!fields?.description) error(agent.path, 'frontmatter needs a description')
    checkDoc(agent.path, agent.text)
  }

  lintEvals(plugin, skillNames, error)
  return problems

  function checkDoc(path: string, text: string) {
    for (const line of hardWraps(text)) error(`${path}:${line}`, 'continues the line above: keep one paragraph or list item per line')
    for (const m of bareCommands(text, skillNames))
      error(`${path}:${m.line}`, `names /${m.name}; inside a plugin only /tz-skills:${m.name} resolves`)
    for (const m of bareAgents(text, agentNames))
      error(`${path}:${m.line}`, `names agent ${m.name}; inside a plugin only tz-skills:${m.name} resolves`)
    for (const m of qualified(text)) {
      if (!known.has(m.name)) error(`${path}:${m.line}`, `names tz-skills:${m.name}, which no skill or agent here provides`)
    }
  }
}

/** Every eval case is tagged with the skills it exercises, so a push runs only the cases its change can break. */
function lintEvals(plugin: Plugin, skillNames: string[], error: (at: string, message: string) => void) {
  const evals = join(plugin.root, 'evals')
  if (!existsSync(evals)) return
  for (const name of readdirSync(evals)) {
    const path = `evals/${name}/case.yaml`
    if (name === 'results' || !existsSync(join(plugin.root, path))) continue
    const tags = readFileSync(join(plugin.root, path), 'utf8').match(/^tags:\s*\[([^\]]*)\]/m)
    const named =
      tags?.[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean) ?? []
    if (named.length === 0) error(path, 'needs `tags: [<skill>, …]` naming the skills it exercises')
    for (const tag of named) if (!skillNames.includes(tag)) error(path, `tag "${tag}" is not a skill in this plugin`)
  }
}

if (import.meta.main) {
  const problems = lint(loadPlugin(resolve(import.meta.dir, '..')))
  for (const p of problems) console.log(`${p.level === 'error' ? 'ERROR' : 'WARN '} ${p.at} ${p.message}`)
  const errors = problems.filter((p) => p.level === 'error').length
  console.log(`\n${errors} error(s), ${problems.length - errors} warning(s)`)
  process.exit(errors ? 1 : 0)
}
