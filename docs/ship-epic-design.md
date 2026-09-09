# `/ship-epic` — design

Status: designed, not built. Decided 2026-09-09 in a grilling session, against
capability probes run on the machine rather than documentation. Every claim
below that a tool can or cannot do something was tested; where it was not, it
says so.

## What it is

`/ship-epic TRA-415` takes an epic, picks the tickets that can start now, and
drives each one through `/ship` to a draft PR. It owns four things: which
tickets to take, how many run at once, what happens when one blocks, and what
the human reads afterwards. Every phase's judgment stays in `/ship`, which is
already the single-ticket orchestrator.

The human writes the epic and the ticket breakdown. `/ship-epic` writes no
tickets.

## Non-goals

- **Backend tickets.** `/ship` stops before phase 0 on a backend path, and
  nothing else drives a backend ticket to a PR. `/klay:build` in the
  `klay-claude@klaylab` plugin runs 16 phases but ends at a local commit — no
  PR phase, and its enforcement binary is not built. A backend ticket inside a
  frontend epic is skipped and named in the report.
- **Writing to the tracker.** Follow-ups are listed in the run report for the
  user to pass to `/to-tickets`. Creating them unprompted is refused by the
  user's own standing preference.
- **Editing `/ship`.** The reordered phase list below is a change to `/ship`,
  made in `/ship`, not a wrapper around it.
- **Merging.** No run merges anything.

`/ship` lists "marking a PR ready for review" among its own non-goals, and that
still holds for `/ship` alone. `/ship-epic` promotes the draft it produced, for
the reason in *After the PR opens*.

## Sessions, not subagents

This is the load-bearing discovery, and it inverts the obvious design.

An Agent-tool subagent cannot coordinate and cannot ask. Probed directly with
two sibling subagents:

- `ListAgents` is **absent from a subagent's grant entirely**, even for an agent
  declared `Tools: *`. `ToolSearch` for it returns `No matching deferred tools
  found`.
- Sibling addressing fails in both directions: `No agent named '<sibling>' is
  reachable`, across three name spellings.
- Neither sibling received an inbound message across ~8 tool rounds.
- `AskUserQuestion` is stripped from subagents by the same filter.

`SendMessage`'s own documentation gives the mechanism: *"if you are a subagent,
your send goes out under your parent session's address, and any reply is
delivered to the parent session's conversation, not to you."*

A real session has none of those limits. A `claude --bg -n <name>` session's
tool roster contains `ListAgents`, `SendMessage`, `AskUserQuestion` and
`PushNotification`. Proven by round trip: a message reached `peer-alpha`, which
enumerated `peer-beta` in its own `ListAgents` output and replied.

So `/ship-epic` spawns sessions, and the orchestrator is itself a
`claude --bg -n orchestrator` session. Three consequences follow, and they are
why the rest of this design is simple:

1. A session can ask the user, so `/ship`'s phase-2 gate needs no headless
   variant.
2. Sessions are separate processes, so one parked ticket does not hold up the
   others.
3. `claude agents --json` reports `status` and `waitingFor`, so a blocked
   session is detectable from outside.

## Selection

A ticket is takeable when its `statusType` is `backlog` or `unstarted`, its
`blockedBy` relations are all complete, and no open PR names it.

The `ready-for-agent` label is **required but not a trigger**. It does not
discriminate: all 13 children of TRA-415 carry it, including the nine already
Done. It is a veto — removing it parks a ticket — and nothing more.

Six tickets per run. The binding constraint is how many PRs the user will read
in one sitting, not the machine; a dozen unreviewed PRs is worse than four
because the later ones rot while the earlier ones are worked.

## Waves and file ownership

Nothing can reach a running session mid-flight — a subagent cannot receive at
all, and a session cannot block waiting for a reply. So coordination is
assigned before any agent starts, never negotiated.

The epic body declares its own waves. TRA-415: *"B1 and B2 run together, then
B3, then B4, then P1, then P2/P3/P4/P5 run together, then P6."* An epic that
declares none runs serial.

