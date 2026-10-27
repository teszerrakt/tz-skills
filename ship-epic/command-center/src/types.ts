// The command center's state, as saved to state.json and sent to the page.
// Field names are the wire format: index.html and older state files read them as they are.

export type Run = {
  id: string
  title: string
  summary: string
  repo: string
  afk: boolean
  target: string
  where: string
  github: string
  startedAt: string
  tickets: RunTicket[]
}

export type RunTicket = {
  ticket: string
  title: string
  group: number
  after: string
  url: string
}

export type Option = {
  label: string
  detail: string
}

export type AnsweredVia = 'toast' | 'screen' | 'orchestrator'

export type Answer = {
  choice: string
  note: string
  via: AnsweredVia
  at: string
  /** The decision number, D<n>, when the orchestrator answered under --afk. */
  dn?: string
}

export type Question = {
  id: string
  ticket: string
  run: string
  question: string
  options: Option[]
  /** Index into options, or -1 for none. */
  recommended: number
  because: string
  example: string
  askedAt: string
  answer: Answer | null
}

export const STOP_REASONS = [
  'question',
  'waiting-slot',
  'usage-limit',
  'blocked-by-ticket',
  'gate-failed',
  'review',
  'done',
  'merged',
] as const
export type StopReason = (typeof STOP_REASONS)[number]

export type Worker = {
  ticket: string
  run?: string
  step?: string
  doing?: string
  stopped?: StopReason | ''
  pr?: string
  model?: string
  effort?: string
  startedAt?: string
  at?: string
}

export type Decision = {
  id: string
  ticket: string
  run: string
  question: string
  options: string[]
  choice: string
  note: string
  because: string
  at: string
  history: { choice: string; note: string; at: string }[]
  by: 'orchestrator' | 'you'
  dn?: string
  revisedAt?: string
  delivery?: 'sent' | 'read' | 'follow-up'
  readAt?: string
}

/** A changed answer waiting for its worker's next status call. */
export type Revision = {
  decision: string
  question: string
  was: string
  choice: string
  note: string
  at: string
}

export type FollowUp = {
  id: string
  ticket: string
  sentence: string
  anchor?: string
  at: string
  fromFinding?: string
  fromDecision?: string
}

export type TicketEvent = {
  at: string
  kind: string
  text: string
  detail: string
}

export const SEVERITIES = ['blocker', 'major', 'minor', 'note'] as const
export type Severity = (typeof SEVERITIES)[number]

export const OUTCOMES = ['open', 'fixed', 'refused', 'withdrawn', 'held', 'accepted'] as const
export type Outcome = (typeof OUTCOMES)[number]

export type Finding = {
  ticket: string
  run: string
  id: string
  by: string
  severity: Severity
  claim: string
  anchor: string
  outcome: Outcome
  at: string
  updatedAt?: string
  history: { outcome: Outcome; at: string }[]
  verdict?: string
  ruling?: string
  /** When the user sent it back to be fixed. */
  fixAsked?: string
  fixNote?: string
}

/** One whole review's result, such as BLOCK or PASS_WITH_NOTES. */
export type Review = {
  ticket: string
  run: string
  by: string
  verdict: string
  at: string
}

/** A PR review thread, in a finding's shape. */
export type ReviewItem = {
  id: string
  by: 'PR review'
  author: string
  url: string
  severity: Severity
  claim: string
  anchor: string
  outcome: 'fixed' | 'open'
}

export type ReviewBotState = 'reviewed' | 'limited' | 'skipped' | 'waiting' | 'none'

export type Checks = {
  ci: 'none' | 'failing' | 'running' | 'green'
  failing: string[]
  rabbit: ReviewBotState
  threads: number
  items: ReviewItem[]
  /** null while GitHub is still working it out. */
  conflict: boolean | null
  head: string
}

export type PullRequest = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'MERGED' | 'CLOSED'
  draft: boolean
  mergedAt: string
  branch: string
  checks?: Checks | null
}

export type Session = {
  id: string
  sessionId: string
  name: string
  status: string
  cwd: string
  profile: string
}

export type State = {
  run: Run | null
  questions: Question[]
  workers: Record<string, Worker>
  decisions: Decision[]
  followUps: FollowUp[]
  events: Record<string, TicketEvent[]>
  outbox: Record<string, Revision[]>
  prs: Record<string, PullRequest>
  findings: Finding[]
  reviews: Review[]
  sessions: Record<string, Session>
  toasts: boolean
  profiles: string[]
}
