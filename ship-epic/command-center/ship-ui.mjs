#!/usr/bin/env node
// Worker and orchestrator side of the command center.
//   ask      --ticket T --question Q --option "Label|what I see" ... [--recommended 0]
//            [--because "..."] [--example "..."] [--run EPIC]
//            Blocks until answered. Prints "choice: <label>" and/or "text: <words>".
//   status   --ticket T --step "9/12" --doing "spec review" [--stopped <reason>] [--pr URL]
//            [--model "Opus 5.5"] [--effort high]
//            Prints "ok", then one "revised: ..." line per answer the human changed.
//   run      --file run.json   What the run ships: id, title, summary, tickets.
//   followup --ticket T --sentence "..." [--anchor path:line]
//   open     Opens the command center in the browser.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.SHIP_UI_PORT || 4777)
const BASE = `http://127.0.0.1:${PORT}`

function parse(argv) {
  const out = { option: [] }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '')
    const val = argv[i + 1]
    i++
    if (key === 'option') out.option.push(val)
    else out[key] = val
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function up() {
  try {
    return (await fetch(`${BASE}/api/state`)).ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await up()) return
  spawn(process.execPath, [path.join(HERE, 'server.mjs')], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  for (let i = 0; i < 20; i++) {
    await sleep(250)
    if (await up()) return
  }
  throw new Error(`command center did not start on ${BASE}`)
}

async function post(pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json
}

const [cmd, ...rest] = process.argv.slice(2)
const a = parse(rest)

try {
  await ensureServer()
  if (cmd === 'ask') {
    const { id } = await post('/api/questions', {
      ticket: a.ticket, run: a.run, question: a.question, options: a.option,
      recommended: a.recommended === undefined ? -1 : Number(a.recommended),
      because: a.because, example: a.example,
    })
    console.error(`asked ${id}, waiting at ${BASE}/#${id}`)
    for (;;) {
      try {
        await ensureServer()
        const ans = await (await fetch(`${BASE}/api/questions/${id}/wait`)).json()
        if (ans.pending) continue
        if (ans.error) throw new Error(ans.error)
        if (ans.choice) console.log(`choice: ${ans.choice}`)
        if (ans.note) console.log(`text: ${ans.note}`)
        break
      } catch (e) {
        if (/no such question/.test(String(e.message))) throw e
        await sleep(2000)
      }
    }
  } else if (cmd === 'status') {
    const { revisions } = await post('/api/status', a)
    console.log('ok')
    for (const r of revisions) {
      console.log(`revised: "${r.question}" was "${r.was}", now "${r.choice}"${r.note ? `. Note: ${r.note}` : ''}`)
    }
  } else if (cmd === 'run') {
    await post('/api/run', JSON.parse(fs.readFileSync(a.file, 'utf8')))
    console.log('ok')
  } else if (cmd === 'followup') {
    await post('/api/followups', a)
    console.log('ok')
  } else if (cmd === 'open') {
    if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', BASE], { detached: true, windowsHide: true }).unref()
    console.log(BASE)
  } else {
    console.error('usage: ship-ui.mjs ask|status|run|followup|open [--flags]')
    process.exitCode = 2
  }
} catch (e) {
  console.error(`ship-ui: ${e.message}`)
  process.exitCode = 1
}