**The backbone wave runs serial. Consumer waves run three at a time.** Almost
all collision risk lives in the backbone, because that is the wave whose job is
inventing shared files; consumers mostly add inside their own route folder. Two
parallel agents that each need the same helper will each invent one, both PRs
will pass CI, and both will pass `/spec-review` — neither is a stray against
its own ticket. The duplication is invisible until a human reads both PRs.

Each consumer session's spawn prompt names the paths it owns and the shared
modules it must import rather than create.

Three sessions, each pinned `--concurrency=2`. The box has 16 cores and 15 GB
RAM with ~12 GB free, so RAM is the limit, not CPU. The sharper reason for the
pin is ADR-027 §10: turbo's default concurrency already stacks vitest workers
until 5-second-timeout tests fail on timing alone. Under an auto-fix loop a
load-induced failure is worse than noise, because the fixer tries to fix it.

## The reordered flow

`/ship` ran phase 6 (`/spec-review`) before phase 7 (simplify), which deletes
and collapses code. The verdict was therefore computed against a diff that no
longer existed: anchors could be gone, and simplify's own edits were never
audited. Adding an adversarial reviewer would have doubled the same defect.

Every code-mutating phase now finishes before anything verifies:

```
0   bootstrap worktree        + branch-name rule, + settings.local.json
1+2 intake + reconcile        merged; hands over paths, not prose
      GATE                    residue asks the user; that ticket parks
3   plan + reuse grep         owns cross-repo reuse alone
4   implement
5   test + lint               /fe-test, plus turbo lint
5b  verify-frontend           pixel diff + interaction; EDITS code
5c  /run smoke                boot, load the changed route, console clean
7   simplify                  last code-mutating phase
8   codex adversarial         fixes scoped; see below
6   SPEC REVIEW               moved last, audits everything above
9   shoot + assert            /ui-shots
9b  verify live               conditional, serialized
10  draft PR
```

Phase 1 handing prose to phase 2 was the other defect: phase 2 has to **diff**
acceptance criteria against design frames, code and migrations, and a summary
cannot be diffed. Merged, so the reconcile reads what intake found.

Lint moves local. CI runs `lint test typecheck build`, and `/ship` ran neither
lint nor the full gate, so a lint slip surfaced 9–10 minutes after the PR
opened. With auto-fix on, that is a full CI round trip per slip.

## The adversarial review

`codex exec` with `--output-schema`, `gpt-6-astra`, `model_reasoning_effort`
`xhigh`, read-only sandbox, approvals never, `--ephemeral`.

`codex exec review` has a purpose-built review prompt but **silently ignores
`--output-schema`** (`openai/codex#15451`), returning prose. Structured findings
are what let the orchestrator branch on severity, so the plain `exec` form wins
and the review prompt lives in the skill.

`xhigh` is a choice, not a lookup. OpenAI publishes no code-review effort
guidance; `xhigh` is the value `gpt-6-astra` itself uses for
`multi_agent_reasoning_effort`, one rung below `max`/`ultra` where cost climbs
with no published justification. Recalibrate against real findings.

**Never gate on the exit code.** `codex exec review --base <bad-ref>` printed
*"Review blocked… No diff was reviewed"* and exited 0. Gate on parsed,
schema-validated output.

Fallback: an Opus reviewer agent with the same prompt and schema, fired **only**
on a matched quota message in stderr. codex exits 1 for every runtime error, so
triggering on any non-zero exit would let a config typo silently downgrade every
review forever.

**A fix is applied only inside files the ticket's diff already touches.**
Anything else becomes a line in the PR body's `Follow-ups` section. `/spec-review`
returns `BLOCK` on any stray, and a correctness fix outside the ticket's scope
is a stray — so an unscoped reviewer would make the run strangle itself on its
own best findings. Two rounds, then abort, matching `/ship`'s existing
two-self-fix convention.

The CodeRabbit CLI is not used, despite being installed and working. The seat is
Free: **3 reviews per developer per hour**. A 3-ticket run with one re-review
each is 6 calls. It also buys a duplicate, because GitHub CodeRabbit reviews
every PR after push at no cost and no limit.

