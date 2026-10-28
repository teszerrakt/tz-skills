#!/usr/bin/env bun
// Worker and orchestrator side of the command center.
//   ask      --ticket T --question Q --option "Label|what I see" ... [--recommended 0]
//            [--because "..."] [--example "..."] [--run EPIC]
//            Blocks until answered. Prints "choice: <label>" and/or "text: <words>",
//            then "by: orchestrator" and "decision: D<n>" when the orchestrator answered it under --afk.
//   status   --ticket T --step "9/12" --doing "spec review" [--stopped <reason>] [--pr URL]
//            [--model "Opus 5.5"] [--effort high]
//            Prints "ok", then one "revised: ..." line per answer the user changed.
//   run      --file run.json   What the run ships: id, title, summary, tickets.
//   followup --ticket T --sentence "..." [--anchor path:line]
//   watch    [--every 30]  Runs until killed. One line per new thing the orchestrator must act on:
//            a question, a review hand-off the bot and CI have finished,
//            a finished ticket whose PR has threads open, CI failing or a conflict,
//            a stopped worker, a worker with no update for 30 minutes.
//   questions  Prints each open question: id, ticket, options (* marks the recommended one).
//   answer   --id Q --choice LABEL [--note "..."] --as orchestrator
//            The orchestrator's answer under --afk, labelled as its own.
//   revise   --decision D3 --choice LABEL [--note "..."]   The user's change, typed in the orchestrator chat.
//   finding  --ticket T --id F1 --by "adversarial review" --severity blocker|major|minor|note
//            --claim "..." [--anchor path:line] --outcome open|fixed|refused|withdrawn|held
//            A re-send with the same id updates that finding.
//   finding  --ticket T --by "spec review" --verdict PASS_WITH_NOTES   A whole review's result.
//   profiles [--set "~/.claude,~/.claude-work"]   Prints, or sets, the Claude config folders sessions are
//            read from. --set "" goes back to the server's own profile. The page's Profiles button does the same.
//   open     Opens the command center in the browser.
import fs from 'node:fs'
import path from 'node:path'
import { ORIGIN } from './src/config.ts'
import { openUrl } from './src/desktop/open-url.ts'
import { launchDetached } from './src/desktop/process.ts'
import type { Answer, Decision, Question, Revision, State } from './src/types.ts'

type Flags = Record<string, string | undefined>

/** Every --name value pair. --option may repeat, so its values are kept apart, in order. */
function parseFlags(argv: string[]): { flags: Flags; options: string[] } {
  const flags: Flags = {}
  const options: string[] = []
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, '')
    const value = argv[i + 1]
    if (name === 'option') options.push(value)
    else flags[name] = value
  }
  return { flags, options }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function serverIsUp(): Promise<boolean> {
  try {
    return (await fetch(`${ORIGIN}/api/state`)).ok
  } catch {
    return false
  }
}

/** Starts the server if nothing answers yet; the first command that needs it starts it. */
async function ensureServer(): Promise<void> {
  if (await serverIsUp()) return
  launchDetached([process.execPath, path.join(import.meta.dir, 'server.ts')])
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(250)
    if (await serverIsUp()) return
  }
  throw new Error(`command center did not start on ${ORIGIN}`)
}

async function get<T>(pathname: string): Promise<T> {
  return (await fetch(`${ORIGIN}${pathname}`)).json() as Promise<T>
}

