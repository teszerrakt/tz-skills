// Command center for /ship-epic runs: workers post questions and status, the
// human answers in the browser or on a toast. Listens on 127.0.0.1 only.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.SHIP_UI_PORT || 4777)
const DATA_DIR = process.env.SHIP_UI_DATA || path.join(os.homedir(), '.claude', 'orchestrate', 'ui')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const TOAST_SCRIPT = path.join(HERE, 'toast.ps1')
const TOASTS_ON = process.platform === 'win32' && !process.env.SHIP_UI_NO_PING && fs.existsSync(TOAST_SCRIPT)
const ORIGIN = `http://127.0.0.1:${PORT}`
const WAIT_MS = 25_000
const SNOOZE_MS = { later: 5 * 60_000, open: 5 * 60_000, timeout: 60_000 }
// The pilot's longest healthy silence was 27 minutes; its hidden stalls ran 29 and up.
const QUIET_MS = Number(process.env.SHIP_UI_QUIET_MIN || 30) * 60_000

const STOP_REASONS = ['question', 'waiting-slot', 'usage-limit', 'blocked-by-ticket', 'gate-failed', 'done', 'merged']
const STOP_WORDS = {
  'usage-limit': ['Ran out of usage', 'The session ended. Its work is safe in the worktree.'],
  'gate-failed': ['A check failed', 'The worker stopped and will not go on by itself.'],
}
// A ticket in one of these states has no worker left to read a changed answer.
const FINISHED = ['done', 'merged']
const SEVERITIES = ['blocker', 'major', 'minor', 'note']
const OUTCOMES = ['open', 'fixed', 'refused', 'withdrawn', 'held', 'accepted']

fs.mkdirSync(DATA_DIR, { recursive: true })
let state = { run: null, questions: [], workers: {}, decisions: [], followUps: [], events: {}, outbox: {}, prs: {}, findings: [], reviews: [], sessions: {}, toasts: true }
if (fs.existsSync(STATE_FILE)) state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }

const streams = new Set()
const waiters = new Map()
const snoozed = new Map()
const notices = []
let toastBusy = false

