---
name: ship-epic
description: Drive an epic's takeable tickets, frontend and backend, to reviewed PRs, a few sessions at a time.
argument-hint: "TRA-XXX [--afk [--until HH:MM]]"
disable-model-invocation: true
---

# ship-epic

Drive every **takeable** ticket in one epic to a PR **marked ready for review**, each one through `/ship`, on whichever tracks it touches. This skill owns four things: which tickets it takes, how many run at once, what happens when one blocks, and what the user reads afterwards. Every phase's judgment stays in `/ship`.

It writes no tickets and merges nothing. The human writes the epic and the breakdown.

Design and the probe evidence behind every claim here: [`docs/ship-epic-design.md`](../docs/ship-epic-design.md). What `/ship` owns: [`docs/ship-design.md`](../docs/ship-design.md).

## Sessions, not subagents

Spawn each ticket as its own background session, and run as one yourself:

```bash
claude --bg -n TRA-424 --settings '{"disableAllHooks":true,"agentPushNotifEnabled":false}' "/ship TRA-424 …"
```

**Spawn it with hooks and push notifications off.** Hooks from the user's settings and every plugin fire in every session, so a spawned session that waits or finishes triggers them on its own, bypassing the alarm rule under *Human contact*. The flag turns off every hook, the repo's own included, and `agentPushNotifEnabled` turns off the built-in push notification a session can send on its own. Run the spawn from bash (Git Bash on Windows): Windows PowerShell 5.1 strips the JSON's inner quotes. If the classifier refuses the flag, report an allowlist gap; never spawn without it.

Step 0's per-worktree opt-outs are written after the session enters its worktree, and a `settings.local.json` written then was never read (probes `wt` and `wt2` in the design doc). The flag covers hooks regardless, but whether step 0's `enabledPlugins` opt-out takes effect was not probed and is still open.

Never a subagent. A subagent's grant carries no `ListAgents`, no `SendMessage` and no `AskUserQuestion` — even one declared `Tools: *` — so it can neither coordinate nor ask, and `/ship`'s reconcile gate exists to ask. A session holds all three.

Three consequences shape everything below:

1. A parked ticket holds up nothing else: sessions are separate processes.
2. Nothing reaches a session while it is working, so coordination is **assigned in the spawn prompt**, never negotiated. A parked session can be answered.
3. `claude agents --json` reports each session's `kind`, `status` and `waitingFor`, so a blocked session is visible from outside.

## Config

Read `## Delivery` from `.claude/delivery.md` — the same section `/ship` reads. These keys are this skill's alone, under `### Parallel runs`:

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
| Status | the command a session runs at each `/ship` step and when it stops | watch from `claude agents --json` alone |
| Run context | the command that tells the command center what the run ships | send nothing |
| Finding | the command a session or the orchestrator runs to show a judge's finding and its outcome on the page | findings reach the user only through the PR body and the report |

A repo with no `## Delivery` section: offer `/setup-tz-skills` once, then ask for the values with a **questions section** (CONTEXT.md).

## Selection

A ticket is **takeable** when all four hold:

- its `statusType` is `backlog` or `unstarted`,
- every `blockedBy` relation is complete, or is a backend ticket this run took to a **ready** PR,
- no open PR names it,
- it carries `ready-for-agent`.

**That label is a veto, not a trigger.** It does not discriminate: on the measured epic all thirteen children carried it, including the nine already Done. Removing it parks a ticket, and it does nothing else.

**A ticket blocked only by this run's backend PR builds on the base branch, not on that PR's branch.** Stacking would break on squash merge: once the backend PR squashes, the stacked PR shows its commits again. So the frontend session gets the backend in its spawn prompt instead — the PR's preview URL, or its worktree and port for a `local` target — and `/ship` proves the frontend against it. The frontend PR then reads `Merge after #N`, and the report names the merge order. A frontend PR's own API client must not need the backend branch's code to compile; where it does, the ticket waits for the merge.

**Six tickets per run.** The binding constraint is how many PRs the user will read in one sitting, not the machine. A dozen unreviewed PRs is worse than four, because the later ones rot while the earlier ones are worked.

