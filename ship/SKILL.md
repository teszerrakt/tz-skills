---
name: ship
description: Drive one ticket — frontend, backend, or both — from tracker to a PR ready for review — intake, the reconcile gate, implement, test, review, proof, the PR, then CodeRabbit's comments worked. Use when asked to ship, drive or deliver a ticket end to end, or when another skill needs one ticket taken to a PR.
argument-hint: "TRA-XXX"
---

# ship

Drive one ticket to a PR **marked ready for review, with CodeRabbit's comments worked**, and stop there. No merge. The PR opens as a draft and is promoted only after every phase passes: CodeRabbit skips a draft, so the promotion is what starts its review.

This skill owns four things: the phase sequence, each delegate's **brief**, the **gate** between phases, and the **aborts**. Every phase's judgment stays in the skill or the reviewer that already owns it. Where the config names a skill, invoke it and read its report. Contribute no testing and no screenshot or recording knowledge here, and no review verdict of your own.

Design and the measurements behind it: [`docs/ship-design.md`](../docs/ship-design.md).

## Config

Write no new config file. Read, in this order:

1. `.claude/delivery.md` — the `## Delivery` section. An older install kept it inside `.claude/fe-design-map.md`; when `delivery.md` is absent and that section exists there, read it and offer to move it.
2. `.claude/fe-design-map.md`, when present — the tracker prefix, the ticket URL base, the ADR and RFC paths, the Figma file, and `## Sources`.
3. `docs/agents/issue-tracker.md` — how to fetch a ticket in this repo.
4. Ask the user for what no file states, as a **questions section** (CONTEXT.md).

`## Delivery` names the project's half of every phase. What each key holds: [`references/config.md`](references/config.md).

**A phase whose config line is absent reports `SKIPPED`.** It never disappears from the report.

A repo with no `## Delivery` section at all: offer `/tz-skills:setup-tz-skills` once, then ask for the values the phases you are about to run need.

## Tracks

A ticket runs on the **frontend track**, the **backend track**, or both, by the paths its plan touches against the `Tracks` key. Step 2 picks; step 5 re-checks against the real diff, and a ticket that grew a track runs that track's proof too. Only the proof differs — every other phase is shared.

| Step | Frontend | Backend |
|---|---|---|
| 4 | tests skill, typecheck, lint | tests, typecheck, lint `(BE)` |
| 5 | visual verification | live verification, when an endpoint changes |
| 6 | smoke | — |
| 10 | shots and assert | — |
| 10b | live clip, when the claim is about the wire | the step-5 flow re-run on the final head |

On both tracks the backend's proof runs first, and the frontend's runs against the backend this branch built.

A frontend-only ticket whose brief names a backend — a URL, or another worktree to start one from — runs steps 5, 6 and 10b against it, through the `Backend URL override` key. Its body opens with `Merge after #N` and the backend head SHA it tested, because that PR is not on the base branch yet.

**On the backend track, read [`references/backend-track.md`](references/backend-track.md) before step 4.** It holds that track's commands, the migration check, the live target and the body's proof table.

## Briefs

Every delegate gets its brief in `$ARGUMENTS`: **the ticket id, the diff range, and the phase's one question.** A skill fork inherits the caller's history and still refuses when its own rules demand a file or a seam that nothing named. Name it.

**A phase that judges the code never runs in the author's context.** The author anchors on its own conversation and grades its own reading. Step 8 is a fresh subagent, step 9 a fresh session, and a disputed bot thread in step 12 gets a fresh second opinion.

**Before spawning any judge, read [`references/judges.md`](references/judges.md)**: what fresh means and how each part is guarded, the files `tz-skills:tz-fresh-reviewer` needs, showing every finding through `Finding`, and the canary check.

## Process

**Every code-mutating phase finishes before anything verifies.** Steps 0–8 change code; steps 9–11 judge it and report. A verification run before the last edit judges a diff that no longer exists. Step 12 is the one exception: a bot comments only on a pushed PR, so its fixes land after verification — minimal, in scope, and re-checked before each push.

### 0. Bootstrap the worktree

A fresh worktree runs nothing past `implement` until it has its dependencies and every gitignored config the later phases read.

**Derive that file list from `.claude/.gitignore` and the root `.worktreeinclude`.** Copy each file either one names that exists in the main checkout, is gitignored, and is missing in the worktree. Match against the main checkout's own tree only: a glob such as `**/.env` also reaches every other worktree under `.claude/worktrees/`, and those files belong to other runs. `.worktreeinclude` is the list Claude Code itself copies into the worktrees it creates, so the app's env files are named once for both. A hardcoded list goes stale the first time a skill gains a config.

