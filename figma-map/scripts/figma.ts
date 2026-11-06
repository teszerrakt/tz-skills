#!/usr/bin/env bun
// Prints a Figma-side script ready to paste into use_figma: its arguments checked, bundled with its imports, compiled
// to plain JS and wrapped so the result comes back as JSON. The compiled text is never saved.
//   bun scripts/figma.ts <inventory|dump|locate|candidates> --args '<json>' [--tag <tag>]
// --tag puts a "// figma-map-tag: <tag>" first line in the script, so save-result.ts can find this call's result.
import { join } from 'node:path'

export const SCRIPTS = ['inventory', 'dump', 'locate', 'candidates'] as const
export type ScriptName = (typeof SCRIPTS)[number]

export const TAG_PREFIX = '// figma-map-tag: '

type Check = (args: Record<string, unknown>) => string[]

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isString)
const NODE_ID = /^I?\d+[:-]\d+(;\d+[:-]\d+)*$/

function nodeIdProblems(field: string, ids: string[]): string[] {
  return ids.filter((id) => !NODE_ID.test(id)).map((id) => `${field}: "${id}" is not a Figma node id like "8118:43846"`)
}

/** What each script needs in ARGS; each check returns its problems, empty when the arguments are usable. */
const CHECKS: Record<ScriptName, Check> = {
  inventory: (a) => (isString(a.section) ? nodeIdProblems('section', [a.section]) : ['section: a node id is required']),
  dump: (a) => {
    if (!isStringList(a.ids)) return ['ids: a non-empty list of screen ids is required']
    if (!isString(a.base)) return ["base: the flow's first screen id is required"]
    if (a.sigOnly !== undefined && typeof a.sigOnly !== 'boolean') return ['sigOnly: true or false']
    return nodeIdProblems('ids', [...a.ids, a.base])
  },
  locate: (a) => {
    if (!isString(a.base)) return ['base: the screen whose node ids you hold is required']
    if (!isStringList(a.nodes)) return ['nodes: a non-empty list of node ids in the base screen is required']
    if (!isStringList(a.targets)) return ['targets: a non-empty list of screen ids is required']
    return nodeIdProblems('ids', [a.base, ...a.nodes, ...a.targets])
  },
  candidates: (a) => {
    const screens = a.screens
    const valid = Array.isArray(screens) && screens.length > 0 && screens.every((s) => isString(s?.id) && isString(s?.flow))
    return valid ? [] : ['screens: a non-empty list of { "id", "flow" } is required']
  },
}

export function checkArgs(script: ScriptName, args: unknown): string[] {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return ['--args must be a JSON object']
  return CHECKS[script](args as Record<string, unknown>)
}

/** Bundles the script with the lib modules it imports, as one plain-JS text. */
async function bundle(script: ScriptName): Promise<string> {
  const entry = join(import.meta.dir, 'figma', `${script}.ts`)
  const built = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm', minify: { whitespace: true, syntax: true } })
  if (!built.success) throw new AggregateError(built.logs, `could not compile ${entry}`)
  return built.outputs[0].text()
}

/**
 * use_figma runs the text as the body of an async function, so the module's export line becomes a call to `main`
 * whose result is returned as JSON.
 */
export function wrapForFigma(bundled: string, args: unknown, tag?: string): string {
  const exportLine = /export\s*\{([^}]*)\};?\s*$/
  const match = bundled.match(exportLine)
  if (!match) throw new Error('the compiled script exports nothing; every Figma-side script exports `main`')
  const mainBinding = match[1]
    .split(',')
    .map((part) => part.trim().split(/\s+as\s+/))
    .find(([local, exported]) => (exported ?? local) === 'main')
  if (!mainBinding) throw new Error('the compiled script does not export `main`')
  const body = bundled.replace(exportLine, '').trimEnd()
  const lines = [`const ARGS = ${JSON.stringify(args)};`, body, `return JSON.stringify(await ${mainBinding[0]}(ARGS));`]
  if (tag) lines.unshift(`${TAG_PREFIX}${tag}`)
  return lines.join('\n')
}

export async function buildScript(script: ScriptName, args: unknown, tag?: string): Promise<string> {
  const problems = checkArgs(script, args)
  if (problems.length) throw new Error(`bad --args for ${script}:\n  ${problems.join('\n  ')}`)
  return wrapForFigma(await bundle(script), args, tag)
}

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}

async function main(argv: string[]) {
  const [script] = argv
  const rawArgs = flag(argv, 'args')
  if (!SCRIPTS.includes(script as ScriptName) || rawArgs === undefined) {
    console.error(`usage: bun scripts/figma.ts <${SCRIPTS.join('|')}> --args '<json>' [--tag <tag>]`)
    process.exit(2)
  }
  let args: unknown
  try {
    args = JSON.parse(rawArgs)
  } catch {
    console.error('--args is not valid JSON')
    process.exit(2)
  }
  try {
    console.log(await buildScript(script as ScriptName, args, flag(argv, 'tag')))
  } catch (error) {
    console.error((error as Error).message)
    process.exit(1)
  }
}

if (import.meta.main) await main(process.argv.slice(2))
