---
name: ship-epic
description: Drive an epic's takeable tickets, frontend and backend, to reviewed PRs, a few sessions at a time.
argument-hint: "TRA-XXX [--afk [--until HH:MM]] [--stack]"
disable-model-invocation: true
---

# ship-epic

Drive every **takeable** ticket in one epic to a PR **marked ready for review**, each one through `/tz-skills:ship`, on whichever tracks it touches. This skill owns four things: which tickets it takes, how many run at once, what happens when one blocks, and what the user reads afterwards. Every phase's judgment stays in `/tz-skills:ship`.

It writes no tickets and merges nothing. The human writes the epic and the breakdown.

Design and the probe evidence behind every claim here: [`docs/ship-epic-design.md`](../docs/ship-epic-design.md). What `/tz-skills:ship` owns: [`docs/ship-design.md`](../docs/ship-design.md).

## Sessions, not subagents

Spawn each ticket as its own background session, and run as one yourself:

```bash
claude --bg -n TRA-424 --settings '{"disableAllHooks":true,"agentPushNotifEnabled":false}' "/tz-skills:ship TRA-424 …"
```

**Spawn it with hooks and push notifications off.** Hooks from the user's settings and every plugin fire in every session, so a spawned session that waits or finishes triggers them on its own, bypassing the alarm rule under *Human contact*. The flag turns off every hook, the repo's own included, and `agentPushNotifEnabled` turns off the built-in push notification a session can send on its own. Run the spawn from bash (Git Bash on Windows): Windows PowerShell 5.1 strips the JSON's inner quotes. If the classifier refuses the flag, report an allowlist gap; never spawn without it.

Step 0's per-worktree opt-outs are written after the session enters its worktree, and a `settings.local.json` written then was never read (probes `wt` and `wt2` in the design doc). The flag covers hooks regardless, but whether step 0's `enabledPlugins` opt-out takes effect was not probed and is still open.

Never a subagent. A subagent's grant carries no `ListAgents`, no `SendMessage` and no `AskUserQuestion` — even one declared `Tools: *` — so it can neither coordinate nor ask, and `/tz-skills:ship`'s reconcile gate exists to ask. A session holds all three.

Three consequences shape everything below:

1. A parked ticket holds up nothing else: sessions are separate processes.
2. Nothing reaches a session while it is working, so coordination is **assigned in the spawn prompt**, never negotiated. A parked session can be answered.
3. `claude agents --json` reports each session's `kind`, `status` and `waitingFor`, so a blocked session is visible from outside.

## Config

Read `## Delivery` from `.claude/delivery.md` — the same section `/tz-skills:ship` reads. These keys are this skill's alone, under `### Parallel runs`:

| Key | Holds | Absent |
|---|---|---|
| Max sessions | how many sessions run at once — the machine's memory sets it | 2 |
| Dev server ports | the env var and the range, one port per session | run serial |
| Backend ports | the range a `local` live target takes, one port per backend session | run backend tickets serial |
| Serialized steps | each step only one session may run at a time, and its lock — the backend test command belongs here when parallel runs share one test database | run serial |
| Opt-out check | the command that proves the worktree opt-outs inert | assert nothing, and say so in the report |
| Concurrency pin | the flag that caps one session's task runner | run serial |
| Alarm | the command run when no session can progress | report quietly |
| Ask | the command a session runs to put its own question on the user's screen; it blocks, and prints the answer into that session | ask in the questions section only |
| Status | the command a session runs at each `/tz-skills:ship` step and when it stops | watch from `claude agents --json` alone |
| Run context | the command that tells the command center what the run ships | send nothing |
| Finding | the command a session or the orchestrator runs to show a judge's finding and its outcome on the page | findings reach the user only through the PR body and the report |

A repo with no `## Delivery` section: offer `/tz-skills:setup-tz-skills` once, then ask for the values with a **questions section** (CONTEXT.md).

