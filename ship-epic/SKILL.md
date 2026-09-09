---
name: ship-epic
description: Drive an epic's takeable frontend tickets to reviewed PRs, three sessions at a time.
argument-hint: "TRA-XXX"
disable-model-invocation: true
---

# ship-epic

Drive every **takeable** frontend ticket in one epic to a PR **marked ready for
review**, each one through `/ship`. This skill owns four things: which tickets it
takes, how many run at once, what happens when one blocks, and what the user
reads afterwards. Every phase's judgment stays in `/ship`.

It writes no tickets and merges nothing. The human writes the epic and the
breakdown.

Design and the probe evidence behind every claim here:
[`docs/ship-epic-design.md`](../docs/ship-epic-design.md). What `/ship` owns:
[`docs/ship-design.md`](../docs/ship-design.md).

## Sessions, not subagents

Spawn each ticket as its own background session, and run as one yourself:

```bash
claude --bg -n TRA-424 "/ship TRA-424 …"
```

Never a subagent. A subagent's grant carries no `ListAgents`, no `SendMessage`
and no `AskUserQuestion` — even one declared `Tools: *` — so it can neither
coordinate nor ask, and `/ship`'s reconcile gate exists to ask. A session holds
all three.

Three consequences shape everything below:

1. A parked ticket holds up nothing else: sessions are separate processes.
2. Nothing reaches a session while it is working, so coordination is **assigned
   in the spawn prompt**, never negotiated. A parked session can be answered.
3. `claude agents --json` reports each session's `kind`, `status` and
   `waitingFor`, so a blocked session is visible from outside.

## Config

Read `.claude/fe-design-map.md` `## Delivery` — the same section `/ship` reads.
Five keys are this skill's alone, under `### Parallel runs`:

| Key | Holds | Absent |
|---|---|---|
| Dev server ports | the env var and the range, one port per session | run serial |
| Serialized steps | the step only one session may run at a time, and the lock | run serial |
| Opt-out check | the command that proves the worktree opt-outs inert | assert nothing, and say so in the report |
| Concurrency pin | the flag that caps one session's task runner | run serial |
| Alarm | the command run when no session can progress | report quietly |

A repo with no `## Delivery` section: offer `/setup-tz-skills` once, then ask for
the values with a **questions section** (CONTEXT.md).

## Selection

A ticket is **takeable** when all four hold:

- its `statusType` is `backlog` or `unstarted`,
- every `blockedBy` relation is complete,
- no open PR names it,
- it carries `ready-for-agent`.

**That label is a veto, not a trigger.** It does not discriminate: on the
measured epic all thirteen children carried it, including the nine already Done.
Removing it parks a ticket, and it does nothing else.

**A backend ticket is skipped and named in the report.** `/ship` stops before
step 0 on a backend path, and nothing else drives a backend ticket to a PR, so
a run that took one would produce a session that stops on its first phase.

**Six tickets per run.** The binding constraint is how many PRs the user will
read in one sitting, not the machine. A dozen unreviewed PRs is worse than four,
because the later ones rot while the earlier ones are worked.

Done when every child of the epic is takeable, skipped with a stated reason, or
already finished.

## Waves and file ownership

**The epic body declares its waves** — "B1 and B2 run together, then B3, then
B4, then P1, then P2/P3/P4/P5 run together, then P6." An epic that declares none
runs serial.

**The backbone wave runs serial. Consumer waves run three at a time.** Almost
all collision risk lives in the backbone, because that is the wave whose job is
inventing shared files; consumers mostly add inside their own route folder. Two
parallel sessions that each need the same helper will each invent one, both PRs
will pass CI, and both will pass `/spec-review` — neither duplicate is a stray
against its own ticket. It stays invisible until a human reads both PRs.

Pin each session's task runner with the config's concurrency flag. The runner's
default already stacks test workers until timing-sensitive tests fail on load
alone, and under a self-fix loop a load-induced failure is worse than noise: the
fixer tries to fix it.

## Startup

Assert before the first spawn, not at the phase that trips over it:

- the per-worktree opt-outs `/ship` step 0 writes are **provably inert**,
- each planned session has a port of its own,
- the report directory exists **outside the repo**.

A report file inside a worktree becomes a stray in the diff `/spec-review`
audits.

## The spawn prompt