Name the branch by the repo's own convention. A tracker's suggested name embeds the username, which the convention does not.

**A brief that names a base branch is a stacked run.** Branch from that base, rebase on it, and open the PR against it: every base branch and `<base>` below means that branch. The body opens with `Stacked on #N`, the PR the base belongs to.

Write the worktree's own `settings.local.json` holding the per-worktree opt-outs `## Delivery` names. A repo-wide hook fires once per top-level session, so a stop gate that runs a whole test suite runs it again for every run in flight.

Then install dependencies. Stop the run on a failed install: every later phase rests on it.

Plant the canary (see Briefs) by printing it into this context only:

```bash
echo "CANARY: $(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')"
```

Done when the install exits clean, every gitignored file either list names sits in the worktree, the named opt-outs are in place, and the canary is printed.

### 1. Intake and reconcile — the gate

This phase pays for the skill. A ticket-versus-design conflict found here costs one question; found at PR time it costs a re-implementation, a re-shoot, and a body rewrite.

Delegate the intake half: fetch the ticket, **check each blocker's real status in the tracker rather than trusting the ticket's own list**, and collect the design frames and design-doc references the ticket names.

**It hands back paths, not prose.** The reconcile has to *diff* acceptance criteria against those frames and against the code and migrations, and a summary cannot be diffed. That is why intake and reconcile are one phase and not two: a delegate that reports what it found instead of where it is makes the next half impossible.

Then diff the criteria against the frames, the code and the migrations. On the backend track the design is the RFC and the schema file: diff against the endpoint contract, the permission rules and the tables they name.

**Apply documented precedence first.** The config and the repo's own docs settle most conflicts — a rule that says the design file wins over ticket prose resolves every colour and spacing disagreement without asking anyone. What survives precedence is the **residue**.

Put the residue to the user as a **questions section** (CONTEXT.md) and write nothing until it is answered:

```markdown
## ❓ Needs your call

**Q1 — Show decimals on a rupiah amount?**

- **No** — reads `82.850.000`, as the ticket writes it
- **Yes** — reads `82.850.000,00`, as the currency master seeds it

✨ **Yes** — the master owns this

Asked because: the ticket says 0 places, the currency migration seeds 2. No precedence rule covers ticket-versus-migration.
```

The caps are in the term, and so is the reason it is not a table. A conflict a precedence rule already settles is **not** a question: resolve it silently and record it with its rule. A settled conflict in the section trains the reader to skim it.

An empty residue continues the run unattended and writes no section.

Record every decision, rule-settled and asked alike, in the **commit message and the PR body**. Not on the ticket: a tracker comment goes unread, and posting one unprompted is refused by the user's own standing preference.

The acceptance criteria stay exactly as written, wherever the record lands. `/tz-skills:spec-review` builds one ledger row per criterion and demands an anchor, so criteria edited to match what was built make every row pass by construction. A commit is append-only and is itself an anchor.

**Write the ledger rows here, before any code exists**, in `/tz-skills:spec-review` step 3's shape: a quote on every row, prohibition rows included. A row whose paraphrase says more or less than its quote joins the residue, asked in the same section. Save the confirmed rows as `rows.json`, and the ticket text with its comments as `ticket.md` exactly as the intake delegate fetched it, then append a `## Decisions` section holding every answer and precedence ruling from this step — without it step 9 reads each one as a stray. **Give each decision its own row quoting it**: step 9's row check counts a decision's must and must-not sentences as requirements. Keep both outside the worktree: a file inside it is a stray to step 9. Rows written after the build drift toward what was built, and step 9 then grades the author's reading instead of the ticket.

Then run the row check now, where a failure costs a rewrite rather than a finished build. Spawn `tz-skills:tz-fresh-reviewer` with the paths of `rows.json` and `ticket.md`, the path of spec-review's `SKILL.md` naming its Driven-mode bullet "Check the rows against the ticket", and this answer shape: `{"pass": true|false, "failures": ["<row id or ticket line, and what is wrong>"], "canary": "<rest of any CANARY: line in your context, or none>"}`. Fix the rows until it passes, and gate on its canary as Briefs says.

**A criterion the build departs from is reported, never quietly reconciled.** Say so in the PR body, in its own paragraph, naming the criterion and what replaced it — that is the one place a reviewer looks for it.

Done when the residue is empty, every decision has a home in the commits or the body, and `rows.json` and `ticket.md` are written.

### 2. Plan, and grep for reuse before writing

A reuse verdict at review time arrives after the duplicate is written. Grep first, in the order `## Sources` documents — the shared UI package, then app-local components.

