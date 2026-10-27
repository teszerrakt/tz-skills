import fs from 'node:fs'
import { ORIGIN, ORIGINS_FILE, PORT } from './config.ts'

const MAX_BODY_BYTES = 1_000_000

/** A request the server refuses. The route wrapper turns it into a JSON error response. */
export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof RequestError) return json({ error: error.message, ...error.extra }, error.status)
  return json({ error: error instanceof Error ? error.message : String(error) }, 400)
}

/** A request body field as a string, cut to a length. Anything that is not a string reads as empty. */
export function text(value: unknown, maxLength = 2000): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

export type Body = Record<string, unknown>

export async function readJsonBody(request: Request): Promise<Body> {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) throw new RequestError(413, 'body too large')
  return raw ? JSON.parse(raw) : {}
}

// A browser page on another site can post here; a worker's CLI sends no Origin at all.
export function refusePostFromElsewhere(request: Request): void {
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigins().includes(origin)) throw new RequestError(403, 'origin')

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.startsWith('application/json')) throw new RequestError(415, 'json only')
}

// A file, not an env var: whichever command starts the server first would set its env.
function allowedOrigins(): string[] {
  const extra = fs.existsSync(ORIGINS_FILE)
    ? fs
        .readFileSync(ORIGINS_FILE, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []
  return [ORIGIN, `http://localhost:${PORT}`, ...extra]
}
