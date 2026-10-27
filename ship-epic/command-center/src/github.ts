// PR and merge state, read through `gh`. GitHub is the only source that knows a PR merged:
// a worker that finished before the merge, or never ran here, cannot report it.
import { outputOf } from './desktop/process.ts'
import { logEvent, save, state } from './store.ts'
import type { Checks, PullRequest, ReviewBotState, ReviewItem, Severity } from './types.ts'

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

const FAILED_CONCLUSIONS = ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR']

type CheckContext = {
  __typename: 'CheckRun' | 'StatusContext'
  name?: string
  status?: string
  conclusion?: string
  context?: string
  state?: string
  description?: string
}
type Author = { login?: string } | null
type ReviewThread = {
  isResolved: boolean
  path?: string
  line?: number
  comments: { nodes: { author: Author; body?: string; url?: string }[] }
}
type PullRequestQueryResult = {
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  headRefOid?: string
  commits: { nodes: { commit: { statusCheckRollup?: { contexts: { nodes: CheckContext[] } } } }[] }
  reviews: { nodes: { author: Author }[] }
  comments: { nodes: { author: Author; body: string }[] }
  reviewThreads: { nodes: ReviewThread[] }
}

const isReviewBot = (login: string | undefined) => /coderabbit/i.test(login || '')
const checkName = (check: CheckContext) => check.name || check.context || ''

async function readChecks(repo: string, number: number): Promise<Checks | null> {
  const [owner, name] = repo.split('/')
  const printed = await outputOf([
    'gh',
    'api',
    'graphql',
    '-f',
    `query=${PR_QUERY}`,
    '-F',
    `owner=${owner}`,
    '-F',
    `name=${name}`,
    '-F',
    `n=${number}`,
  ])
  if (!printed) return null
  const pr: PullRequestQueryResult | undefined = JSON.parse(printed).data?.repository?.pullRequest
  if (!pr) return null

  const contexts = pr.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []
  // The review bot posts its own check, which reads green even when it reviewed nothing.
  const ci = contexts.filter((check) => !isReviewBot(checkName(check)))
  const failing = ci.filter((check) => FAILED_CONCLUSIONS.includes(check.conclusion || check.state || '')).map(checkName)
  const running = ci.some((check) =>
    check.__typename === 'CheckRun' ? check.status !== 'COMPLETED' : ['PENDING', 'EXPECTED'].includes(check.state || ''),
  )

  return {
    ci: ciState(ci.length, failing.length, running),
    failing,
    rabbit: reviewBotState(pr, contexts),
    threads: pr.reviewThreads.nodes.filter((thread) => !thread.isResolved).length,
    items: pr.reviewThreads.nodes.map(reviewItem),
    // GitHub answers UNKNOWN while it recomputes after the base moves; null lets the caller keep its last answer.
    conflict: pr.mergeable === 'UNKNOWN' ? null : pr.mergeable === 'CONFLICTING',
    head: String(pr.headRefOid || '').slice(0, 8),
  }
}

function ciState(total: number, failing: number, running: boolean): Checks['ci'] {
  if (total === 0) return 'none'
  if (failing > 0) return 'failing'
  if (running) return 'running'
  return 'green'
}

// The bot's own check says what it did; a clean review leaves no review object, only "Review completed".
function reviewBotState(pr: PullRequestQueryResult, contexts: CheckContext[]): ReviewBotState {
  const botSaid = contexts.find((check) => isReviewBot(checkName(check)))?.description || ''

  const reviewed = pr.reviews.nodes.some((review) => isReviewBot(review.author?.login)) || /completed/i.test(botSaid)
  if (reviewed) return 'reviewed'
  if (/rate limit/i.test(botSaid)) return 'limited'
  if (/skipped/i.test(botSaid)) return 'skipped'

  const limitComment = pr.comments.nodes.some((c) => isReviewBot(c.author?.login) && /rate limited by coderabbit/i.test(c.body))
  if (!botSaid && limitComment) return 'limited'
  return 'waiting'
}