Everything a session cannot negotiate later goes in its prompt, after the
`/ship` command:

- the paths it owns, and the shared modules it **imports rather than creates**,
- its dev-server port,
- the concurrency pin,
- which step takes the serialization lock, and where the lock lives,
- the per-worktree opt-outs it leaves alone.

Done when every prompt names its own paths, its own port and its own lock rule.
A session that has to ask a sibling for one of them has already collided.

## Watching

Poll `claude agents --json` and read only the sessions you named.

| `status` / `waitingFor` | Means | Disposition |
|---|---|---|
| `waiting` / `input needed` | the reconcile gate is asking | park, and collect the question |
| `waiting` / `permission prompt` | the allowlist is wrong | kill, park, report the denied command, no alarm |
| `busy` | working | nothing |
| `idle` with no PR on its branch | denied outright, or died | park, and read its last message for the command |

The last row is the one a stall-only watch misses. Under the `auto` permission
mode a session never stalls: an unlisted command is **denied outright**, and the
session either works around it or stops and explains. So the abort signal is a
branch that reached the end with no PR, not only a session sitting still.

`kind` separates a session you spawned from the user's own interactive one.
Never act on a session you did not name.

## Human contact

**A blocking spec question parks its ticket, and the run continues.** Never
answer it from precedence rules on the session's behalf: `/ship`'s gate exists
because a conflict found there costs one question, while the same conflict found
at PR time costs a re-implementation, a re-shoot and a body rewrite. A guessed
answer converts the cheap failure into the expensive one, silently.

**Alarm only when no session can progress** — every live session parked on a
question. Run the config's alarm command then, and only then. Waking the user
for a question two other sessions are working around trains them to ignore the
alarm, which costs every later run.

Put the parked questions to the user as one **questions section** (CONTEXT.md),
at most four across the whole run, then `SendMessage` each answer to the session
that asked. A parked session resumes with its context intact, so parking costs
one round trip rather than a re-run.

**A permission stall is not a question.** It means the allowlist is wrong, which
is a config edit rather than a decision: kill the session, park the ticket, write
the exact denied command to the report, and raise no alarm.

Run completion notifies quietly.

## After the PR opens

**CodeRabbit does not review a draft PR** — observed as `Review skipped: draft
pull request`. `/ship` terminates at a draft, so the post-PR review net does not
exist until something promotes it.

So a ticket that reached the end with no abort is **marked ready**, and only then
does the CodeRabbit pass run. An aborted ticket's PR stays a draft: there is no
reason to ping a reviewer at a run that stopped.

Work the comments in **one pass**. `/address-review` splits into two phases only
because it needs a real SHA before it can reply and that SHA requires a human
push; you push your own fix commit, so you already have it. Override its
auto-resolve to never — CodeRabbit closes its own threads on re-review, and a
thread resolved before the user reads it hides what was flagged.

Waiting for CI and the review is nearly free, because it overlaps the next
ticket.

**Flake guard:** the same test failing twice with different error text stops the
loop instead of being fixed a third time.

Done when every finished ticket's PR is ready with its review threads answered,
and every aborted one is a draft whose body says why.

## Draft is the abort signal

Each abort parks one ticket and leaves a **draft PR carrying the reason**.
`/ship` opens drafts anyway, so this costs nothing, and the PR is the only
artifact that appears where the user already looks: a branch with no PR is
invisible among two dozen live worktrees.

A ready PR passed every phase. A draft one did not, and its body says which.

| # | Condition |
|---|---|
| 1 | Residue from the reconcile gate — parked, session resumable |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | `/spec-review` returns `BLOCK` |
| 4 | An assert `FAIL` that survives the expectation re-check |
| 5 | Two adversarial-review rounds with findings still open |
| 6 | A denied command — session stopped, the exact command reported |

## The report

Write it to `~/.claude/orchestrate/<repo>/<epic>/<timestamp>.md`. Never inside
the repo.

One row per child of the epic: the ticket, its verdict, its PR, and for anything
short of ready, the abort number and a one-line reason. Skipped tickets carry
the reason they were skipped, backend ones included.

Then the follow-ups the sessions' PR bodies listed, gathered for the user to
pass to `/to-tickets`. Writing them to the tracker here is refused by the user's
own standing preference.

Done when a reader who watched none of the run can say, per ticket, what
happened and what is theirs to do next.
