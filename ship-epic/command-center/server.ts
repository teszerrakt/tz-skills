#!/usr/bin/env bun
// Command center for /ship-epic runs: workers post questions and status, the user
// answers in the browser or on a toast. Listens on 127.0.0.1 only.
import path from 'node:path'
import { attention } from './src/attention.ts'
import { ANSWER_WAIT_MS, COMMAND_CENTER_DIR, ORIGIN, PORT, PR_REFRESH_MS, SESSION_REFRESH_MS, TOAST_CHECK_MS } from './src/config.ts'
import { reviseDecision } from './src/decisions.ts'
import { addFollowUp, recordFinding, ruleOnFinding } from './src/findings.ts'
import { refreshPullRequests } from './src/github.ts'
import { errorResponse, json, readJsonBody, refusePostFromElsewhere, RequestError, type Body } from './src/http.ts'
import { answerFromRequest, askQuestion, findQuestion, onAnswered, waitForAnswer } from './src/questions.ts'
import { archiveOtherRuns, listRuns, runById, startRun } from './src/runs.ts'
import { readSessions, setProfiles } from './src/sessions.ts'
import { save, state, subscribe } from './src/store.ts'
import { closeCurrentToast, closeToastFor, queueEventToast, showNextToast, useOrigin } from './src/toasts.ts'
import { recordStatus } from './src/workers.ts'

type Params = Record<string, string>
type RouteInput = { request: Request; params: Params; body: Body }
type Handler = (input: RouteInput) => Response | Promise<Response>
type Route = { method: 'GET' | 'POST'; pattern: string; handler: Handler }

const routes: Route[] = [
  { method: 'GET', pattern: '/', handler: servePage },
  { method: 'GET', pattern: '/api/state', handler: () => json(state) },
  { method: 'GET', pattern: '/api/events', handler: ({ request }) => eventStream(request) },
  { method: 'GET', pattern: '/api/attention', handler: () => json(attention()) },
  { method: 'GET', pattern: '/api/runs', handler: () => json(listRuns()) },
  { method: 'GET', pattern: '/api/runs/:id', handler: ({ params }) => json(runById(params.id)) },
  { method: 'GET', pattern: '/api/questions/:id/wait', handler: waitRoute },

  { method: 'POST', pattern: '/api/run', handler: startRunRoute },
  { method: 'POST', pattern: '/api/settings', handler: settingsRoute },
  { method: 'POST', pattern: '/api/status', handler: statusRoute },
  { method: 'POST', pattern: '/api/questions', handler: askRoute },
  { method: 'POST', pattern: '/api/questions/:id/answer', handler: answerRoute },
  { method: 'POST', pattern: '/api/decisions/:id/revise', handler: ({ params, body }) => json(reviseDecision(params.id, body)) },
  { method: 'POST', pattern: '/api/findings', handler: findingRoute },
  { method: 'POST', pattern: '/api/findings/rule', handler: ({ body }) => json(ruleOnFinding(body)) },
  { method: 'POST', pattern: '/api/followups', handler: followUpRoute },
]

function servePage(): Response {
  const page = Bun.file(path.join(COMMAND_CENTER_DIR, 'index.html'))
  return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

/** Server-sent events: the whole state now, then again after every change. */
function eventStream(request: Request): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribe((stateJson) => controller.enqueue(encoder.encode(`data: ${stateJson}\n\n`)))
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        controller.close()
      })
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' } })
}

async function waitRoute({ request, params }: RouteInput): Promise<Response> {
  const question = findQuestion(params.id)
  return json(await waitForAnswer(question, ANSWER_WAIT_MS, request.signal))
}

function startRunRoute({ body }: RouteInput): Response {
  const run = startRun(body)
  readSessions()
  refreshPullRequests()
  return json(run)
}

function settingsRoute({ body }: RouteInput): Response {
  const setsToasts = typeof body.toasts === 'boolean'
  const setsProfiles = Array.isArray(body.profiles)
  if (!setsToasts && !setsProfiles) throw new RequestError(400, 'send toasts (true or false) or profiles (a list of folders)')

  if (setsProfiles) setProfiles(body.profiles as unknown[])
  if (setsToasts) {
    state.toasts = body.toasts as boolean
    if (!state.toasts) closeCurrentToast()
  }
  save()

  showNextToast()
  if (setsProfiles) readSessions()
  return json({ toasts: state.toasts, profiles: state.profiles })
}

function statusRoute({ body }: RouteInput): Response {
  const { worker, revisions, toast } = recordStatus(body)
  if (toast) queueEventToast(toast)
  showNextToast()

  if (body.pr || worker.stopped) refreshPullRequests()
  if (!state.sessions[worker.ticket]) readSessions()
  return json({ ok: true, revisions })
}

function askRoute({ body }: RouteInput): Response {
  const question = askQuestion(body)
  showNextToast()
  return json({ id: question.id }, 201)
}

function answerRoute({ params, body }: RouteInput): Response {
  const question = findQuestion(params.id)
  return json(answerFromRequest(question, body))
}

function findingRoute({ body }: RouteInput): Response {
  const { created, record } = recordFinding(body)
  return json(record, created ? 201 : 200)
}

function followUpRoute({ body }: RouteInput): Response {
  addFollowUp(body)
  return json({ ok: true }, 201)
}

/** Matches "/api/runs/:id" against a path, returning the named parts or null. */
function matchPath(pattern: string, pathname: string): Params | null {
  const want = pattern.split('/').filter(Boolean)
  const got = pathname.split('/').filter(Boolean)
  if (want.length !== got.length) return null

  const params: Params = {}
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(got[i])
    else if (want[i] !== got[i]) return null
  }
  return params
}

async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  for (const route of routes) {
    if (route.method !== request.method) continue
    const params = matchPath(route.pattern, pathname)
    if (!params) continue

    let body: Body = {}
    if (request.method === 'POST') {
      refusePostFromElsewhere(request)
      body = await readJsonBody(request)
    }
    return route.handler({ request, params, body })
  }
  throw new RequestError(404, 'not found')
}

function startServer(): void {
  try {
    Bun.serve({
      hostname: '127.0.0.1',
      port: PORT,
      // 0 turns off the idle timeout: an answer can take 25 s, and the page's event stream stays open.
      idleTimeout: 0,
      fetch: (request) => handle(request).catch(errorResponse),
    })
  } catch (error) {
    // Another command started the server first: that one serves.
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') process.exit(0)
    throw error
  }
  console.log(`ship-ui on ${ORIGIN}`)
}

useOrigin(ORIGIN)
onAnswered(closeToastFor)
startServer()

if (archiveOtherRuns()) save()
readSessions()
refreshPullRequests()
showNextToast()

setInterval(refreshPullRequests, PR_REFRESH_MS)
setInterval(readSessions, SESSION_REFRESH_MS)
setInterval(showNextToast, TOAST_CHECK_MS)