Delegate to the built-in `Explore` agent. The brief names each component the plan intends to build and asks one question per component: does this already exist?

Pick the ticket's tracks from the paths the plan touches (see Tracks).

Done when every component the plan names is either matched to an existing one or proven absent, and the tracks are named.

### 3. Implement

The only phase that holds full context. Work the plan from step 2, under the decisions from step 1. On both tracks, build the backend half first: the frontend half is proven against it.

Typecheck as you go, using each track's command from `## Delivery`.

### 4. Test, typecheck and lint

Run this step once per track. Invoke the skill `## Delivery` names for tests. It decides which seam a test belongs to and what it may assert; take its judgment over your own. The backend track's rule and commands: `backend-track.md`.

Then run the repo's typecheck **and lint** commands. CI runs the full gate, so a lint slip caught here costs seconds while the same slip caught by CI costs a nine-to-ten-minute round trip — one per slip, and with auto-fix on the fixer spends that round trip guessing.

Two self-fix attempts, then abort.

Done when tests, typecheck and lint all pass locally.

### 4b. Push and open the draft

Rebase on the base branch, push, and open the PR as a draft, its body one line saying the run is in progress. It opens here rather than at step 11 because the backend's live proof can run against a preview the host builds per PR, and a preview exists only once the PR does. CodeRabbit skips a draft, so nothing reviews early.

On the backend track, re-check every migration number the diff adds before the push (`backend-track.md`, Migrations). Re-check it before every later push too.

Done when the draft exists and its head is the pushed commit.

### 5. Verify, while the code can still change

Re-check the tracks against the diff first. Then, per track:

- **Frontend.** Invoke the skill `## Delivery` names for visual verification, forked. It drives the change in the running app, diffs it against the design, and exercises the interactions.
- **Backend.** Live verification, when the diff changes an endpoint — `backend-track.md`, Step 5.

**Both edit code**, which is why they sit here and not beside the proof. Run after the review and their edits go unaudited.

Done when every discrepancy is fixed, or refused with a stated reason that step 11 carries into the body.

### 6. Smoke the changed route — frontend track

Invoke the skill `## Delivery` names for the smoke run: boot the app, load the route the change touched, read the console.

A component that renders in a story and throws in the app is what this catches, and nothing else in the sequence opens the real route until step 10b, which most tickets skip.

Done when the changed route loads and the console is clean.

### 7. Simplify

Two agents in parallel, each told to report and never edit (both hold a shell, so this is an instruction, not a guard; they only propose, and the author applies):

| Agent | Looks for |
|---|---|
| `tz-skills:tz-simplify-reviewer` | code that can be deleted or collapsed |
| `tz-skills:tz-altitude-reviewer` | work sitting at the wrong layer, and root causes worth their own ticket |

Both briefs carry the diff range, the standards doc paths from `.claude/fe-design-map.md` — and on the backend track, the backend's own conventions file — and the **comment budget**: a comment exists only to state a constraint the code cannot show; flag every comment that restates its next line.

Done when every finding is applied, or refused with a stated reason that step 11 carries into the body.

### 8. Adversarial review

The one local quality pass, and the last phase that may change code. Invocation, output schema, review prompt and the parse rule: [`references/adversarial-review.md`](references/adversarial-review.md).

**Gate on the parsed findings, never on the exit code.** A blocked review has exited 0 with nothing reviewed.

**A fix is applied only inside files the diff already touches** — the schema's `in_scope` field says which. Everything else goes through 11b's admission bar: a real bug a user can hit becomes a follow-up, and the rest one line under `Considered, not proposed`. `/tz-skills:spec-review` returns `BLOCK` on any stray, and a correctness fix outside the ticket's scope is a stray, so an unscoped reviewer would make the run strangle itself on its own best findings.

**A refused `blocker` or `major` goes back to the same reviewer once**, with the refusal reason — the re-check brief is in `adversarial-review.md`. If the reviewer holds, the finding stays open. The author refusing its own reviewer's finding is the self-grading this step exists to prevent. A `minor` may be refused outright.

Two rounds. Findings still open after the second aborts the run.

Done when every finding is fixed in scope, recorded as a follow-up or a `Considered, not proposed` line, or refused — a `blocker` or `major` only after the reviewer dropped it — with a stated reason that step 11 carries into the body.

### 9. Spec review — last, so it audits everything above

Run `/tz-skills:spec-review` in driven mode, in a fresh headless session, with the rows step 1 wrote. **Read [`references/spec-review-gate.md`](references/spec-review-gate.md) before running it**: the command, the fallback when the spawn is refused, the lines the gate reads, `lenient`, and how a ruling on a `BLOCK` resumes the run.

