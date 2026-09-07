# `/to-pr` — design

Status: built, unrun. Decided 2026-09-07 in a grilling session against the
evidence base in `/tmp/tra-470-handoff-implement-skill-design.md` (TRA-470, PR
klaylab/klay#711), which recorded the measured cost and rework of driving one
frontend ticket by hand.

## What it is

A **thin orchestrator**. `/to-pr TRA-470` drives a frontend ticket from tracker
to draft pull request. It owns four things and nothing else:

1. the phase sequence,
2. the brief handed to each delegate,
3. the gate conditions between phases,
4. the abort rules.

Every phase's judgment stays in the skill that already owns it. The orchestrator
contributes no reviewing, no testing, and no screenshot knowledge of its own.

The name is the stop rule: it ends at a **draft PR**, not at merge and not at
deploy.

## Non-goals

- **Backend tickets.** A ticket touching `backend/**` stops the run with a plain
  message. Every phase asset here is frontend-shaped, and the backend equivalents
  (Encore integration tests, `entity_id` scoping, `verify-backend`) are a
  different pipeline with zero measurements behind them. Revisit after the
  frontend path has run three tickets.
- **Merging, deploying, or marking a PR ready for review.**
- **Running the CodeRabbit loop.** `/address-review` owns that, and it is
  deliberately two-phase: it needs a human push between drafting fixes and
  posting replies. Chaining it inside `/to-pr` would break its own contract.
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
- Tests: `/fe-test`
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

| # | Phase | Owner | Blocks on |
| --- | --- | --- | --- |
| 0 | Bootstrap worktree | `/to-pr` | `npm ci` failure |
| 1 | Intake | subagent | — |
| 2 | Reconcile | `/to-pr` (main) | unresolved conflict — see below |
| 3 | Plan + reuse grep | `Explore` subagent | — |
| 4 | Implement | `/to-pr` (main) | — |
| 5 | Tests at the seam | config-named skill | — |
| 6 | Spec review | `/spec-review` | verdict `BLOCK` |
| 7 | Simplify | two agents, below | — |
| 8 | Shots + assert | config-named skill | assert `FAIL` |
| 9 | PR | `/to-pr` (main) | prose gate |

Quality review is deliberately absent from this list. CodeRabbit reviews every
PR for free, and `/address-review` works its comments. The one axis a bot cannot
cover is the spec axis, because CodeRabbit never sees the ticket — so
`/spec-review` is the only review that runs locally. This drops roughly 107k
tokens per ticket relative to running a local standards agent, and stops three
different reviewers rendering verdicts on the same diff.

### Phase 0 — bootstrap

A fresh worktree cannot run any phase past "implement". It needs `npm ci` plus
every gitignored config the later phases read.

**Derive the file list from `.claude/.gitignore`; never hardcode it.** Copy each
listed file that exists in the main checkout and is missing in the worktree. The
handoff document hardcoded three such files and had already missed a fourth
(`fe-design-map.md`, which `/spec-review` reads first) by the time it was
written.

Fail loudly on `npm ci` failure. Every later phase depends on it.

### Phase 2 — the reconcile gate

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

Record every gate decision as a **comment on the ticket**. Never edit the
acceptance criteria. `/spec-review` builds a ledger row per criterion and demands
an anchor; a skill that rewrites the criteria to match what it built makes every
row pass by construction and the review worthless. A comment is append-only and
is itself an anchorable artifact.

### Phase 3 — reuse moves to plan time

A reuse verdict at review time arrives after the duplicate is written. The
measured reuse agent spent ~99k tokens across 34 mostly-grep tool calls to say
so. Instead, grep before implementing, in the order `fe-design-map.md` already
documents under `## Sources`: the shared UI package first, then app-local
components. Use the built-in `Explore` agent; do not author one.

### Phase 7 — our own simplify

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

### Phase 8 — assertion, honestly

`/verify-frontend` is too expensive to run per ticket: it boots the dev server,
signs in through Auth0, drives puppeteer and pulls Figma screenshots, all in a
forked run. But the PR needs storybook shots anyway, and `ui-shot.mjs` already
holds a live browser on the component at `storyRenders: finished`. The numeric
assertion the handoff called worth institutionalising needs nothing more than
that page.

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
2. Typecheck or tests still failing after two self-fix attempts.
3. `/spec-review` returns `BLOCK` — a `MISSING` row, or an undefended stray.
   Opening a PR carrying a known `MISSING` row is the exact failure the reconcile
   gate exists to prevent, arriving one phase later.
4. An assert `FAIL` that survives an expectation re-check.

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

- Phase 8 is unproven end to end: `--assert` is verified against the TRA-470
  totals stories, but no `/to-pr` run has driven it.
- TRA-470's acceptance criteria still say "No semantic colour in the totals
  block", which the merged code contradicts. Editing the ticket is the user's
  call.
- Backend coverage, after three frontend runs.

## Built

- `to-pr/SKILL.md` — the orchestrator.
- `agents/tz-simplify-reviewer.md`, `agents/tz-altitude-reviewer.md` — read-only
  reviewers for phase 7.
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
