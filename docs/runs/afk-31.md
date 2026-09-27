# AFK run: epic #31

A one-off brief for an unattended overnight run that works every ticket under #31 on teszerrakt/tz-skills. It is a hand-written first run of #48 (`/ship-epic --afk`), because the skills that would do this are the ones being rebuilt. Start it in a fresh Claude Desktop session on the Windows machine, in `auto` permission mode, on Claude Fable 5.1 at `high` effort, with: `run docs/runs/afk-31.md until HH:MM`. Workers run on Claude Opus 5.5 at `xhigh`: the orchestrator holds the judgment calls — gates, findings, merges — while the workers hold the token volume, and an overnight run that exhausts the plan's usage limit stalls until morning.

You are the **orchestrator**. You start one worker session per ticket, gate what it hands back, merge passing work into an integration branch, and keep a live record. You never ask the user anything: the user is asleep. Every question you or a worker would ask becomes an **unattended decision**, recorded and reversible in the morning.

## Before the first ticket

1. **Repos.** Find or clone `teszerrakt/tz-skills`, `teszerrakt/diurna` and `klaylab/klay` on this machine. Fetch each.
2. **Integration branch.** In tz-skills, create `afk/31` from `origin/main` if it does not exist, and push it. Every tz-skills ticket branches from `afk/31` and opens its PR against `afk/31`. Nothing in this run touches `main`.
3. **State.** Keep run state in `~/.claude/orchestrate/tz-skills/31/state.json`: per ticket its status, branch, PR, session name, decisions and gate results. Read it first: a second night resumes where the first stopped.
4. **Cutoff.** Say back the cutoff in the machine's local zone, with its UTC offset and time remaining — "no new tickets after 07:00 WIB (UTC+7), 7h 40m from now". Windows' zone is the truth; if you are in WSL and its zone differs, use Windows'.
5. **Wake lock.** Keep the system awake and let the display sleep (OLED): hold `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)` and never `ES_DISPLAY_REQUIRED`. Create the lock file `~/.claude/orchestrate/tz-skills/31/awake`, then start a hidden PowerShell that holds the lock while that file exists:

   ```powershell
   $k = Add-Type -Name K -Namespace W -PassThru -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
   while (Test-Path "$HOME\.claude\orchestrate\tz-skills\31\awake") { $k::SetThreadExecutionState(0x80000001) | Out-Null; Start-Sleep 60 }
   $k::SetThreadExecutionState(0x80000000) | Out-Null
   ```

   Delete the lock file when the run ends, however it ends.
6. **Silence.** Nothing may sound overnight. Start every worker with hooks disabled (`--settings '{"disableAllHooks":true}'`): the user's global `Notification` hook beeps once per session event, which is bug #49.
7. **Live record.** Create one artifact for the epic, titled "Epic #31 run", with a `db` collection per section below. Load the `artifact-design` and `artifact-capabilities` skills first. It updates as rows are written:
   - **Tickets** — each ticket's status, PR, branch, and the gate that stopped it
   - **Merge order** — the order work landed on `afk/31`, then the cross-repo draft PRs and what each must merge after
   - **Decisions** — `D1`, `D2`… each with the question, the options, the choice, why, and the ticket
   - **Parked** — tickets that could not finish, and why
   - **Follow-ups** — only problems a user could notice today, or known unfixed bugs, each in one sentence with a `file:line` anchor

   If artifacts are unavailable, write the same record to `~/.claude/orchestrate/tz-skills/31/report.md` as the run goes.

## The tickets

A ticket is **done** when its PR is merged into `afk/31` (tz-skills) or its draft PR exists in its own repo (cross-repo). GitHub will not close an issue on a merge into `afk/31`; that is expected, so track done-ness in the state file, never from issue state.

| Ticket | Blocked by | Where |
|---|---|---|
| #32 | — | tz-skills |
| #33 | #32 | tz-skills |
| #34, #35, #38, #39, #42 | #33 | tz-skills |
| #36, #37 | #35 | tz-skills |
| #40 | #39 | tz-skills |
| #41 | #39, #40 | tz-skills |
| #43, #44 | #42 | tz-skills; #44 is proven against Klay's Storybook |
| #48 | #37 | tz-skills |
| #45 | #34, #36 | diurna, not pdf-unlock (it has no open tickets) |
| #46 | #34, #36, #37, #43, #44 | klay |
| #49 | — | this machine |

Run **two workers at a time**. #32 and #33 run alone, in that order: they invent the plugin and the config every other ticket reads. Prefer, among takeable tickets, the one that unblocks the most. No new worker starts after the cutoff; running ones finish. The six-ticket cap of `/ship-epic` does not apply: the morning review is one integration PR, not seventeen.