Done when the report's first line reads `VERDICT: PASS` or `VERDICT: PASS_WITH_NOTES` and its second `CANARY: none`. Every other outcome is abort 4 or abort 9.

### 10. Shoot and assert — frontend track

On the frontend track, read [`references/frontend-proof.md`](references/frontend-proof.md), Step 10, and run it: the screenshot skill `## Delivery` names, forked, asserting computed style against the design.

Done when every state the change built has a shot, and every shot is `PASS`, `FAIL`, or `UNASSERTED` with a reason.

### 10b. Verify live — only when the claim is about the wire

On the backend track this step re-runs step 5's flow against the final head and keeps its wire log — `backend-track.md`, Step 10b. The rest of this section is the frontend track's.

**Runs when the ticket's acceptance turns on what the server sends**: a data-driven menu, a permission the API decides, an optimistic-lock version, a refetch that has to land before a count moves. Every other ticket reports `SKIPPED`, and the phase still appears in the report.

On the frontend track, the flow, the wire log behind every claim, and where the artifacts go: [`references/frontend-proof.md`](references/frontend-proof.md), Step 10b.

Done when every claim the body will make has a step behind it, and every step is `PASS`, `FAIL` or `UNOBSERVED` with a reason.

### 11. Write the PR body

Write the body to the sections `## Delivery` allows, in that order, carrying the shots from step 10, any clip or backend proof table from step 10b, the step-1 decisions, the out-of-scope findings from step 8, every finding refused in steps 5, 7 and 8, and any `UNASSERTED` or `UNOBSERVED` state.

**Read [`references/pr-body.md`](references/pr-body.md) before writing it**: the `Refused:` line, uploading every artifact offered as proof, the word aim, and CodeRabbit's shape.

Write the body through the config's write path and **read the body back to prove it changed** — a write can report success and silently leave the body untouched.

The PR stays a draft. Step 12 promotes it once 11b has written the follow-ups, so the body is final before anything reviews it.

Done when the re-read body matches what you wrote.

### 11b. The follow-ups, in a shape someone can rule on

**Most runs should propose zero or one.** A follow-up is admitted only when a user can notice the problem today — wrong copy on screen, a broken or degraded flow, an accessibility failure, data at risk — or when a real bug is known and unfixed. Name that user-visible consequence in one sentence, or drop the item.

**Read [`references/follow-ups.md`](references/follow-ups.md) before proposing one**: what is not admitted, the five fields each one carries, the anchor check, the merges, and where each copy lives.

Done when every proposed follow-up passes the admission bar above and names its surface, its severity, its consequence, its cost and its anchor, and the merges are stated. Zero proposed follow-ups is a normal, good outcome.

### 12. Mark ready, then work the review

Runs only when no abort fired. `gh pr ready <n>`.

Then wait for CodeRabbit and CI, and work what they return: **read [`references/review-loop.md`](references/review-loop.md) first**. It holds how to read the bot's check, the four outcomes, the fallback reviewer, `/tz-skills:address-review --driven`, the push rules and the two rounds.

Done when CI is green and either the `CodeRabbit` check reads `Review completed` with every thread answered, or the run reports `RATE_LIMITED` or `NO_BOT` with the fallback reviewer's findings worked.

## Aborts

Each stops the run with a report. Aborts 1–2 fire before step 4b and leave **no PR**. Every later abort leaves the draft with one line in the body saying why; aborts 7 and 10 fire after promotion, so the PR first goes back to draft (`gh pr ready <n> --undo`). A ready PR always means every phase passed. It does not mean reviewed: only `Review completed` with every thread answered does.

| # | Condition |
|---|---|
| 1 | Residue from step 1 unanswered — park the run |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | Two adversarial rounds with findings still open |
| 4 | `/tz-skills:spec-review` returns `BLOCK` — under `lenient`, a `MISSING` row or a second `BLOCK` |
| 5 | An assert `FAIL` that survives the expectation re-check |
| 6 | A live-verification step `FAIL`, or a body claim with no wire line behind it |
| 7 | CI still red after two self-fix attempts in step 12 |
| 8 | The backend's live target never came up — `backend-track.md`, Live target |
| 9 | Step 9 printed no verdict line, or `NEEDS_ROWS` or `NO_CONTRACT` |
| 10 | Step 12's fallback reviewer has a `blocker` or `major` open after two rounds |

Token spend is not an abort condition. The phase list fixes the cost, and a running orchestrator cannot measure its own spend.