## Selection

A ticket is **takeable** when all four hold:

- its `statusType` is `backlog` or `unstarted`,
- every `blockedBy` relation is complete, or is a backend ticket this run took to a **ready** PR, or, under `--stack`, is any ticket this run took to a **ready** PR,
- no open PR names it,
- it carries `ready-for-agent`.

**That label is a veto, not a trigger.** It does not discriminate: on the measured epic all thirteen children carried it, including the nine already Done. Removing it parks a ticket, and it does nothing else.

**A ticket blocked only by this run's backend PR builds on the base branch, not on that PR's branch.** Stacking would break on squash merge: once the backend PR squashes, the stacked PR shows its commits again. So the frontend session gets the backend in its spawn prompt instead — the PR's preview URL, or its worktree and port for a `local` target — and `/tz-skills:ship` proves the frontend against it. The frontend PR then reads `Merge after #N`, and the report names the merge order. A frontend PR's own API client must not need the backend branch's code to compile; where it does, the ticket waits for the merge.

**Under `--stack`, a ticket blocked by this run's own ticket builds on that ticket's branch instead.** The user asks for it when a chain of full-stack tickets would otherwise ship one PR per run. **Read [`references/stack.md`](references/stack.md) at startup when the run has `--stack`**: the merge-commit check, when a child spawns and on which base, and how a child reaches the base after its parent squashes.

**Six tickets per run.** The binding constraint is how many PRs the user will read in one sitting, not the machine. A dozen unreviewed PRs is worse than four, because the later ones rot while the earlier ones are worked.

Done when every child of the epic is takeable, skipped with a stated reason, or already finished.

## Waves and file ownership

**The epic body declares its waves** — "B1 and B2 run together, then B3, then B4, then P1, then P2/P3/P4/P5 run together, then P6." An epic that declares none runs serial.

**The backbone wave runs serial. Consumer waves run up to `Max sessions` at a time.** Almost all collision risk lives in the backbone, because that is the wave whose job is inventing shared files; consumers mostly add inside their own route folder. Two parallel sessions that each need the same helper will each invent one, both PRs will pass CI, and both will pass `/tz-skills:spec-review` — neither duplicate is a stray against its own ticket. It stays invisible until a human reads both PRs.

**A ticket whose session stopped at `review` holds no place.** Its PR is ready, and the bot and CI are all it waits on, so for `Max sessions` and for serial order it counts as finished until a `resume` line brings it back. Start the next ticket meanwhile. A resumed session takes the next free place, ahead of any ticket not yet started.

Pin each session's task runner with the config's concurrency flag. The runner's default already stacks test workers until timing-sensitive tests fail on load alone, and under a self-fix loop a load-induced failure is worse than noise: the fixer tries to fix it.

## Startup

Assert before the first spawn, not at the phase that trips over it:

- the per-worktree opt-outs `/tz-skills:ship` step 0 writes are **provably inert**,
- each planned session has a port of its own, and each backend session on a `local` target a backend port too,
- the report directory exists **outside the repo**,
- where the config names `Run context`, the command center has been sent the run: every child of the epic, finished ones too, each with its wave and the ticket it waits for.

A report file inside a worktree becomes a stray in the diff `/tz-skills:spec-review` audits.

## The spawn prompt

Everything a session cannot negotiate later goes in its prompt, after the `/tz-skills:ship` command:

- the paths it owns, and the shared modules it **imports rather than creates**,
- its dev-server port,
- the concurrency pin,
- which step takes the serialization lock, and where the lock lives,
- the per-worktree opt-outs it leaves alone,
- for a backend session, the **migration numbers it owns**, one per service it will migrate, reserved above the base branch, every open PR, and every sibling's reservation,
- for a frontend session blocked by this run's backend PR, that backend: the PR number, and its preview URL or its worktree and backend port,
- under `--stack`, its base: the parent ticket's branch and PR number,
- the config's `Ask` and `Status` commands, word for word, with the rules under *The command center*, and the line `The command center holds your review wait.`,
- under `--afk`, the rule quoted in `references/afk.md`,
- that a reviewer's design finding is refused only with the frame that settles it. "No frame draws it" needs a search of the ticket's frames and their siblings first; when the search finds nothing, the session asks through `Ask` and does not refuse.