## After the PR opens

**CodeRabbit does not review a draft PR.** Observed on klaylab/klay#727:
`Review skipped: draft pull request`. Since `/ship` terminates at a draft, the
post-PR review net does not exist unless something promotes it. So a ticket that
reaches the end with no abort is **marked ready**, and only then does the
CodeRabbit pass run. An aborted ticket's PR stays a draft — there is no reason to
ping review on a run that stopped.

Setting `auto_review.drafts: true` in `.coderabbit.yaml` would have worked too.
Promoting was chosen because a finished ticket genuinely is ready for a reviewer,
and because the repo's CodeRabbit config is deliberately narrow (ADR-030
decision 10) — widening what it reviews is a change to a decision that was made
on measurements.

CI is a consistent 9–10 minutes; CodeRabbit adds roughly 5. The orchestrator
waits, which is nearly free because it overlaps the next ticket, and fixes both.

`/address-review` splits into two phases only because it needs a real SHA before
it can reply, and that SHA requires a human push. An orchestrator that pushes
its own fix commit has the SHA, so both halves run in one pass. Its default
auto-resolve for `FIX`/`OUTDATED` is overridden to never — CodeRabbit closes its
own threads on re-review, and a thread resolved before the user reads it hides
what was flagged.

Flake guard: the same test failing twice with different error text stops the
loop instead of being fixed a third time.

Note what CodeRabbit does *not* cover here. `.coderabbit.yaml` points its
knowledge base at `.claude/skills/fe-test/RULES.md`, which permits exactly two
findings, both meaning *delete this test file*, and ends with an explicit gag
list. Per ADR-030 decision 10 that muzzle is deliberate. It still leaves 1–3
inline threads per PR on non-test code, with a parseable severity line, but it
is a thin net by design — which is why the codex pass exists before the PR
rather than after it.

## Human contact

**A blocking spec question parks its ticket and the run continues.** Answering
it from precedence rules is refused: `/ship`'s gate exists because a conflict
found there costs one question, while the same conflict found at PR time costs
a re-implementation, a re-shoot and a body rewrite. A guessed answer converts
the cheap failure into the expensive one, silently.

A parked session can be resumed with its context intact, so parking costs one
round trip rather than a re-run.

**The alarm fires only when no session can progress** — every live session is
parked on a question. That is the only state where the user's answer is the sole
thing between the machine and more work. Waking them for a question two other
sessions are working around trains them to ignore it.

`~/.claude/bin/wake-me` plays an escalating C-major bell arpeggio, ramping
−16 dB → 0 dB over 25 s, and force-unmutes Windows first. The unmute is the
load-bearing half: the reported "notifications are too quiet" turned out to be a
muted default output device, not a loudness problem. Pushover was considered and
declined — local audio works, and it would send question text to a third party.

**A permission stall is not a question.** `waitingFor: "permission prompt"` means
the allowlist is wrong, which is a config edit rather than a decision. The
session is killed, the ticket parked, and the exact denied command written to the
report. No alarm. Both first probe sessions sat in this state for three minutes
producing nothing, which is the failure mode this exists to catch.

Run completion notifies quietly, not with the chime.

Report at `~/.claude/orchestrate/<repo>/<epic>/<timestamp>.md`. Never inside the
repo: a report file in a worktree becomes a stray in the diff `/spec-review`
audits.

## Aborts

Each parks one ticket and leaves a **draft PR carrying the reason**. `/ship`
opens drafts anyway, so this costs nothing, and it is the only artifact that
appears where the user already looks — a branch with no PR is invisible among 25
live worktrees.

Draft is therefore the abort signal. A ready PR passed every phase; a draft one
did not, and its body says which.

| # | Condition |
|---|---|
| 1 | Residue from the reconcile gate — parked, session resumable |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | `/spec-review` returns `BLOCK` |
| 4 | An assert `FAIL` that survives the expectation re-check |
| 5 | Two codex rounds with findings still open |
| 6 | A permission stall — killed, denied command reported |

## Environment constraints