const now = () => new Date().toISOString()
const clock = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function save() {
  const tmp = `${STATE_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, STATE_FILE)
  for (const res of streams) res.write(`data: ${JSON.stringify(state)}\n\n`)
}

// The page lists every worker it holds, so a new run must not inherit the last one's.
// What belongs to another run moves to runs/<id>.json; an unanswered question stays, since its worker still waits.
function archiveOtherRuns(prev) {
  const id = state.run?.id
  if (!id) return false
  const mine = new Set([...(state.run.tickets || []).map((t) => t.ticket), ...Object.values(state.workers).filter((w) => w.run === id).map((w) => w.ticket)])
  const keep = (ticket) => mine.has(ticket)
  const out = {}
  const split = (key, test) => {
    const all = state[key]
    if (Array.isArray(all)) {
      out[key] = all.filter((x) => !test(x))
      state[key] = all.filter(test)
    } else {
      out[key] = Object.fromEntries(Object.entries(all).filter(([k, v]) => !test(v, k)))
      state[key] = Object.fromEntries(Object.entries(all).filter(([k, v]) => test(v, k)))
    }
  }
  split('workers', (w, k) => keep(k))
  split('prs', (p, k) => keep(k))
  split('events', (e, k) => keep(k))
  split('outbox', (o, k) => keep(k))
  split('followUps', (f) => keep(f.ticket))
  split('questions', (q) => !q.answer || q.run === id || (!q.run && keep(q.ticket)))
  split('decisions', (d) => d.run === id || (!d.run && keep(d.ticket)))
  split('findings', (f) => f.run === id || (!f.run && keep(f.ticket)))
  split('reviews', (r) => r.run === id || (!r.run && keep(r.ticket)))
  const moved = Object.values(out).reduce((n, v) => n + (Array.isArray(v) ? v.length : Object.keys(v).length), 0)
  if (!moved) return false
  // Each item goes to the run it names, else its ticket's worker's run, else the run being replaced.
  const byRun = {}
  for (const [key, v] of Object.entries(out)) {
    for (const [k, item] of Array.isArray(v) ? v.map((x) => [x.ticket, x]) : Object.entries(v)) {
      const run = item.run || out.workers[k]?.run || prev?.id || 'earlier'
      const part = ((byRun[run] ||= {})[key] ||= Array.isArray(v) ? [] : {})
      if (Array.isArray(part)) part.push(item)
      else part[k] = item
    }
  }
  for (const [run, part] of Object.entries(byRun)) {
    const old = readRun(run) || {}
    const merged = { ...old, run: prev?.id === run ? prev : old.run || { id: run, title: '' } }
    for (const [key, v] of Object.entries(part)) merged[key] = Array.isArray(v) ? [...(old[key] || []), ...v] : { ...(old[key] || {}), ...v }
    fs.writeFileSync(runFile(run), JSON.stringify(merged, null, 2))
  }
  return true
}

const RUNS_DIR = path.join(DATA_DIR, 'runs')
const runFile = (id) => path.join(RUNS_DIR, `${id.replace(/[^\w.-]/g, '_')}.json`)
function readRun(id) {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  return fs.existsSync(runFile(id)) ? JSON.parse(fs.readFileSync(runFile(id), 'utf8')) : null
}

function log(ticket, kind, text, detail = '') {
  const list = (state.events[ticket] ||= [])
  list.push({ at: now(), kind, text, detail })
  if (list.length > 200) list.splice(0, list.length - 200)
}

function gh(args) {
  return new Promise((resolve) => {
    execFile('gh', args, { windowsHide: true, timeout: 20_000 }, (err, out) => resolve(err ? null : out))
  })
}

const PR_QUERY = `query($owner: String!, $name: String!, $n: Int!) {
  repository(owner: $owner, name: $name) { pullRequest(number: $n) {
    mergeable headRefOid
    commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 60) { nodes {
      __typename
      ... on CheckRun { name status conclusion }
      ... on StatusContext { context state description }
    } } } } } }
    reviews(first: 60) { nodes { author { login } } }
    comments(last: 40) { nodes { author { login } body } }
    reviewThreads(first: 100) { nodes { id isResolved path line comments(first: 1) { nodes { author { login } body url } } } }
  } }
}`
const BAD = ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR']

async function prChecks(repo, number) {
  const [owner, name] = repo.split('/')
  const out = await gh(['api', 'graphql', '-f', 'query=' + PR_QUERY, '-F', 'owner=' + owner, '-F', 'name=' + name, '-F', 'n=' + number])
  if (!out) return null
  const pr = JSON.parse(out).data?.repository?.pullRequest
  if (!pr) return null
  const bot = (login) => /coderabbit/i.test(login || '')
  const contexts = pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes || []
  // CodeRabbit posts its own check, which reads green even when it reviewed nothing.
  const ci = contexts.filter((c) => !bot(c.name || c.context))
  const failing = ci.filter((c) => BAD.includes(c.conclusion || c.state)).map((c) => c.name || c.context)
  const running = ci.some((c) => (c.__typename === 'CheckRun' ? c.status !== 'COMPLETED' : ['PENDING', 'EXPECTED'].includes(c.state)))
  // The bot's own check says what it did; a clean review leaves no review object, only "Review completed".
  const said = contexts.find((c) => bot(c.context || c.name))?.description || ''
  const rabbit = pr.reviews.nodes.some((r) => bot(r.author?.login)) || /completed/i.test(said) ? 'reviewed'
    : /rate limit/i.test(said) ? 'limited'
    : /skipped/i.test(said) ? 'skipped'
    : !said && pr.comments.nodes.some((c) => bot(c.author?.login) && /rate limited by coderabbit/i.test(c.body)) ? 'limited'
    : 'waiting'
  return {
    ci: !ci.length ? 'none' : failing.length ? 'failing' : running ? 'running' : 'green',
    failing,
    rabbit,
    threads: pr.reviewThreads.nodes.filter((t) => !t.isResolved).length,
    items: pr.reviewThreads.nodes.map(reviewItem),
    // GitHub answers UNKNOWN while it recomputes after the base moves; null lets refreshPrs keep the last answer.
    conflict: pr.mergeable === 'UNKNOWN' ? null : pr.mergeable === 'CONFLICTING',
    head: String(pr.headRefOid || '').slice(0, 8),
  }
}

// One PR review thread, in a finding's shape. A bot's comment opens with a severity tag and a bold title.
const SEV_TAGS = [[/critical|potential issue|major/i, 'major'], [/refactor|nitpick|minor|trivial/i, 'minor']]
function reviewItem(t, i) {
  const c = t.comments.nodes[0] || {}
  const body = String(c.body || '')
  const title = /\*\*([^*\n]{4,200})\*\*/.exec(body)?.[1] || body.replace(/<[^>]*>|[_*`>#]/g, '').split('\n').map((l) => l.trim()).find(Boolean) || ''
  const tag = body.slice(0, 200)
  return {
    id: 'T' + (i + 1), by: 'PR review', author: c.author?.login || '', url: c.url || '',
    severity: SEV_TAGS.find(([re]) => re.test(tag))?.[1] || 'note',
    claim: title.slice(0, 300), anchor: t.path ? `${t.path}${t.line ? ':' + t.line : ''}` : '',
    outcome: t.isResolved ? 'fixed' : 'open',
  }
}