Migration numbers are reserved here because siblings are on no branch the others can see: each would take the same next number, and the collision surfaces only when the second one merges.

Done when every prompt names its own paths, its own port and its own lock rule. A session that has to ask a sibling for one of them has already collided.

## Watching

Poll `claude agents --json` and read only the sessions you named. It lists your own profile alone: where `ship-ui.ts profiles` prints more than one folder, a session the user moved to another profile is listed by `CLAUDE_CONFIG_DIR=<folder> claude agents --json`, and attached to or resumed under that same folder, as the command center prints it.

**Where the config names `Status`, run the command center's `watch` too, in the background, and never write a watcher of your own.** `bun ~/.claude/ship-ui/ship-ui.ts watch` prints one line for each new thing to act on: `question <id> from <ticket>`, `resume <ticket>: review bot finished on #<pr>, CI green` for a session that handed over its review wait, `resume <ticket>: <n> review threads open on #<pr>`, `resume <ticket>: CI failing on #<pr>`, `resume <ticket>: #<pr> conflicts with <branch>` or `resume <ticket>: the user asked to fix <id>: <claim>`, `<ticket> stopped: <reason>`, and `quiet <ticket>: no update for <n> min at step <step>`. A `resume` line means a finished session's PR needs it again: resume that session to run `/tz-skills:ship` step 12. For a conflict, tell it to merge the base branch in first; for a fix the user asked for, give it the finding's id, claim and note. A `quiet` line is not a stop: read the end of that session's transcript, and resume it only when its last turn ended with the `/tz-skills:ship` steps unfinished. A session still inside a turn is working, and resuming it starts a second copy in the same worktree. **One writer per worktree.** `claude --bg --resume <id>` with flags starts a copy under the same name, so names repeat. Before resuming a ticket, list its sessions with `ListAgents`. If any is busy, message that one by `name [ref]`. A bare name can reach an idle older copy, which wakes up and edits the same files. When looping over spawns in a script, give each `claude` call `</dev/null`, or it reads the rest of the loop's input as its own. Findings a reviewer left open on a finished ticket wait under "Needs you" for the user to accept for now or send back; never rule on one yourself. The command center reads the review bot and CI correctly, from the PR's status contexts as well as its check runs; a hand-written watcher on the pilot read check runs only, never saw CodeRabbit's review, and left a ticket idle for forty minutes.

| `status` / `waitingFor` | Means | Disposition |
|---|---|---|
| `waiting` / `input needed` | the reconcile gate is asking | park, and collect the question |
| `waiting` / `permission prompt` | the allowlist is wrong | kill, park, report the denied command, no alarm |
| `busy` | working | nothing |
| `idle`, its status `stopped: review` | its PR is ready and waits on the review bot and CI | nothing until `watch` prints its `resume` line; it holds no place |
| `idle` with no PR on its branch | denied outright, or died | park, and read its last message for the command |

The last row is the one a stall-only watch misses. Under the `auto` permission mode a session never stalls: an unlisted command is **denied outright**, and the session either works around it or stops and explains. So the abort signal is a branch that reached the end with no PR, not only a session sitting still.

`kind` separates a session you spawned from the user's own interactive one. Never act on a session you did not name.

## Human contact

**A blocking spec question parks its ticket, and the run continues.** Never answer it from precedence rules on the session's behalf (under `--afk`, `references/afk.md` decides the revertible ones): `/tz-skills:ship`'s gate exists because a conflict found there costs one question, while the same conflict found at PR time costs a re-implementation, a re-shoot and a body rewrite. A guessed answer converts the cheap failure into the expensive one, silently.

