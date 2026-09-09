# `/ship` — design

Status: built, and run three times — TRA-422 (PR klaylab/klay#667), TRA-509
(#725) and TRA-423 (#724). Each carries a `verify/<ticket>-live-proof` branch,
so the live-verification phase ran too. Decided 2026-09-07 in a grilling session against the
evidence base in `/tmp/tra-470-handoff-implement-skill-design.md` (TRA-470, PR
klaylab/klay#711), which recorded the measured cost and rework of driving one
frontend ticket by hand.

## What it is

A **thin orchestrator**. `/ship TRA-470` drives a frontend ticket from tracker
to draft pull request. It owns four things and nothing else:

1. the phase sequence,
2. the brief handed to each delegate,
3. the gate conditions between phases,
4. the abort rules.

Every phase's judgment stays in the skill or the reviewer that already owns it.
The orchestrator contributes no testing and no screenshot or recording knowledge
of its own, and no review verdict: it passes a brief, then reads a report or a
schema-validated finding list.

It ends at a **draft PR**, not at merge and not at deploy.

**The stop rule is stated, not named.** This was `/to-pr`, where the name itself
carried the rule. `/ship` reads as merged-and-deployed, so the rule moved into
the skill's opening line and into the non-goals below. Growing the scope to
match the new name was the alternative and it contradicts a non-goal already
here: chaining `/address-review` breaks that skill's own two-phase contract.

## Non-goals

- **Backend tickets.** A ticket touching `backend/**` stops the run with a plain
  message. Every phase asset here is frontend-shaped, and the backend equivalents
  (Encore integration tests, `entity_id` scoping, `verify-backend`) are a
  different pipeline with zero measurements behind them. Revisit after the
  frontend path has run three tickets — met as of TRA-423, so this is open to
  take up rather than blocked.
- **Merging, deploying, or marking a PR ready for review.**
- **Running the CodeRabbit loop.** `/address-review` owns that, and it is
  deliberately two-phase: it needs a human push between drafting fixes and
  posting replies. Chaining it inside `/ship` would break its own contract.
- **A token budget.** The phase list fixes the cost; a mid-run budget cannot be
  enforced without the orchestrator polling its own spend.

## Portability

The skill ships from tz-skills and must carry no project specifics. Project
knowledge arrives two ways:

**Config.** Extend `.claude/fe-design-map.md` with a `## Delivery` section. Write
no new config file — `/spec-review` already establishes that rule, and
`setup-tz-skills` already scaffolds this file, so this is one edit to an existing
scaffolder rather than a new one. `.claude/live-verification.md` is left alone;
it belongs to the `verify-*` family, which is not part of tz-skills.

The section names **skills, not commands**, wherever a phase carries judgment:

```markdown
## Delivery

- Worktree root: `.claude/worktrees/`
- Typecheck: `npx turbo typecheck --filter=@klay/dashboard` (run from `frontend/`)
- Lint: `npx turbo lint --filter=@klay/dashboard` (run from `frontend/`)
- Tests: `/fe-test`
- Visual verification: `/verify-frontend`
- Smoke: `/run`
- Adversarial review: `codex exec` — see `ship/references/adversarial-review.md`
- Screenshots: `/ui-shots`
- Design assertion: `/ui-shots` (assert mode)
- PR prose gate: `scripts/check-prose.py --surface pr <file>`
- PR body sections: Summary, Test plan, Out of scope, Follow-ups — that order,
  max 4 sections, max 1 table, no `###`, no nested list, under 1000 words
- PR body write path: `gh api -X PATCH repos/<slug>/pulls/<n> --input payload.json`,
  then re-read the body to confirm it changed
```

Naming a skill rather than a command is what keeps the orchestrator portable: it
knows only "this phase is owned by that skill", passes a brief, and reads a
report. It also sidesteps model selection, because `ui-shots` and `fe-test`
already pin `model: sonnet` in their own frontmatter.

**A phase whose config line is absent is reported `SKIPPED`.** It is never
silently dropped.

## Phases

**Reordered 2026-09-09**, in the `/ship-epic` grilling session. Every
code-mutating phase now finishes before anything verifies, and the intake and
reconcile halves merged. The reasoning is in
[`ship-epic-design.md`](./ship-epic-design.md) under *The reordered flow*; the
table below is the order that shipped.

| # | Phase | Owner | Blocks on |
| --- | --- | --- | --- |
| 0 | Bootstrap worktree | `/ship` | install failure |
| 1 | Intake + reconcile — the gate | subagent, then `/ship` (main) | unresolved residue |
| 2 | Plan + reuse grep | `Explore` subagent | — |
| 3 | Implement | `/ship` (main) | — |
| 4 | Tests, typecheck + lint | config-named skill, plus two commands | two self-fix attempts |
| 5 | Visual verification | config-named skill | — |
| 6 | Smoke the changed route | config-named skill | a dirty console |
| 7 | Simplify | two agents, below | — |
| 8 | Adversarial review | `codex exec` | two rounds with findings open |
| 9 | Spec review | `/spec-review` | verdict `BLOCK` |
| 10 | Shots + assert | config-named skill | assert `FAIL` |
| 10b | Verify live | config-named skill | step `FAIL`, or a claim with no wire line |
| 11 | PR | `/ship` (main) | prose gate |

Steps 0–8 change code and 9–11 judge it. That split is the point of the order:
`/spec-review` ran at 6 and computed its verdict against a diff simplify then
edited, so its anchors could be deleted by the time the PR opened and simplify's
own edits were audited by nothing.

Step 10b is conditional: it runs when a ticket's acceptance turns on what the
server sends and reports `SKIPPED` otherwise. It is a separate phase rather than
a mode of 10 because its abort differs — 10 fails on a computed value that does
not match a token, 10b on a claim the wire log does not support.

Steps 5 and 6 are new, and both run the real app. Step 5 edits code, which is
why it sits among the mutating phases rather than beside the shots.

Quality review was deliberately absent from this list, on the grounds that
CodeRabbit reviews every PR for free and `/address-review` works its comments.
That dropped roughly 107k tokens per ticket against a local standards agent and
stopped three reviewers rendering verdicts on one diff, and the spec axis stayed
local because CodeRabbit never sees the ticket.

The reorder adds one back, at step 8, for a reason the original argument missed:
the free CodeRabbit seat allows three CLI reviews an hour, and the muzzle
`.coderabbit.yaml` puts on its knowledge base is deliberate (ADR-030 decision
10), so the PR-time net is thin by design. Two local reviews now run — the spec
axis, and one adversarial pass whose findings are schema-validated so the run
can branch on severity and scope. Everything else still waits for the push.

### Step 0 — bootstrap

A fresh worktree cannot run any phase past "implement". It needs `npm ci` plus
every gitignored config the later phases read.

**Derive the file list from `.claude/.gitignore`; never hardcode it.** Copy each
listed file that exists in the main checkout and is missing in the worktree. The
handoff document hardcoded three such files and had already missed a fourth
(`fe-design-map.md`, which `/spec-review` reads first) by the time it was
written.

Fail loudly on `npm ci` failure. Every later phase depends on it.

### Step 1 — the reconcile gate

This is the phase that pays for the skill. In the measured session, a
ticket-versus-design conflict surfaced at PR time and cost a re-implementation,
six re-shot images, and a PR-body rewrite.

Diff the ticket's acceptance criteria against the Figma frame and against the
code and migrations. Then **apply documented precedence first**, and only ask
about the residue:

- `.claude/live-verification.md` already states that Figma wins over ticket prose.
  A "ticket says no semantic colour, Figma paints it" conflict is therefore
  auto-resolved, not a question. Applying this one rule would have prevented the
  measured rework outright.
- A conflict with no precedence rule is a real question. "Ticket says IDR
  `decimal_places = 0`, `gl/migrations/58_create_currencies.up.sql` seeds 2" has
  no rule and must be asked.

Write nothing until the residue is answered. If the residue is empty, continue
unattended.

**The residue is asked as a questions section**, defined in `CONTEXT.md`. The
earlier design printed it as a JSONC block keyed by field name — the wrong
artefact for the one step here that stops and waits for a person. A reader who
must decode `{"field": "IDR decimal_places", "rule": null}` to learn they are
being asked something usually does not learn it.

Two failures were measured on one run, not one. Questions placed after a long
report were scrolled past twice. Then the same questions, rewritten in plain
words, were **still** too long to answer at a glance and had to be asked again.
So the term caps length as well as vocabulary: under 15 words a cell, at most
four rows, evidence underneath. Plain and short are one requirement, and fixing
only the first buys nothing.

A third failure killed the table outright: a terminal renders `<br>` literally,
so a cell cannot put one option on each line, and options crammed onto one line
were unreadable in exactly the way the format was meant to fix. Hence a section
with one bullet per option.

It borrows `/grilling`'s labels rather than inventing any — `Q1`, `Q2`, so a
question reads the same wherever it appears — and carries a `✨` recommendation
per question. The recommendation is the part doing real work: it converts the
reader's job from weighing options they have not seen into a yes or a
correction. A skill that asks without recommending has offloaded its own
judgment.

Record every gate decision in the **commit message and the PR body**. Never edit
the acceptance criteria. `/spec-review` builds a ledger row per criterion and
demands an anchor; a skill that rewrites the criteria to match what it built
makes every row pass by construction and the review worthless. A commit is
append-only and is itself an anchorable artifact.

**Not a comment on the ticket, which was the original design and was wrong on
two counts.** The first is empirical: the author of these skills does not read
ticket comments, so a decision recorded there is recorded nowhere a human will
see it. The second is that it put the routing in the skill's hands. A decision
that needs a person needs *that person* to choose where it goes — answered in
conversation and fixed in the branch, or raised as an open question on a **new**
ticket, since the current one is about to close. A skill cannot make that call,
so it must not pre-empt it by posting.

The anchor argument survives intact: a commit message is as append-only as a
comment and sits closer to the diff a reviewer is reading.

**A criterion the build departs from is reported, never quietly reconciled.** It
gets its own paragraph in the PR body, naming the criterion and what replaced
it. This is the case the gate exists to surface, and burying it in prose about
what was built is how it goes unnoticed.

### Step 2 — reuse moves to plan time

A reuse verdict at review time arrives after the duplicate is written. The
measured reuse agent spent ~99k tokens across 34 mostly-grep tool calls to say
so. Instead, grep before implementing, in the order `fe-design-map.md` already
documents under `## Sources`: the shared UI package first, then app-local
components. Use the built-in `Explore` agent; do not author one.

### Step 7 — our own simplify

The built-in `/simplify` is not used. It runs four agents (~365k measured) and
cannot be tuned, and its agents did not install here.

Two agents replace it, roughly 168k:

- **simplify** — deletable and collapsible code. Highest-value axis measured: 10
  findings, most applied.
- **altitude** — is this at the right layer, and what is the root cause. Named
  three fixes worth their own tickets.

The dropped efficiency axis earned its keep once, by *disproving* the
orchestrator's premise. That role survives as a line in the altitude brief:
*state where the orchestrator's premise is wrong; agreeing with it is not a
finding.*

The comment budget is stated to both agents as a hard rule rather than left to
imitation of surrounding code: a comment exists only to state a constraint the
code cannot show. Flag every comment that restates its next line.

Run this **before** opening the PR. Running it after CodeRabbit means CodeRabbit
comments on verbose code that simplify then deletes, and `/address-review`
does work on lines that no longer exist.

### Step 10 — assertion, honestly

`/verify-frontend` is too expensive to run *for the assertion*: it boots the dev
server, signs in through Auth0, drives puppeteer and pulls Figma screenshots, all
in a forked run. But the PR needs storybook shots anyway, and `ui-shot.mjs`
already holds a live browser on the component at `storyRenders: finished`. The
numeric assertion the handoff called worth institutionalising needs nothing more
than that page.

The reorder does give `/verify-frontend` its own phase at step 5, and the two do
not collide: step 5 diffs the running app against the design and drives its
interactions, while step 10 asserts token identity on a story. Step 5 also edits
code, so it must precede every review — which is the whole reason it could not
simply be folded into step 10.

So the assertion **rides the boot the shots already pay for**. This requires an
`--assert` flag added to `ui-shot.mjs` — a real cost, stated rather than hidden.
The alternative considered and rejected was keeping `/verify-frontend` behind a
condition, which pays for the expensive machinery *and* adds a branch deciding
when to pay.

Three rules make it honest:

- **The output names its own coverage.** "Asserted vs tokens: 2 elements ×
  {color, font-size, line-height} — 6/6 pass. Not checked: spacing, borders,
  radius, hover." Never "verified against Figma".
- **A story with no assert spec reports `UNASSERTED`, never `PASS`.**
- **Compare token identity, not colour values.** Chrome returns
  `oklch(0.63 0.24 29.2)`, never `#D92D20`; resolve against the token file
  (`frontend/packages/tailwind-config/index.css` in KLAY) so the assertion proves
  the right token was used.

And the hard-won rule: **on a FAIL, check the expectation before believing the
defect.** In the measured session the assertion's reference frame was wrong twice
while the code was right.

## Agents

Two agents ship from tz-skills, `tz-`-prefixed so an install never clobbers a
user's own agent:

```yaml
# tz-skills/agents/tz-simplify-reviewer.md
---
name: tz-simplify-reviewer
description: Find deletable and collapsible code in a diff. Reports findings; never edits.
model: opus
tools: Read, Grep, Glob, Bash
---
```

The justification is **tool restriction, not model choice.** The `Agent` tool
already accepts a per-call `model` that overrides an agent file's frontmatter,
so models need no files. It accepts no per-call `tools`. A reviewer holding
`Edit` will fix, mid-review, code that the simplify phase is about to delete
differently — and in the measured session these agents ran while the diff was
live.

This needs `bin/install.ts` to gain an `agents/` pass, symlinking each `*.md`
into `~/.claude/agents/`. That is a new install surface in tz-skills, and it is
the only way to express the one capability the `Agent` tool cannot express per
call.

## Aborts

These stop the run with **no PR opened**, and a report:

1. Reconcile-gate residue unanswered — park, never guess.
2. Typecheck, lint or tests still failing after two self-fix attempts.
3. Two adversarial rounds with findings still open.
4. `/spec-review` returns `BLOCK` — a `MISSING` row, or an undefended stray.
   Opening a PR carrying a known `MISSING` row is the exact failure the reconcile
   gate exists to prevent, arriving eight phases later.
5. An assert `FAIL` that survives an expectation re-check.
6. A live-verification step `FAIL`, or a body claim with no wire line.

## Environment constraints

These live in the project's `## Delivery` config under `Environment traps`, not
in the skill — the skill ships from tz-skills and carries no machine specifics.
Measured on the KLAY box, each cost real time:

- **chrome-devtools MCP fails on WSL** ("Protocol error … Target closed").
  Puppeteer works with `--no-sandbox --disable-setuid-sandbox`, and driver
  scripts must live inside `frontend/` or node cannot resolve `puppeteer`.
- **Bash is worktree-guarded**: compound commands containing `git`, and
  `cd frontend && …`, are refused. Use plain commands with absolute paths.
- **`gh pr edit --body-file` silently aborts** on a Projects-classic GraphQL
  error. Use `gh api -X PATCH` and verify the body changed.
- **`networkidle0` never settles** on this app — use `domcontentloaded` plus a
  selector wait. Date fields need the calendar; typing does not stick.
- **Coda MCP is not a dependency.** It returned unusable handles during the
  measured session; the ticket plus Figma were enough.
- Credentials live in gitignored `.env` files and **never** appear in a document,
  a PR body, or a report.

The one rule general enough to live in the skill is its consequence: after
writing a PR body, read it back and prove it changed.

## Delegate briefs

Every delegate gets an explicit brief. Skill forks do inherit the caller's
conversation history, contrary to the handoff's fact #1 — but a fork still
refuses when the skill's own instructions demand a named file or seam that
nothing in `$ARGUMENTS` supplied. That was the real failure in the measured
session. Pass the ticket id, the diff range, and the phase's specific question
in `$ARGUMENTS`; never rely on inheritance.

## Open items

- TRA-470's acceptance criteria still say "No semantic colour in the totals
  block", which the merged code contradicts. Editing the ticket is the user's
  call.
- Backend coverage. The three-run gate is met; nothing is built.

## Built

- `ship/SKILL.md` — the orchestrator, on the reordered phase list above.
- `ship/references/adversarial-review.md` + `adversarial-findings.schema.json` —
  step 8's invocation, findings schema, review prompt and quota-only fallback.
- `agents/tz-simplify-reviewer.md`, `agents/tz-altitude-reviewer.md` — read-only
  reviewers for step 7.
- `bin/link.ts` — the symlinking both entry points share, now covering
  `agents/*.md` into `~/.claude/agents/`. `bin/install.ts` and `setup.ts` were
  duplicating this logic; adding the agents pass twice is what forced the
  extraction.
- `setup-tz-skills` Section F + `references/config-delivery.md` — scaffolds the
  `## Delivery` section into a repo's `.claude/fe-design-map.md`.
- KLAY's own `## Delivery` section, written into its (gitignored)
  `.claude/fe-design-map.md`.
- `ui-shot.mjs --assert` in klaylab/klay, branch `chore/ui-shot-assert`: story
  ids to selectors to computed properties, tokens resolved through a hidden
  probe inside the matched element, `UNASSERTED` as a third outcome, exit 1 on
  any failure.