async function post<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(`${ORIGIN}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const reply = await response.json()
  if (!response.ok) throw new Error(reply.error || response.statusText)
  return reply as T
}

const commands: Record<string, (flags: Flags, options: string[]) => Promise<void>> = {
  async ask(flags, options) {
    const { id } = await post<{ id: string }>('/api/questions', {
      ticket: flags.ticket,
      run: flags.run,
      question: flags.question,
      options,
      recommended: flags.recommended === undefined ? -1 : Number(flags.recommended),
      because: flags.because,
      example: flags.example,
    })
    console.error(`asked ${id}, waiting at ${ORIGIN}/#${id}`)
    printAnswer(await waitForAnswer(id))
  },

  async status(flags) {
    const { revisions } = await post<{ revisions: Revision[] }>('/api/status', flags)
    console.log('ok')
    for (const revision of revisions) {
      const note = revision.note ? `. Note: ${revision.note}` : ''
      console.log(`revised: "${revision.question}" was "${revision.was}", now "${revision.choice}"${note}`)
    }
  },

  async run(flags) {
    if (!flags.file) throw new Error('--file is required')
    await post('/api/run', JSON.parse(fs.readFileSync(flags.file, 'utf8')))
    console.log('ok')
  },

  async followup(flags) {
    await post('/api/followups', flags)
    console.log('ok')
  },

  // Runs until killed, printing each thing to act on once. Meant for a background monitor.
  async watch(flags) {
    const printed = new Set<string>()
    const everyMs = Number(flags.every || 30) * 1000
    for (;;) {
      try {
        await ensureServer()
        for (const item of await get<{ key: string; line: string }[]>('/api/attention')) {
          if (printed.has(item.key)) continue
          printed.add(item.key)
          console.log(item.line)
        }
      } catch {
        // The server restarts on the next pass.
      }
      await sleep(everyMs)
    }
  },

  async questions() {
    const state = await get<State>('/api/state')
    for (const question of state.questions.filter((q) => !q.answer)) printQuestion(question)
  },

  async answer(flags) {
    if (flags.as !== 'orchestrator') {
      throw new Error('answer is for the orchestrator alone: pass --as orchestrator. The user answers on the page.')
    }
    if (!flags.id) throw new Error('--id is required')
    const answer = await post<Answer>(`/api/questions/${flags.id}/answer`, { choice: flags.choice, note: flags.note, as: 'orchestrator' })
    console.log(`ok ${answer.choice || answer.note}`)
  },

  async revise(flags) {
    const state = await get<State>('/api/state')
    const decision = findDecision(state.decisions, flags.decision || '', flags.run)
    if (!decision) throw new Error(`no decision ${flags.decision}`)
    await post(`/api/decisions/${decision.id}/revise`, { choice: flags.choice, note: flags.note })
    console.log(`ok ${decision.dn || decision.id} is now ${flags.choice}`)
  },

  async finding(flags) {
    await post('/api/findings', flags)
    console.log('ok')
  },

  async profiles(flags) {
    if (flags.set !== undefined) await post('/api/settings', { profiles: flags.set.split(',') })
    const { profiles } = await get<State>('/api/state')
    console.log(profiles.length ? profiles.join('\n') : 'none set: sessions are read from the profile the server started under')
  },

  async open() {
    openUrl(ORIGIN)
    console.log(ORIGIN)
  },
}

/** Asks again until answered: each request waits 25 s, and the server may restart in between. */
async function waitForAnswer(questionId: string): Promise<Answer> {
  for (;;) {
    try {
      await ensureServer()
      const reply = await get<Answer | { pending: true } | { error: string }>(`/api/questions/${questionId}/wait`)
      if ('pending' in reply) continue
      if ('error' in reply) throw new Error(reply.error)
      return reply
    } catch (error) {
      if (/no such question/.test(String((error as Error).message))) throw error
      await sleep(2000)
    }
  }
}

function printAnswer(answer: Answer): void {
  if (answer.choice) console.log(`choice: ${answer.choice}`)
  if (answer.note) console.log(`text: ${answer.note}`)
  if (answer.via === 'orchestrator') {
    console.log('by: orchestrator')
    console.log(`decision: ${answer.dn}`)
  }
}

function printQuestion(question: Question): void {
  console.log(`${question.id} ${question.ticket}: ${question.question}`)
  question.options.forEach((option, index) => {
    const marker = index === question.recommended ? '*' : '-'
    console.log(`  ${marker} ${option.label}${option.detail ? ` | ${option.detail}` : ''}`)
  })
  if (question.because) console.log(`  because: ${question.because}`)
}

/** A decision by its number (D3) within a run, or by its id. */
function findDecision(decisions: Decision[], name: string, runId?: string): Decision | undefined {
  return decisions.find((d) => d.dn === name && (!runId || d.run === runId)) ?? decisions.find((d) => d.id === name)
}

const [commandName, ...rest] = process.argv.slice(2)
const command = commands[commandName]

if (!command) {
  console.error(`usage: ship-ui.ts ${Object.keys(commands).join('|')} [--flags]`)
  process.exitCode = 2
} else {
  try {
    await ensureServer()
    const { flags, options } = parseFlags(rest)
    await command(flags, options)
  } catch (error) {
    console.error(`ship-ui: ${(error as Error).message}`)
    process.exitCode = 1
  }
}