**Alarm only when no session can progress** — every live session parked on a question. Run the config's alarm command then, and only then. Waking the user for a question two other sessions are working around trains them to ignore the alarm, which costs every later run.

**Your own questions go on the command center too, when the config names `Ask`.** Run it yourself in the background with `--ticket RUN`, one call per question, in the same shape a session uses; it pops up and waits under "Needs you", and its answer is printed back to you. A question left only in this chat is one the user never sees: an unattended user reads the command center, not this session. Write the questions section here as well, for the record.

Put the parked questions to the user as one **questions section** (CONTEXT.md), at most four across the whole run, then `SendMessage` each answer to the session that asked. A parked session resumes with its context intact, so parking costs one round trip rather than a re-run.

**Where the config names an `Ask` command, the session asks through it, not you.** The command goes in the spawn prompt. The session runs it in the background when its gate finds a question, one call per question: the question, its options with what the user would see, the recommended one, the `Asked because:` line, and a diff or JSON example where one makes the choice easier to picture. The command blocks until the user answers, and prints the answer into the session that asked, so the answer is the user's own and there is nothing to relay. Never put the same question on screen yourself: two cards for one question collect two answers. The questions section is still written for a question the command could not deliver, and `SendMessage` stays the route for those.

**A session that doubts a relayed answer is answered by the user, in that session.** It was told nothing reaches it mid-run, so it may refuse to take another session's word that an answer is the user's. Do not argue or re-send: tell the user which session to attach to, and what to type.

**A permission stall is not a question.** It means the allowlist is wrong, which is a config edit rather than a decision: kill the session, park the ticket, write the exact denied command to the report, and raise no alarm.

Run completion notifies quietly.

## The command center

Optional, and on when the config names `Status`. It is a local page that holds what the run knows, so the knowledge outlives you: an orchestrator gets compacted, runs out of usage or restarts, and a run watched only from its memory goes stale each time. The files are in [`command-center/`](./command-center/).

**Every session reports for itself.** `Status` at the start of each `/tz-skills:ship` step, with the step, what it is doing and its model; with its PR once one exists; and once more when it stops, with one reason from the command's fixed list. You are no longer the only writer, which is what kept a measured run's page wrong whenever the orchestrator was busy.

**A `revised:` line in a `Status` reply is the user changing an earlier answer.** The session redoes what the old answer touched, and says so in its commit message. A change to a finished ticket never reaches a session: the command center keeps it as a follow-up, and the report carries it.

**Merge state comes from the host, not from a session.** The command center reads each ticket's PR through `gh`, so a ticket merged before the run, or after its session ended, still reads merged. That is why `Run context` lists every child, not only the takeable ones.

**The report is still written.** The page holds the run while it runs, and the report is what the user reads afterwards. Carry the page's decisions into it, changed answers included.

## Unattended: `--afk`

`/tz-skills:ship-epic <epic> --afk [--until HH:MM]` runs the epic while the user is away. It needs the command center: without `Ask`, `Status` and `Finding` in the config, refuse `--afk` and say which key is missing. Your own review findings reach the page as *After the PR opens* says, `O<n>` ids included.

**Under `--afk`, read [`references/afk.md`](references/afk.md) before the first spawn.** It decides which questions you answer yourself and how, adds a rule to every spawn prompt, silences the alarm, sets the cutoff, keeps the machine awake, and says what the user finds in the morning.

## After the PR opens

`/tz-skills:ship` step 12 marks its own PR ready and works CodeRabbit's comments, so nothing here promotes or fixes. Read the outcome instead: a ready PR passed every phase, and a draft one did not.

**Name every `RATE_LIMITED` review in the report.** Every session pushes as the same user, so they share the bot's rate limit — a multi-ticket run is where it bites, and the user needs to know which PRs no bot looked at.