// A bot's comment opens with a severity tag and a bold title.
const SEVERITY_TAGS: [RegExp, Severity][] = [
  [/critical|potential issue|major/i, 'major'],
  [/refactor|nitpick|minor|trivial/i, 'minor'],
]

function reviewItem(thread: ReviewThread, index: number): ReviewItem {
  const comment = thread.comments.nodes[0] ?? { author: null }
  const body = String(comment.body || '')
  const opening = body.slice(0, 200)
  const boldTitle = /\*\*([^*\n]{4,200})\*\*/.exec(body)?.[1]
  const firstLine = body
    .replace(/<[^>]*>|[_*`>#]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return {
    id: `T${index + 1}`,
    by: 'PR review',
    author: comment.author?.login || '',
    url: comment.url || '',
    severity: SEVERITY_TAGS.find(([tag]) => tag.test(opening))?.[1] ?? 'note',
    claim: (boldTitle || firstLine || '').slice(0, 300),
    anchor: thread.path ? `${thread.path}${thread.line ? `:${thread.line}` : ''}` : '',
    outcome: thread.isResolved ? 'fixed' : 'open',
  }
}

type ListedPullRequest = {
  number: number
  title: string
  url: string
  state: PullRequest['state']
  isDraft: boolean
  mergedAt: string | null
  headRefName: string
}

/** The PR that ships a ticket: the one its worker named, else a merged one, else an open one. */
async function findPullRequest(repo: string, ticket: string): Promise<ListedPullRequest | null> {
  const printed = await outputOf([
    'gh',
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--limit',
    '20',
    '--search',
    ticket,
    '--json',
    'number,title,url,state,isDraft,mergedAt,headRefName',
  ])
  if (!printed) return null

  // A bare search for TRA-797 also returns PR #797, so the id must be in the title or the branch.
  const ticketId = new RegExp(`(^|[^a-z0-9])${ticket.replace('-', '[- ]')}([^0-9]|$)`, 'i')
  const candidates = (JSON.parse(printed) as ListedPullRequest[]).filter(
    (pr) => (ticketId.test(pr.title) || ticketId.test(pr.headRefName)) && !pr.headRefName.startsWith('verify/'),
  )

  const named = state.workers[ticket]?.pr
  return (
    candidates.find((pr) => pr.url === named) ??
    candidates.find((pr) => pr.state === 'MERGED') ??
    candidates.find((pr) => pr.state === 'OPEN') ??
    candidates[0] ??
    null
  )
}

function repoOfLiveRun(): string {
  const fromRun = state.run?.github
  if (fromRun) return fromRun
  for (const worker of Object.values(state.workers)) {
    const fromWorkerPr = /github\.com\/([^/]+\/[^/]+)\/pull\//.exec(worker.pr || '')?.[1]
    if (fromWorkerPr) return fromWorkerPr
  }
  return ''
}

let refreshing = false

export async function refreshPullRequests(): Promise<void> {
  const tickets = state.run?.tickets ?? []
  const repo = repoOfLiveRun()
  if (refreshing || tickets.length === 0 || !repo) return

  refreshing = true
  let changed = false
  try {
    for (const { ticket } of tickets) {
      const found = await findPullRequest(repo, ticket)
      if (!found) continue

      const next: PullRequest = {
        number: found.number,
        title: found.title,
        url: found.url,
        state: found.state,
        draft: found.isDraft,
        mergedAt: found.mergedAt || '',
        branch: found.headRefName,
      }
      if (found.state === 'OPEN') next.checks = await readChecks(repo, found.number)

      const previous = state.prs[ticket]
      if (next.checks && next.checks.conflict === null) {
        // Unknown: keep the last answer, as long as it was for the same commit.
        const sameHead = previous?.checks?.head === next.checks.head
        next.checks.conflict = sameHead && previous?.checks?.conflict === true
      }
      if (JSON.stringify(previous) === JSON.stringify(next)) continue

      if (next.state === 'MERGED' && previous?.state !== 'MERGED') logEvent(ticket, 'merged', 'Merged', `#${next.number}`)
      state.prs[ticket] = next
      changed = true
    }
  } finally {
    refreshing = false
  }
  if (changed) save()
}