Done when every child of the epic is takeable, skipped with a stated reason, or already finished.

## Waves and file ownership

**The epic body declares its waves** — "B1 and B2 run together, then B3, then B4, then P1, then P2/P3/P4/P5 run together, then P6." An epic that declares none runs serial.

**The backbone wave runs serial. Consumer waves run up to `Max sessions` at a time.** Almost all collision risk lives in the backbone, because that is the wave whose job is inventing shared files; consumers mostly add inside their own route folder. Two parallel sessions that each need the same helper will each invent one, both PRs will pass CI, and both will pass `/spec-review` — neither duplicate is a stray against its own ticket. It stays invisible until a human reads both PRs.

Pin each session's task runner with the config's concurrency flag. The runner's default already stacks test workers until timing-sensitive tests fail on load alone, and under a self-fix loop a load-induced failure is worse than noise: the fixer tries to fix it.

## Startup

Assert before the first spawn, not at the phase that trips over it:

- the per-worktree opt-outs `/ship` step 0 writes are **provably inert**,
- each planned session has a port of its own, and each backend session on a `local` target a backend port too,
- the report directory exists **outside the repo**,
- where the config names `Run context`, the command center has been sent the run: every child of the epic, finished ones too, each with its wave and the ticket it waits for.

A report file inside a worktree becomes a stray in the diff `/spec-review` audits.

## The spawn prompt

Everything a session cannot negotiate later goes in its prompt, after the `/ship` command:

- the paths it owns, and the shared modules it **imports rather than creates**,
- its dev-server port,
- the concurrency pin,
- which step takes the serialization lock, and where the lock lives,
- the per-worktree opt-outs it leaves alone,
- for a backend session, the **migration numbers it owns**, one per service it will migrate, reserved above the base branch, every open PR, and every sibling's reservation,
- for a frontend session blocked by this run's backend PR, that backend: the PR number, and its preview URL or its worktree and backend port,
- the config's `Ask` and `Status` commands, word for word, with the rules under *The command center*,
- under `--afk`, the rule quoted under *Unattended*.

Migration numbers are reserved here because siblings are on no branch the others can see: each would take the same next number, and the collision surfaces only when the second one merges.

Done when every prompt names its own paths, its own port and its own lock rule. A session that has to ask a sibling for one of them has already collided.

## Watching

Poll `claude agents --json` and read only the sessions you named.

| `status` / `waitingFor` | Means | Disposition |
|---|---|---|
| `waiting` / `input needed` | the reconcile gate is asking | park, and collect the question |
| `waiting` / `permission prompt` | the allowlist is wrong | kill, park, report the denied command, no alarm |
| `busy` | working | nothing |
| `idle` with no PR on its branch | denied outright, or died | park, and read its last message for the command |

The last row is the one a stall-only watch misses. Under the `auto` permission mode a session never stalls: an unlisted command is **denied outright**, and the session either works around it or stops and explains. So the abort signal is a branch that reached the end with no PR, not only a session sitting still.

`kind` separates a session you spawned from the user's own interactive one. Never act on a session you did not name.

## Human contact

**A blocking spec question parks its ticket, and the run continues.** Never answer it from precedence rules on the session's behalf (under `--afk`, *Unattended* below decides the revertible ones): `/ship`'s gate exists because a conflict found there costs one question, while the same conflict found at PR time costs a re-implementation, a re-shoot and a body rewrite. A guessed answer converts the cheap failure into the expensive one, silently.

**Alarm only when no session can progress** — every live session parked on a question. Run the config's alarm command then, and only then. Waking the user for a question two other sessions are working around trains them to ignore the alarm, which costs every later run.

Put the parked questions to the user as one **questions section** (CONTEXT.md), at most four across the whole run, then `SendMessage` each answer to the session that asked. A parked session resumes with its context intact, so parking costs one round trip rather than a re-run.