// GitHub is the only source that knows a PR merged: a worker that finished
// before the merge, or never ran here, cannot report it.
let refreshing = false
async function refreshPrs() {
  const run = state.run
  if (refreshing || !run?.tickets?.length) return
  const fromWorker = Object.values(state.workers).map((w) => /github\.com\/([^/]+\/[^/]+)\/pull\//.exec(w.pr || '')?.[1]).find(Boolean)
  const repo = run.github || fromWorker
  if (!repo) return
  refreshing = true
  let changed = false
  try {
    for (const { ticket } of run.tickets) {
      const out = await gh(['pr', 'list', '--repo', repo, '--state', 'all', '--limit', '20', '--search', ticket,
        '--json', 'number,title,url,state,isDraft,mergedAt,headRefName'])
      if (!out) continue
      // A bare search for TRA-797 also returns PR #797, so match the id in the title or branch.
      const id = new RegExp('(^|[^a-z0-9])' + ticket.replace('-', '[- ]') + '([^0-9]|$)', 'i')
      const hits = JSON.parse(out).filter((p) => (id.test(p.title) || id.test(p.headRefName)) && !p.headRefName.startsWith('verify/'))
      const known = state.workers[ticket]?.pr
      const pick = hits.find((p) => p.url === known) || hits.find((p) => p.state === 'MERGED') || hits.find((p) => p.state === 'OPEN') || hits[0]
      if (!pick) continue
      const next = { number: pick.number, title: pick.title, url: pick.url, state: pick.state, draft: pick.isDraft, mergedAt: pick.mergedAt || '', branch: pick.headRefName }
      if (pick.state === 'OPEN') next.checks = await prChecks(repo, pick.number)
      const prev = state.prs[ticket]
      if (next.checks?.conflict === null) next.checks.conflict = prev?.checks?.head === next.checks.head && prev.checks.conflict === true
      if (JSON.stringify(prev) === JSON.stringify(next)) continue
      if (next.state === 'MERGED' && prev?.state !== 'MERGED') log(ticket, 'merged', 'Merged', '#' + next.number)
      state.prs[ticket] = next
      changed = true
    }
  } finally {
    refreshing = false
  }
  if (changed) save()
}
setInterval(refreshPrs, 120_000).unref()

// Sessions are named after their ticket (ship-epic's spawn line); the orchestrator's name starts with the run id.
function readSessions() {
  const run = state.run
  if (!run?.id) return
  execFile('claude', ['agents', '--json'], { windowsHide: true, timeout: 20_000 }, (err, out) => {
    if (err) return
    let agents
    try { agents = JSON.parse(out) } catch { return }
    const tickets = new Set([...(run.tickets || []).map((t) => t.ticket), ...Object.keys(state.workers)])
    const next = { ...(state.sessions || {}) }
    for (const key of Object.keys(next)) next[key] = { ...next[key], status: 'gone' }
    for (const a of agents) {
      const name = String(a.name || '')
      const key = [...tickets].find((t) => t.toLowerCase() === name.toLowerCase())
        || (name.toLowerCase().startsWith(run.id.toLowerCase()) ? 'orchestrator' : '')
      if (key) next[key] = { id: a.id, sessionId: a.sessionId, name, status: a.status || '', cwd: a.cwd || '' }
    }
    if (JSON.stringify(next) === JSON.stringify(state.sessions || {})) return
    state.sessions = next
    save()
  })
}
setInterval(readSessions, 60_000).unref()

// What the orchestrator must act on now, each with a stable key so `ship-ui.mjs watch` prints it once.
// A finished worker whose PR later gets review threads, red CI or a conflict does not wake by itself.
function attention() {
  const out = []
  for (const q of state.questions.filter((x) => !x.answer)) {
    out.push({ key: `q:${q.id}`, line: `question ${q.id} from ${q.ticket}: ${q.question}` })
  }
  for (const [ticket, w] of Object.entries(state.workers)) {
    const pr = state.prs[ticket]
    const c = pr?.state === 'OPEN' ? pr.checks : null
    if (w.stopped === 'done' && c?.threads) {
      out.push({ key: `threads:${ticket}:${c.threads}`, line: `resume ${ticket}: ${c.threads} review thread${c.threads > 1 ? 's' : ''} open on #${pr.number}` })
    }
    if (w.stopped === 'done' && c?.ci === 'failing') {
      out.push({ key: `ci:${ticket}:${c.failing.join(',')}`, line: `resume ${ticket}: CI failing on #${pr.number} (${c.failing.join(', ')})` })
    }
    if (w.stopped === 'done' && c?.conflict) {
      out.push({ key: `conflict:${ticket}:${c.head}`, line: `resume ${ticket}: #${pr.number} conflicts with ${state.run?.target || 'its base branch'}` })
    }
    for (const f of state.findings.filter((x) => x.ticket === ticket && x.fixAsked && !['fixed', 'accepted', 'withdrawn'].includes(x.outcome))) {
      out.push({ key: `fix:${ticket}:${f.id}:${f.fixAsked}`, line: `resume ${ticket}: the user asked to fix ${f.id}: ${f.claim}${f.fixNote ? ` (note: ${f.fixNote})` : ''}` })
    }
    if (w.stopped && w.stopped !== 'done' && w.stopped !== 'question') {
      out.push({ key: `stopped:${ticket}:${w.stopped}:${w.at}`, line: `${ticket} stopped: ${w.stopped} (${w.doing || 'no detail'})` })
    }
    // Never a `resume` line: the session may be mid-step, and resuming a live session starts a copy of it.
    const quiet = Date.now() - Date.parse(w.at)
    if (!w.stopped && pr?.state !== 'MERGED' && quiet > QUIET_MS) {
      out.push({ key: `quiet:${ticket}:${w.at}`, line: `quiet ${ticket}: no update for ${Math.round(quiet / 60_000)} min at step ${w.step || '?'} (${w.doing || 'no detail'})` })
    }
  }
  return out
}

function openBrowser(hash = '') {
  spawn('cmd.exe', ['/c', 'start', '', `${ORIGIN}/${hash ? '#' + hash : ''}`], { windowsHide: true, detached: true }).unref()
}

function toast(spec, done) {
  const file = path.join(DATA_DIR, `toast-${randomUUID().slice(0, 8)}.json`)
  fs.writeFileSync(file, JSON.stringify(spec))
  const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', TOAST_SCRIPT, '-Spec', file], { windowsHide: true })
  let out = ''
  child.stdout.on('data', (d) => (out += d))
  const end = () => {
    fs.rmSync(file, { force: true })
    done(out.trim() || 'timeout')
  }
  child.on('close', end)
  child.on('error', end)
  return child
}

// The question the toast on screen is asking, so an answer given elsewhere can close it.
let showing = null

// One toast at a time: they share one corner of the screen.
function pump() {
  if (!TOASTS_ON || toastBusy) return
  if (state.toasts === false) return void (notices.length = 0)
  const notice = notices.shift()
  if (notice) {
    toastBusy = true
    return toast(notice.spec, (out) => {
      if (out === 'open') openBrowser(notice.hash)
      toastBusy = false
      pump()
    })
  }
  const open = state.questions.filter((q) => !q.answer)
  const q = open.find((x) => (snoozed.get(x.id) || 0) <= Date.now())
  if (!q) return
  toastBusy = true
  showing = { id: q.id }
  showing.child = toast({
    kind: 'question', tag: q.ticket === 'RUN' ? 'ORCHESTRATOR' : q.ticket, state: 'waiting for you', time: clock(q.askedAt), title: q.question,
    options: q.options, recommended: q.recommended, because: q.because, more: open.length - 1,
  }, (out) => {
    const choice = (out.match(/^choice: (.*)$/m) || [])[1] || ''
    const note = (out.match(/^text: (.*)$/m) || [])[1] || ''
    showing = null
    if ((choice || note) && !q.answer) applyAnswer(q, { choice, note, via: 'toast' })
    else {
      snoozed.set(q.id, Date.now() + (SNOOZE_MS[out] || SNOOZE_MS.timeout))
      if (out === 'open') openBrowser(q.id)
    }
    toastBusy = false
    pump()
  })
}
setInterval(pump, 15_000).unref()

function applyAnswer(q, { choice, note, via }) {
  q.answer = { choice, note, via, at: now() }
  if (showing?.id === q.id && via !== 'toast') showing.child?.kill()
  const away = via === 'orchestrator'
  const d = {
    id: q.id, ticket: q.ticket, run: q.run, question: q.question,
    options: q.options.map((o) => o.label), choice: choice || note, note: choice ? note : '',
    because: q.because, at: q.answer.at, history: [], by: away ? 'orchestrator' : 'you',
  }
  // Numbered per run, so the morning can say "D3: No" about one of them.
  if (away) q.answer.dn = d.dn = 'D' + (state.decisions.filter((x) => x.dn && x.run === q.run).length + 1)
  state.decisions.push(d)
  const w = state.workers[q.ticket]
  if (w && w.stopped === 'question') Object.assign(w, { stopped: '', doing: away ? 'Got the orchestrator answer' : 'Got your answer', at: q.answer.at })
  log(q.ticket, 'decided', away ? `${d.dn} decided while you were away: ${d.choice}` : `You decided: ${d.choice}`, q.question)
  save()
  for (const entry of waiters.get(q.id) || []) {
    clearTimeout(entry.timer)
    send(entry.res, 200, q.answer)
  }
  waiters.delete(q.id)
}

// One finding per (ticket, id); a re-send with the same id updates it.
function applyFinding(b) {
  const ticket = text(b.ticket, 40)
  if (!ticket) return [400, { error: 'ticket is required' }]
  const run = text(b.run, 40) || state.workers[ticket]?.run || state.run?.id || ''
  const by = text(b.by, 60)
  if (text(b.verdict, 60) && !text(b.id, 20)) {
    const r = { ticket, run, by, verdict: text(b.verdict, 60), at: now() }
    state.reviews.push(r)
    log(ticket, 'review', `${by || 'A review'}: ${r.verdict}`)
    return [201, r]
  }
  const id = text(b.id, 20)
  if (!id) return [400, { error: 'id is required, or --verdict alone for a whole review' }]
  const severity = text(b.severity, 20)
  const outcome = text(b.outcome, 20)
  if (severity && !SEVERITIES.includes(severity)) return [400, { error: `severity must be one of: ${SEVERITIES.join(', ')}` }]
  if (outcome && !OUTCOMES.includes(outcome)) return [400, { error: `outcome must be one of: ${OUTCOMES.join(', ')}` }]
  let f = state.findings.find((x) => x.ticket === ticket && x.run === run && x.id === id)
  if (!f) {
    if (!text(b.claim)) return [400, { error: 'claim is required for a new finding' }]
    f = { ticket, run, id, by, severity: severity || 'note', claim: text(b.claim), anchor: text(b.anchor, 300), outcome: outcome || 'open', at: now(), history: [] }
    state.findings.push(f)
    log(ticket, 'finding', `${id} ${f.severity} from ${by || 'a review'}: ${f.outcome}`, f.claim)
    return [201, f]
  }
  if (outcome && outcome !== f.outcome) {
    f.history.push({ outcome: f.outcome, at: f.updatedAt || f.at })
    log(ticket, 'finding', `${id} is now ${outcome}`, f.claim)
    f.outcome = outcome
  }
  for (const k of ['by', 'severity', 'claim', 'anchor']) if (text(b[k])) f[k] = text(b[k], k === 'claim' ? 2000 : 300)
  if (text(b.verdict, 60)) f.verdict = text(b.verdict, 60)
  f.updatedAt = now()
  return [200, f]
}

// A proxy such as `tailscale serve` reaches the page from another origin; list it, one per line, in DATA_DIR/origins.
// A file, not an env var: whichever command starts the server first sets its env.
function allowedOrigins() {
  const file = path.join(DATA_DIR, 'origins')
  const extra = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean) : []
  return [ORIGIN, `http://localhost:${PORT}`, ...extra]
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (d) => {
      raw += d
      if (raw.length > 1_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) }
    })
  })
}

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function text(v, max = 2000) {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

async function route(req, res) {
  const url = new URL(req.url, ORIGIN)
  const parts = url.pathname.split('/').filter(Boolean)

  if (req.method === 'POST') {
    // A browser page on another site can post here; a worker's CLI sends no Origin.
    const origin = req.headers.origin
    if (origin && !allowedOrigins().includes(origin)) return send(res, 403, { error: 'origin' })
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'json only' })
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    return res.end(fs.readFileSync(path.join(HERE, 'index.html')))
  }
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, state)
  if (req.method === 'GET' && url.pathname === '/api/attention') return send(res, 200, attention())
  if (req.method === 'GET' && url.pathname === '/api/runs') {
    fs.mkdirSync(RUNS_DIR, { recursive: true })
    const past = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json')).map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')).run } catch { return null }
    }).filter((r) => r?.id && r.id !== state.run?.id)
    const all = [...(state.run ? [{ ...state.run, live: true }] : []), ...past]
    return send(res, 200, all.map((r) => ({ id: r.id, title: r.title, startedAt: r.startedAt || '', live: !!r.live }))
      .sort((a, b) => (b.live - a.live) || String(b.startedAt).localeCompare(String(a.startedAt))))
  }
  if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'runs' && parts[2]) {
    const id = decodeURIComponent(parts[2])
    if (id === state.run?.id) return send(res, 200, state)
    const r = readRun(id)
    return r ? send(res, 200, r) : send(res, 404, { error: 'no such run' })
  }
  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    streams.add(res)
    return req.on('close', () => streams.delete(res))
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    const b = await readBody(req)
    if (!text(b.id, 40)) return send(res, 400, { error: 'id is required' })
    const prev = state.run
    state.run = {
      id: text(b.id, 40), title: text(b.title, 200), summary: text(b.summary, 600), repo: text(b.repo, 80),
      afk: b.afk === true, target: text(b.target, 80), where: text(b.where, 120), github: text(b.github, 120), startedAt: text(b.startedAt, 40) || now(),
      tickets: (Array.isArray(b.tickets) ? b.tickets : []).slice(0, 60).map((t) => ({
        ticket: text(t.ticket, 40), title: text(t.title, 200), group: Number(t.group) || 1,
        after: text(t.after, 40), url: text(t.url, 300),
      })).filter((t) => t.ticket),
    }
    if (prev?.id !== state.run.id) {
      state.sessions = {}
      // Nobody is at the screen for an --afk run; the switch on the page turns them back on.
      state.toasts = !state.run.afk
    }
    archiveOtherRuns(prev)
    save()
    readSessions()
    refreshPrs()
    return send(res, 200, state.run)
  }

  if (req.method === 'POST' && url.pathname === '/api/settings') {
    const b = await readBody(req)
    if (typeof b.toasts !== 'boolean') return send(res, 400, { error: 'toasts must be true or false' })
    state.toasts = b.toasts
    if (!b.toasts && showing) showing.child?.kill()
    save()
    pump()
    return send(res, 200, { toasts: state.toasts })
  }

  if (req.method === 'POST' && url.pathname === '/api/followups') {
    const b = await readBody(req)
    if (!text(b.sentence)) return send(res, 400, { error: 'sentence is required' })
    state.followUps.push({ id: randomUUID().slice(0, 8), ticket: text(b.ticket, 40), sentence: text(b.sentence, 600), anchor: text(b.anchor, 300), at: now() })
    save()
    return send(res, 201, { ok: true })
  }

  // The user's ruling on a finding a reviewer left open: accept it as a known gap, or send it back to be fixed.
  if (req.method === 'POST' && url.pathname === '/api/findings/rule') {
    const b = await readBody(req)
    const f = state.findings.find((x) => x.ticket === text(b.ticket, 40) && x.id === text(b.id, 20) && (!b.run || x.run === b.run))
    if (!f) return send(res, 404, { error: 'no such finding' })
    const at = now()
    const note = text(b.note, 600)
    if (b.choice === 'accept') {
      f.history.push({ outcome: f.outcome, at: f.updatedAt || f.at })
      Object.assign(f, { outcome: 'accepted', updatedAt: at, ruling: note })
      state.followUps.push({ id: randomUUID().slice(0, 8), ticket: f.ticket, at, anchor: f.anchor, fromFinding: f.id, sentence: `${f.claim}${note ? ' ' + note : ''}` })
      log(f.ticket, 'finding', `You accepted ${f.id} for now`, f.claim)
    } else if (b.choice === 'fix') {
      Object.assign(f, { fixAsked: at, fixNote: note, updatedAt: at })
      log(f.ticket, 'finding', `You sent ${f.id} back to be fixed`, f.claim)
    } else return send(res, 400, { error: 'choice must be accept or fix' })
    save()
    return send(res, 200, f)
  }

  if (req.method === 'POST' && url.pathname === '/api/findings') {
    const [code, body] = applyFinding(await readBody(req))
    if (code < 300) save()
    return send(res, code, body)
  }

  if (req.method === 'POST' && url.pathname === '/api/questions') {
    const b = await readBody(req)
    if (!text(b.question)) return send(res, 400, { error: 'question is required' })
    const ticket = text(b.ticket, 40) || 'RUN'
    const q = {
      id: randomUUID().slice(0, 8),
      ticket,
      run: text(b.run, 40) || state.workers[ticket]?.run || state.run?.id || '',
      question: text(b.question),
      options: (Array.isArray(b.options) ? b.options : []).slice(0, 6).map((o) => {
        const [label, ...rest] = text(o, 400).split('|')
        return { label: label.trim(), detail: rest.join('|').trim() }
      }).filter((o) => o.label),
      recommended: Number.isInteger(b.recommended) ? b.recommended : -1,
      because: text(b.because),
      example: text(b.example, 6000),
      askedAt: now(),
      answer: null,
    }
    state.questions.push(q)
    // The orchestrator asks as RUN; it is no worker, so it gets no row in the Workers list.
    if (ticket !== 'RUN') {
      const w = (state.workers[ticket] ||= { ticket })
      Object.assign(w, { stopped: 'question', doing: q.question, at: q.askedAt })
    }
    log(ticket, 'asked', 'Asked you a question', q.question)
    save()
    pump()
    return send(res, 201, { id: q.id })
  }

  if (parts[0] === 'api' && parts[1] === 'questions' && parts[2]) {
    const q = state.questions.find((x) => x.id === parts[2])
    if (!q) return send(res, 404, { error: 'no such question' })

    if (req.method === 'GET' && parts[3] === 'wait') {
      if (q.answer) return send(res, 200, q.answer)
      const list = waiters.get(q.id) || []
      waiters.set(q.id, list)
      const entry = { res }
      entry.timer = setTimeout(() => {
        list.splice(list.indexOf(entry), 1)
        send(res, 200, { pending: true })
      }, WAIT_MS)
      list.push(entry)
      return req.on('close', () => {
        clearTimeout(entry.timer)
        const i = list.indexOf(entry)
        if (i >= 0) list.splice(i, 1)
      })
    }

    if (req.method === 'POST' && parts[3] === 'answer') {
      if (q.answer) return send(res, 409, { error: 'already answered', answer: q.answer })
      const b = await readBody(req)
      const choice = text(b.choice, 400)
      const note = text(b.note)
      if (!choice && !note) return send(res, 400, { error: 'pick an option or type an answer' })
      // The orchestrator answers only under --afk, and the worker was told before the run to take it.
      applyAnswer(q, { choice, note, via: b.as === 'orchestrator' ? 'orchestrator' : 'screen' })
      return send(res, 200, q.answer)
    }
  }

  if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'decisions' && parts[2] && parts[3] === 'revise') {
    const d = state.decisions.find((x) => x.id === parts[2])
    if (!d) return send(res, 404, { error: 'no such decision' })
    const b = await readBody(req)
    const choice = text(b.choice, 400)
    const note = text(b.note)
    if (!choice) return send(res, 400, { error: 'choice is required' })
    if (choice === d.choice) return send(res, 400, { error: 'that is already the answer' })
    const at = now()
    // No status call ever reads the orchestrator's outbox, so its changed answers become follow-ups.
    const finished = d.ticket === 'RUN' || FINISHED.includes(state.workers[d.ticket]?.stopped)
    ;(d.history ||= []).push({ choice: d.choice, note: d.note, at: d.revisedAt || d.at })
    const was = d.choice
    Object.assign(d, { choice, note, revisedAt: at, delivery: finished ? 'follow-up' : 'sent', readAt: '' })
    if (finished) {
      state.followUps.push({
        id: randomUUID().slice(0, 8), ticket: d.ticket, at, fromDecision: d.id,
        sentence: `Changed answer after the work was done. "${d.question}" was "${was}", now "${choice}".${note ? ' ' + note : ''}`,
      })
    } else {
      (state.outbox[d.ticket] ||= []).push({ decision: d.id, question: d.question, was, choice, note, at })
    }
    log(d.ticket, 'changed', `You changed an answer: ${choice}`, `${d.question} (was: ${was})`)
    save()
    return send(res, 200, d)
  }

  if (req.method === 'POST' && url.pathname === '/api/status') {
    const b = await readBody(req)
    const ticket = text(b.ticket, 40)
    if (!ticket) return send(res, 400, { error: 'ticket is required' })
    const stopped = text(b.stopped, 40)
    if (stopped && !STOP_REASONS.includes(stopped)) return send(res, 400, { error: `stopped must be one of: ${STOP_REASONS.join(', ')}` })
    const w = (state.workers[ticket] ||= { ticket })
    const before = `${w.step}|${w.doing}|${w.stopped}`
    Object.assign(w, {
      run: text(b.run, 40) || w.run || state.run?.id || '',
      step: text(b.step, 40) || w.step || '',
      doing: text(b.doing, 400),
      stopped,
      pr: text(b.pr, 300) || w.pr || '',
      model: text(b.model, 60) || w.model || '',
      effort: text(b.effort, 20) || w.effort || '',
      startedAt: w.startedAt || now(),
      at: now(),
    })
    if (before !== `${w.step}|${w.doing}|${w.stopped}`) {
      log(ticket, stopped || 'step', stopped ? `Stopped: ${stopped}` : w.doing || 'Working', w.step ? `step ${w.step}` : '')
    }
    if (STOP_WORDS[stopped]) {
      notices.push({ hash: `t-${ticket}`, spec: { kind: 'stop', tag: ticket, state: 'stopped', time: clock(w.at), title: STOP_WORDS[stopped][0], body: w.doing || STOP_WORDS[stopped][1], action: 'Open in command center' } })
    }
    if (FINISHED.includes(stopped)) {
      notices.push({ hash: `t-${ticket}`, spec: { kind: 'good', tag: ticket, state: stopped === 'merged' ? 'merged' : 'finished', time: clock(w.at), title: stopped === 'merged' ? `${ticket} is merged` : `${ticket} finished its steps`, body: w.doing, action: 'Open' } })
    }
    const revisions = state.outbox[ticket] || []
    delete state.outbox[ticket]
    for (const r of revisions) {
      const d = state.decisions.find((x) => x.id === r.decision)
      if (d) Object.assign(d, { delivery: 'read', readAt: w.at })
      log(ticket, 'read', 'Worker read your changed answer', r.choice)
    }
    save()
    pump()
    if (b.pr || stopped) refreshPrs()
    if (!state.sessions?.[ticket]) readSessions()
    return send(res, 200, { ok: true, revisions })
  }

  send(res, 404, { error: 'not found' })
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => send(res, 400, { error: String(e.message || e) }))
})
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') process.exit(0)
  throw e
})
server.listen(PORT, '127.0.0.1', () => {
  console.log(`ship-ui on ${ORIGIN}`)
  if (archiveOtherRuns()) save()
  readSessions()
  pump()
  refreshPrs()
})