**A `RATE_LIMITED` or `NO_BOT` PR already had its fallback reviewer**: `/tz-skills:ship` step 12 runs it. A clean fallback review makes the PR ready for review, backup-reviewed; carry that into the report with CodeRabbit named as rate limited or the repo as running no bot, and list what is still open for any PR that is not clean.

**Three more reviewers read each ready PR. Read [`references/pr-reviewers.md`](references/pr-reviewers.md) once the first PR is ready**: an adversarial reviewer for a PR the bot skipped for its base, a visual reviewer for every PR with screenshots, and a completeness checker for every PR. Their findings are yours, as `O<n>`.

Waiting for CI and the review is nearly free: each session hands that wait to the command center, and the next ticket runs meanwhile.

Done when every finished ticket's PR is ready with its review threads answered or its fallback review clean, its screenshots visually reviewed, its completeness checked, and every aborted one is a draft whose body says why.

## Draft is the abort signal

Each abort parks one ticket and leaves a **draft PR carrying the reason**. `/tz-skills:ship` opens drafts anyway, so this costs nothing, and the PR is the only artifact that appears where the user already looks: a branch with no PR is invisible among two dozen live worktrees.

A ready PR passed every phase. A draft one did not, and its body says which.

| # | Condition |
|---|---|
| 1 | Residue from the reconcile gate — parked, session resumable |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | `/tz-skills:spec-review` returns `BLOCK` — under `lenient`, a `MISSING` row or a second `BLOCK` |
| 4 | An assert `FAIL` that survives the expectation re-check |
| 5 | Two adversarial-review rounds with findings still open |
| 5b | `/tz-skills:spec-review` printed no verdict, or `NEEDS_ROWS` / `NO_CONTRACT` — `/tz-skills:ship` abort 9 |
| 5c | The rate-limit fallback reviewer holds a `blocker` or `major` — `/tz-skills:ship` abort 10, PR back to draft |
| 6 | A denied command — session stopped, the exact command reported |
| 7 | A backend live target that never came up |

## The report

Write it to `~/.claude/orchestrate/<repo>/<epic>/<timestamp>.md`. Never inside the repo.

One row per child of the epic: the ticket, its verdict, its PR, and for anything short of ready, the abort number and a one-line reason. Skipped tickets carry the reason they were skipped.

Then the **merge order**: every `Merge after #N` pair, backend first. A frontend PR merged ahead of its backend ships calls to an endpoint that does not exist yet. Under `--stack`, the chain merges bottom-up, and each PR is retargeted to the base once its parent merges. GitHub does that by itself only when the repo deletes merged branches, so name the setting (`delete_branch_on_merge`) when it is off.

On a squash-only repo, the child then conflicts with the base. Bring it over once the user merges the parent, as [`references/stack.md`](references/stack.md), After the parent merges, says.

Delete every infra namespace a `local` session created before the report is final; name any that would not delete.

Then the follow-ups the sessions' PR bodies listed, gathered for the user to pass to `/mattpocock-skills:to-tickets`. Writing them to the tracker here is refused by the user's own standing preference.

**Read [`references/report-follow-ups.md`](references/report-follow-ups.md) before gathering them**: the admission filter, the fields each carries, the anchor re-check, and merging across tickets.

Duration goes in the report too: per session, start and end in the user's local zone, and the run's wall clock. Token and dollar figures do not — the transcripts carry usage, but a subscription is not billed per token, so a computed cost is a list-price estimate wearing the clothes of an invoice.

**A path in this report is not evidence.** The report lives outside the repo, so every artifact it names — a clip, a wire log, a frame — is unreachable to anyone but the machine that wrote it. Name the uploaded URL beside the path, and where a session finished without uploading, upload the recorded file yourself rather than re-running the phase that made it.

Done when a reader who watched none of the run can say, per ticket, what happened and what is theirs to do next, and can open every artifact the report cites.