**Where the config names an `Ask` command, the session asks through it, not you.** The command goes in the spawn prompt. The session runs it in the background when its gate finds a question, one call per question: the question, its options with what the user would see, the recommended one, the `Asked because:` line, and a diff or JSON example where one makes the choice easier to picture. The command blocks until the user answers, and prints the answer into the session that asked, so the answer is the user's own and there is nothing to relay. Never put the same question on screen yourself: two cards for one question collect two answers. The questions section is still written for a question the command could not deliver, and `SendMessage` stays the route for those.

**A session that doubts a relayed answer is answered by the user, in that session.** It was told nothing reaches it mid-run, so it may refuse to take another session's word that an answer is the user's. Do not argue or re-send: tell the user which session to attach to, and what to type.

**A permission stall is not a question.** It means the allowlist is wrong, which is a config edit rather than a decision: kill the session, park the ticket, write the exact denied command to the report, and raise no alarm.

Run completion notifies quietly.

## The command center

Optional, and on when the config names `Status`. It is a local page that holds what the run knows, so the knowledge outlives you: an orchestrator gets compacted, runs out of usage or restarts, and a run watched only from its memory goes stale each time. The files are in [`command-center/`](./command-center/).

**Every session reports for itself.** `Status` at the start of each `/ship` step, with the step, what it is doing and its model; with its PR once one exists; and once more when it stops, with one reason from the command's fixed list. You are no longer the only writer, which is what kept a measured run's page wrong whenever the orchestrator was busy.

**A `revised:` line in a `Status` reply is the user changing an earlier answer.** The session redoes what the old answer touched, and says so in its commit message. A change to a finished ticket never reaches a session: the command center keeps it as a follow-up, and the report carries it.

**Merge state comes from the host, not from a session.** The command center reads each ticket's PR through `gh`, so a ticket merged before the run, or after its session ended, still reads merged. That is why `Run context` lists every child, not only the takeable ones.

**The report is still written.** The page holds the run while it runs, and the report is what the user reads afterwards. Carry the page's decisions into it, changed answers included.

## Unattended: `--afk`

`/ship-epic <epic> --afk [--until HH:MM]` runs the epic while the user is away. Everything above holds except what this section changes. It needs the command center: without `Ask`, `Status` and `Finding` in the config, refuse `--afk` and say which key is missing. Your own review findings reach the page as *After the PR opens* says, `O<n>` ids included.

**Decide if revertible, park if not.** Answer a session's question yourself if and only if a changed answer can be undone: nothing outside the unmerged branch has happened yet, and the user can change it when reviewing. A code or design choice inside a draft PR always qualifies. So does test data on staging written through the app's own screens and endpoints, the way live verification drives them: the user accepts that it stays, even where financial rows can only be reversed. Everything else outside the branch parks as above: touching a database directly (a SQL shell, a script on its connection string, a migration run by hand), sending a message, posting publicly, merging, deploying, granting access. Judge each option, not the question: offered "fix the row with SQL" and "redo it through the form", pick the form, never the SQL. When no option qualifies, or you are unsure, park it.

**Answer through the command center, labelled as yours.** `ship-ui.mjs questions` lists what is open. `ship-ui.mjs answer --id <id> --choice <label> --note "<why, and what makes it revertible>" --as orchestrator` answers one: the session's blocked `ask` prints the choice, then `by: orchestrator` and `decision: D<n>`. Never `SendMessage` an answer and never word one as the user's: a session rightly refuses an answer that arrives unasked from another session claiming to be the user.

**Tell every session the rule before it starts.** Add this to each spawn prompt, word for word:

> This run is unattended (`--afk`). An answer your `ask` command prints with `by: orchestrator` is binding, the same as the user's: the orchestrator decided it because it can be reverted, and the user may change it later through a `revised:` line from `status`. Name its `decision: D<n>` in the commit message it shapes. Such a decision never holds your PR back: take it to ready and work the review bot's threads exactly as step 12 says, and list each decision in the PR body under `Decided unattended`, with its question, choice and note, so the reviewer sees it. If step 9's `BLOCK` would abort the run and its only causes are strays, do not stop: ask it through `ask`, one question per stray, with the options `Keep` and `Revert`, and resume as step 9 says a `BLOCK` the user rules on resumes. A `MISSING` row still aborts, as abort 4.

