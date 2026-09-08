---
name: to-pr
description: Drive one frontend ticket from tracker to draft PR.
argument-hint: "TRA-XXX"
disable-model-invocation: true
---

# to-pr

Drive one frontend ticket to a **draft PR**. The name is the stop rule: no merge,
no ready-for-review, no CodeRabbit loop. `/address-review` owns that loop and
needs a human push mid-flight.

This skill owns four things: the phase sequence, each delegate's **brief**, the
**gate** between phases, and the **aborts**. Every phase's judgment stays in the
skill that already owns it. Where the config names a skill, invoke it and read
its report. Contribute no reviewing, no testing, and no screenshot knowledge here.

Design and the measurements behind it: [`docs/to-pr-design.md`](../docs/to-pr-design.md).

## Config

Write no new config file. Read, in this order:

1. `.claude/fe-design-map.md` — the tracker prefix, the ticket URL base, the ADR
   and RFC paths, the Figma file, `## Sources`, and the `## Delivery` section.
2. `docs/agents/issue-tracker.md` — how to fetch a ticket in this repo.
3. Ask the user for what neither file states, as a **questions section** (CONTEXT.md).

`## Delivery` names the project's half of every phase:

| Key | Holds |
|---|---|
| Worktree root | where phase 0 puts the tree |
| Typecheck / Tests | the command, and the skill that decides what a test may assert |
| Screenshots | the skill that owns shot selection |
| Design assertion | the skill and flag that assert computed style against tokens |
| Token file | where a colour token resolves to its name |
| PR prose gate | the command that validates the PR body |
| PR body sections | the allowed headings, in order, and the caps |
| PR body write path | how to write a body, and how to prove it landed |
| Environment traps | the machine-specific gotchas a delegate must be told |

**A phase whose config line is absent reports `SKIPPED`.** It never disappears
from the report.

A repo with no `## Delivery` section at all: offer `/setup-tz-skills` once, then
ask for the values the phases you are about to run need.

## Scope

Frontend tickets. When the ticket's files land under a backend path, say so and
stop before phase 0 — the proof this skill sequences (stories, computed style,
Figma tokens) is not the proof a backend change needs.

## Briefs

Every delegate gets its brief in `$ARGUMENTS`: **the ticket id, the diff range,
and the phase's one question.** A skill fork inherits the caller's history and
still refuses when its own rules demand a file or a seam that nothing named.
Name it.

## Process

### 0. Bootstrap the worktree

A fresh worktree runs nothing past `implement` until it has its dependencies and
every gitignored config the later phases read.

**Derive that file list from `.claude/.gitignore`.** Copy each listed file that
exists in the main checkout and is missing in the worktree. A hardcoded list goes
stale the first time a skill gains a config.

Then install dependencies. Stop the run on a failed install: every later phase
rests on it.

Done when the install exits clean and every gitignored config named by
`.gitignore` sits in the worktree.

### 1. Intake

Delegate. The brief: fetch the ticket, **check each blocker's real status in the
tracker rather than trusting the ticket's own list**, and collect the Figma node
ids and design-doc references the ticket names.

It returns a brief, not file dumps.

Done when the ticket text, each blocker's live status, and every design
reference resolve to something you can open.

### 2. Reconcile — the gate

This phase pays for the skill. A ticket-versus-design conflict found here costs
one question; found at PR time it costs a re-implementation, a re-shoot, and a
body rewrite.

Diff the ticket's acceptance criteria against the design frames and against the
code and migrations the ticket touches.

**Apply documented precedence first.** The config and the repo's own docs settle
most conflicts — a rule that says the design file wins over ticket prose resolves
every colour and spacing disagreement without asking anyone. What survives
precedence is the **residue**.

Put the residue to the user as a **questions section** (CONTEXT.md) and write
nothing until it is answered:

```markdown
## ❓ Needs your call

**Q1 — Show decimals on a rupiah amount?**

- **No** — reads `82.850.000`, as the ticket writes it
- **Yes** — reads `82.850.000,00`, as the currency master seeds it

✨ **Yes** — the master owns this

Asked because: the ticket says 0 places, the currency migration seeds 2. No precedence rule covers ticket-versus-migration.
```

The caps are in the term, and so is the reason it is not a table. A conflict a
precedence rule already settles is **not** a question: resolve it silently and
record it with its rule. A settled conflict in the section trains the reader to
skim it.

An empty residue continues the run unattended and writes no section.