**Ports.** `frontend/apps/dashboard/vite.config.ts` hardcodes `port: 5173` with
no `strictPort`, so a second dev server does not fail — it silently takes 5174,
which backoffice already owns, and a third takes 5175. Silent drift is worse
than `EADDRINUSE` here, because the new origin is rejected by two allowlists.

**Auth0 origins are port-scoped** with no wildcard. `https://dev.klayworks.ai:5273`
through `:5275` were added to Allowed Callback URLs, Allowed Logout URLs, Allowed
Web Origins and Allowed Origins (CORS) on the `Klay Dashboard` SPA
(`I1Al0aRBbJQjoKqg9mefGzL0eq9CDpC8`). The same three still need adding to
`encore.app`'s `allow_origins_with_credentials`.

**Login is serialized, briefly.** Auth0 attack protection flags concurrent
logins from one IP. Only the `login.mjs` step holds the lock; dev servers,
browsers and the pixel work all run parallel. Do not dodge it by using the three
staging accounts — different roles render different affordances, so a pixel diff
taken as AP staff is not comparable to one taken as admin.

**Mutation stays out of the parallel path.** `--clip` writes permanent rows to
staging — financial data is never deleted, only reversed — and staging allows one
active migration per entity. Live verification stays conditional and single-file.

**The klay harness is disabled per worktree.** `klay-claude@klaylab` is enabled
in the checked-in `.claude/settings.json`, so a per-worktree
`.claude/settings.local.json` turns it off without affecting the team. Its own
source says why: `internal/state/feedback.go:192` documents unlocked
read-modify-write on one JSON file, where *"two PreToolUse hooks running
concurrently … can both load the same snapshot, and the later Save can clobber
the earlier append — losing a review obligation."* Worse, every `--bg` session is
top-level, so each fires its own `Stop` gate — a full `encore test ./...`,
`golangci-lint`, `go vet` and `turbo lint/test/typecheck` per session. It is all
inert today because `bin/klay-harness` is not built, but `hooks/lib/build-if-stale.sh`
builds it on SessionStart when source is newer. The orchestrator asserts the
harness is inert at startup rather than discovering it at phase 8.

## Prerequisites

`/ship-epic` is not built until these land. They are independently useful.

- `vite.config.ts` — read `KLAY_DEV_PORT`, add `strictPort: true`
- `encore.app` — the three new origins
- `.claude/live-verification.md` — a frontend section naming the port variable
  and `frontend/packages/e2e/login.mjs`; `/verify-frontend`'s entire launch
  instruction is *"Launch the dev server … and get a browser-automation handle"*,
  with no auth or port knowledge anywhere
- `get-staging-token.mjs` — drop Puppeteer

Done: the Auth0 allowlist, and Resource Owner Password grant enabled on the SPA
client. `password-realm` was verified returning HTTP 200 with a token whose
`aud`, `iss`, `azp` and custom `https://klay.id/email` claim match the
Puppeteer-minted token exactly. ROPG is acceptable on this tenant because
production is a separate tenant (`docs/auth0-setup.md:143`), and because embedded
login already forgoes Auth0's hosted bot detection per ADR-001's RFC-007
amendment. Brute-force Protection and Breached Password Detection stay on.

## Open items

- Whether the `Notification` hook payload distinguishes a background session
  from an interactive one. The alarm must not fire on permission prompts during
  interactive work.
- Whether `waitingFor` reliably separates a spec question from a permission
  prompt. The two dispositions differ completely.
- Injecting the `@auth0/auth0-spa-js` cache entry to start a browser signed in,
  which would delete the login lock. Deliberately deferred: it is an SDK-internal
  storage format nothing in the repo touches, and it fails looking like "not
  logged in" rather than "format changed". Spike before ticketing.
- `frontend/apps/dashboard/.env` says the audience is `https://api.tradeos.io`;
  KLAY's `CLAUDE.md` says `https://api.klay.id`. The wire agrees with `.env`.
- Per-session entity scoping, against staging's one-active-migration-per-entity
  limit.

## Built

Nothing yet.