**Every such answer is an unattended decision.** The command center numbers it `D<n>` per run and shows it as "decided while you were away", with your note as its reason. The user changes one on the page, or in this chat as "D3: No", which you pass on with `ship-ui.mjs revise --decision D3 --choice No`. Either way it reaches a running session through its next `status` call, and a finished ticket gets a follow-up.

**A spec-review `BLOCK` on strays alone is yours to rule.** Keep or revert: both live on the branch, so it is a `D<n>` like any other. Revert unless the stray is the only way the ticket's own criteria pass. The repo's `Spec-review BLOCK` setting still decides when a `BLOCK` aborts; this only rules on one that would. A `MISSING` row still blocks.

**Nothing sounds.** The alarm never fires under `--afk`, and `Run context` carries `"afk": true`, which turns the command center's pop-ups off for the run; the user turns them back on from the page. A question you cannot decide parks and the run goes on; when every live session is parked, start nothing and wait. When the run ends, send one quiet push notification naming the command center's address and the report's path.

**The cutoff.** No ticket starts after `--until`. At start, state it in the machine's local zone with its UTC offset and the time left, from `date` on this machine, for example "no new tickets after 07:00 WIB (UTC+7), 7h 40m from now". WSL's zone can differ from Windows', and this line is where a wrong one shows before the user sleeps. The six-ticket cap still holds.

**Stop and abort.** "stop" in this chat starts nothing new and lets running tickets finish. "abort" kills every session you spawned, and each leaves a draft whose body says it was aborted and at which step.

**Stay awake, let the screen sleep.** Before the first spawn, start [`scripts/wake-lock.mjs`](./scripts/wake-lock.mjs) with `node` in the background. It holds the system awake and never the display, finds the `claude` process above it, and lets go when that process exits or after 12 hours (`--hours` moves the cap). On Windows it holds `ES_CONTINUOUS | ES_SYSTEM_REQUIRED` through PowerShell, which it reaches from WSL too; `caffeinate -i` on macOS; `systemd-inhibit` on Linux.

**The morning.** The user comes back to a list of PRs ready for review, not drafts waiting on a ruling: an unattended decision is recorded, never a reason to hold a PR. The report and the command center list each ready PR with its `D<n>` decisions. "D3: No" in this chat changes one, and the session redoes what it touched on the same PR. A session that stopped with its PR a draft for no abort reason is yours to resume through step 12.

## After the PR opens

`/ship` step 12 marks its own PR ready and works CodeRabbit's comments, so nothing here promotes or fixes. Read the outcome instead: a ready PR passed every phase, and a draft one did not.

**Name every `RATE_LIMITED` review in the report.** Every session pushes as the same user, so they share the bot's rate limit — a multi-ticket run is where it bites, and the user needs to know which PRs no bot looked at.

**A rate-limited PR already had its fallback reviewer**: `/ship` step 12 runs it, and reports the PR as waiting on CodeRabbit. Carry that wording into the report, never "ready for review".

**A PR the bot skipped for its base gets an adversarial reviewer instead.** When its base is not `main`, spawn one `tz-fresh-reviewer` per such PR, given its diff from its own base saved as a file, with the ticket as the spec. Never pay for the bot's on-demand review, and never keep re-asking it — the limit is shared, so a re-ask only spends it. A reviewer needs no `SendMessage` or `AskUserQuestion`: it reads and reports, which is the one job a subagent's grant fits. Verify each finding against the code yourself, then hand the confirmed ones to that ticket's session to fix, as its own CodeRabbit comments would be. Show every finding to the user through the config's `Finding` command too, confirmed or not, with what you did about it: the user reads the command center, not the hand-off. Give yours ids `O<n>`, so they never collide with a session's `F<n>`, and re-send the same id when its outcome changes. Send `--verdict running` when your review starts and its verdict when it ends: a finished ticket shows as being reviewed only in between. The report names which PRs were reviewed this way.