Record every decision, rule-settled and asked alike, in the **commit message and
the PR body**. Not on the ticket: a tracker comment goes unread, and posting one
unprompted is refused by the user's own standing preference.

The acceptance criteria stay exactly as written, wherever the record lands.
`/spec-review` builds one ledger row per criterion and demands an anchor, so
criteria edited to match what was built make every row pass by construction. A
commit is append-only and is itself an anchor.

**A criterion the build departs from is reported, never quietly reconciled.**
Say so in the PR body, in its own paragraph, naming the criterion and what
replaced it — that is the one place a reviewer looks for it.

Done when the residue is empty and every decision has a home in the commits or
the body.

### 3. Plan, and grep for reuse before writing

A reuse verdict at review time arrives after the duplicate is written. Grep
first, in the order `## Sources` documents — the shared UI package, then
app-local components.

Delegate to the built-in `Explore` agent. The brief names each component the plan
intends to build and asks one question per component: does this already exist?

Done when every component the plan names is either matched to an existing one or
proven absent.

### 4. Implement

The only phase that holds full context. Work the plan from step 3, under the
decisions from step 2.

Typecheck as you go, using the command from `## Delivery`.

### 5. Test at the seam

Invoke the skill `## Delivery` names for tests. It decides which seam a test
belongs to and what it may assert; take its judgment over your own.

### 6. Spec review

Run `/spec-review` against the diff.

Quality review is deliberately absent from this sequence. CodeRabbit reviews the
PR for free and `/address-review` works its comments. The spec axis is the one a
bot cannot cover, because it never sees the ticket.

A `BLOCK` verdict aborts the run. Opening a PR that carries a known `MISSING` row
is the failure the gate in step 2 exists to prevent, arriving one phase later.

### 7. Simplify

Two agents in parallel, each restricted to reading:

| Agent | Looks for |
|---|---|
| `tz-simplify-reviewer` | code that can be deleted or collapsed |
| `tz-altitude-reviewer` | work sitting at the wrong layer, and root causes worth their own ticket |

Both briefs carry the diff range, the standards doc paths from
`.claude/fe-design-map.md`, and the **comment budget**: a comment exists only to
state a constraint the code cannot show; flag every comment that restates its
next line.

Run this **before** the PR opens. After CodeRabbit, its comments land on verbose
code that simplify then deletes, and `/address-review` works lines that no longer
exist.

Done when every finding is applied or refused with a stated reason.

### 8. Shoot and assert

Invoke the skill `## Delivery` names for screenshots, forked, so the images stay
out of this context. The same run asserts computed geometry and style against the
design's own numbers.

Three rules keep the assertion honest:

- **The report names its own coverage.** "Asserted vs tokens: 2 elements ×
  {color, font-size, line-height} — 6/6 pass. Not checked: spacing, borders,
  radius, hover." That sentence, not "verified against the design".
- **A story with no assert spec reports `UNASSERTED`.** It is a third state
  beside pass and fail.
- **Assert token identity.** A browser reports a colour as `oklch(…)`, never as
  the hex the design names, so resolve against the token file from `## Delivery`.
  That proves the right token was used, which is the stronger claim anyway.

**On a `FAIL`, re-check the expectation before believing the defect.** An
assertion measured against a padded cell or a bordered harness fails while the
code is right.

Re-shoot whenever the code changes after this phase. A stale image misrepresents
the diff as confidently as a fresh one.

Done when every state the change built has a shot, and every shot is `PASS`,
`FAIL`, or `UNASSERTED` with a reason.

### 9. Open the draft PR

Write the body to the sections `## Delivery` allows, in that order, carrying the
shot table from step 8, the step-2 decisions, and any `UNASSERTED` state.

Run the prose gate. Then write the body through the config's write path and
**read the body back to prove it changed** — a write can report success and
silently leave the body untouched.

Draft, not ready-for-review: the gate decisions and the `UNASSERTED` states are
yours to read before a human reviewer is pinged.

Done when the prose gate passes and the re-read body matches what you wrote.

## Aborts

Each stops the run with a report and **no PR**:

| # | Condition |
|---|---|
| 1 | Residue from step 2 unanswered — park the run |
| 2 | Typecheck or tests still failing after two self-fix attempts |
| 3 | `/spec-review` returns `BLOCK` |
| 4 | An assert `FAIL` that survives the expectation re-check |

Token spend is not an abort condition. The phase list fixes the cost, and a
running orchestrator cannot measure its own spend.