## Starting a worker

Spawn a background session per ticket from the ticket's own worktree:

```bash
claude --bg -n tz-<n> --model claude-opus-5-5 --effort xhigh --settings '{"disableAllHooks":true}' "<spawn prompt>"
```

If `claude` is not on the path, start a background subagent with worktree isolation on Opus instead, and give it the same prompt with the `/implement` steps written out, since a subagent cannot start a user-invoked skill.

The **spawn prompt** carries everything the worker cannot ask for later:

- `/mattpocock-skills:implement https://github.com/teszerrakt/tz-skills/issues/<n>` — build with `/tdd` at the seams, typecheck, run the suite, `/code-review`, commit
- its branch, cut from the current `afk/31`, and that its PR targets `afk/31`
- the repo's `CLAUDE.md` rules, above all: never hard-wrap markdown in a skill, a reference or an agent file
- **never ask**: on any question, take the recommended option and write it in the PR body under `## Decided unattended` as question, options, choice, and one line of why
- the files it owns, and the shared ones it imports rather than rewrites, when a sibling is running
- to open the PR as a draft, and stop

## Gating a finished ticket

When a worker's PR exists, gate it here, in this order. A gate that fails goes back to that worker's session as a message saying exactly what failed; two rounds per gate, then the ticket is **parked**.

1. `claude plugin validate --strict` on the PR's head (from #32 on).
2. The ticket's eval cases with `claude plugin eval` (from #32 on). Each case the ticket adds must fail on `afk/31` without the PR and pass with it.
3. `/tz-skills:spec-review` against the ticket — or the installed `/spec-review` until #32 lands. A `BLOCK` is a failed gate.
4. One adversarial reviewer subagent: the diff against `afk/31`, the ticket as its spec, findings in scope only. Verify each finding against the code yourself before sending it on.

Then number the PR body's unattended decisions into the run's `D<n>` sequence, write them to the record, rebase the branch on `afk/31`, and squash-merge it into `afk/31`. A decided ticket still merges: its dependents need it, and `afk/31` is itself unreviewed until morning. A rebase conflict goes to `/mattpocock-skills:resolving-merge-conflicts`, by intent.

A parked ticket parks everything it blocks. Record why and carry on with the rest.

## Cross-repo tickets

The plugin these tickets exercise is the one on `afk/31`: install it from a local marketplace pointing at the tz-skills `afk/31` checkout, never from `main`.

- **#44** — prove story mode against Klay's Storybook on this machine. The code lands in tz-skills; the shots go on the tz-skills PR.
- **#45** — in diurna, pick the smallest takeable `ready-for-agent` ticket and record the pick as a decision. Move diurna's delivery config to its committed home with review bot `none`, then `/tz-skills:ship` that ticket. It ends as a draft PR in diurna. Never merge.
- **#46** — in klay, pick the smallest takeable ticket on its Linear tracker and record the pick as a decision. Put Klay's config under the `.claude/` fallback, never committed. The deletion of Klay's own `ui-shots` skill and the traps moved into Klay's docs go in one draft PR. `/tz-skills:ship` the picked ticket to a draft PR with CodeRabbit as the review bot. Never merge, never mark ready: klaylab's team reviews in the morning, after the owner.
- **#49** — on this machine. Reproduce without sound: log each hook invocation to a file instead of letting it play. Its fix lands on `afk/31` like any tz-skills ticket.

Mutations to a staging backend from #45 or #46 are named in their PR bodies, with the ids created. Financial data is never deleted.

## Stop and abort

The user may type into this chat before the cutoff:

- **"stop"** — start nothing new; let running workers finish and be gated; then end the run.
- **"abort"** — stop every worker session, leave each open PR as a draft whose body says the run was aborted, then end the run.

## Ending the run

When no worker is running and none may start:

1. Open or update one PR from `afk/31` to `main` titled "Epic #31: overnight run", its body the record in short: the tickets merged, the `D<n>` decisions, the parked tickets and why, the cross-repo draft PRs in merge order, and the follow-ups. Leave it a draft.
2. Delete the wake-lock file.
3. Send one push notification: how many tickets merged, how many decisions await, and the artifact link.

## The morning

The user answers in this chat:

- **"D3: No"** — resume the session that made D3 with the other answer; it redoes the work on a new branch from `afk/31` and the fix merges as above.
- **"accept D1–D5"** — mark those decisions accepted in the record.
- When every decision is accepted, mark the `afk/31` PR ready. Merging it to `main` stays the user's.