Waiting for CI and the review is nearly free, because it overlaps the next ticket.

Done when every finished ticket's PR is ready with its review threads answered or named as waiting on CodeRabbit, and every aborted one is a draft whose body says why.

## Draft is the abort signal

Each abort parks one ticket and leaves a **draft PR carrying the reason**. `/ship` opens drafts anyway, so this costs nothing, and the PR is the only artifact that appears where the user already looks: a branch with no PR is invisible among two dozen live worktrees.

A ready PR passed every phase. A draft one did not, and its body says which.

| # | Condition |
|---|---|
| 1 | Residue from the reconcile gate — parked, session resumable |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | `/spec-review` returns `BLOCK` — under `lenient`, a `MISSING` row or a second `BLOCK` |
| 4 | An assert `FAIL` that survives the expectation re-check |
| 5 | Two adversarial-review rounds with findings still open |
| 5b | `/spec-review` printed no verdict, or `NEEDS_ROWS` / `NO_CONTRACT` — `/ship` abort 9 |
| 5c | The rate-limit fallback reviewer holds a `blocker` or `major` — `/ship` abort 10, PR back to draft |
| 6 | A denied command — session stopped, the exact command reported |
| 7 | A backend live target that never came up |

## The report

Write it to `~/.claude/orchestrate/<repo>/<epic>/<timestamp>.md`. Never inside the repo.

One row per child of the epic: the ticket, its verdict, its PR, and for anything short of ready, the abort number and a one-line reason. Skipped tickets carry the reason they were skipped.

Then the **merge order**: every `Merge after #N` pair, backend first. A frontend PR merged ahead of its backend ships calls to an endpoint that does not exist yet.

Delete every infra namespace a `local` session created before the report is final; name any that would not delete.

Then the follow-ups the sessions' PR bodies listed, gathered for the user to pass to `/mattpocock-skills:to-tickets`. Writing them to the tracker here is refused by the user's own standing preference.

**Filter before you gather.** Carry only follow-ups that pass `/ship` 11b's admission bar: a problem a user can notice today, or a known unfixed bug, named in one sentence. Drop refactors, coverage gaps for working code, "a future change could break this", accepted cosmetic nits, and orchestrator-review notes that were verified as not defects — even when a session listed them. Aim for zero to five per run, ranked by what a user loses. A measured run carried 16 and the user kept 2; the other 14 were noise that buried them.

**Say it is a proposal.** End the section with one line: the list is for the user to grill, not to hand to `to-tickets` as is. Never suggest running `to-tickets` on the list before the user has ruled on each item.

**Carry every field, not the one-line summary.** `/ship` step 11b fixes the shape — surface, severity, why it exists, what breaks if it never ships, effort with its reason, and a `file:line` anchor. The PR body holds the short form because a reviewer scans; this report is the long form, and it is what `/mattpocock-skills:to-tickets` reads. A report that copies the PR's one-liners throws away the half that makes a follow-up rulable.

**Re-check the anchors before writing them down.** A session's own summary of its follow-ups is the least verified prose it produced — it is written last, after the gates, and nothing audits it. Counts and file references stated there have been wrong in a measured run. Grep each one.

**Merge across tickets, not just within one.** A session sees only its own diff, so it cannot notice that two tickets raised the same follow-up, or that one ticket's refactor dissolves another's bug. That judgment exists only here. Merging never promotes an item: two refactor notes merged are still a refactor note, and still dropped.

Duration goes in the report too: per session, start and end in the user's local zone, and the run's wall clock. Token and dollar figures do not — the transcripts carry usage, but a subscription is not billed per token, so a computed cost is a list-price estimate wearing the clothes of an invoice.

**A path in this report is not evidence.** The report lives outside the repo, so every artifact it names — a clip, a wire log, a frame — is unreachable to anyone but the machine that wrote it. Name the uploaded URL beside the path, and where a session finished without uploading, upload the recorded file yourself rather than re-running the phase that made it.

Done when a reader who watched none of the run can say, per ticket, what happened and what is theirs to do next, and can open every artifact the report cites.
