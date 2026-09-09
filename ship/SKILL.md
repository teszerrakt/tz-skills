---
name: ship
description: Drive one frontend ticket from tracker to draft PR — intake, the reconcile gate, implement, test, review, shots, then the PR. Use when asked to ship, drive or deliver a ticket end to end, or when another skill needs one ticket taken to a PR.
argument-hint: "TRA-XXX"
---

# ship

Drive one frontend ticket to a **draft PR** and stop there. The name does not
say so — this line does: no merge, no ready-for-review, no CodeRabbit loop.
`/address-review` owns that loop and needs a human push mid-flight.

This skill owns four things: the phase sequence, each delegate's **brief**, the
**gate** between phases, and the **aborts**. Every phase's judgment stays in the
skill or the reviewer that already owns it. Where the config names a skill,
invoke it and read its report. Contribute no testing and no screenshot or
recording knowledge here, and no review verdict of your own.

Design and the measurements behind it: [`docs/ship-design.md`](../docs/ship-design.md).

## Config

Write no new config file. Read, in this order:

1. `.claude/fe-design-map.md` — the tracker prefix, the ticket URL base, the ADR
   and RFC paths, the Figma file, `## Sources`, and the `## Delivery` section.
2. `docs/agents/issue-tracker.md` — how to fetch a ticket in this repo.
3. Ask the user for what neither file states, as a **questions section** (CONTEXT.md).

`## Delivery` names the project's half of every phase:

| Key | Holds |
|---|---|
| Worktree root | where step 0 puts the tree |
| Per-worktree opt-outs | the hooks or plugins step 0 disables in the worktree |
| Typecheck / Lint / Tests | the two commands, and the skill that decides what a test may assert |
| Visual verification | the skill that diffs the running app against the design, and edits code |
| Smoke | the skill that boots the app and reads the console on the changed route |
| Adversarial review | the reviewer step 8 drives |
| Screenshots | the skill that owns shot selection |
| Design assertion | the skill and flag that assert computed style against tokens |
| Live verification | the skill and flag that record a flow against the real API |
| Verification bundle | the branch and directory a recording's artifacts are committed to |
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
stop before step 0 — the proof this skill sequences (stories, computed style,
Figma tokens) is not the proof a backend change needs.

## Briefs

Every delegate gets its brief in `$ARGUMENTS`: **the ticket id, the diff range,
and the phase's one question.** A skill fork inherits the caller's history and
still refuses when its own rules demand a file or a seam that nothing named.
Name it.

## Process

**Every code-mutating phase finishes before anything verifies.** Steps 0–8
change code; steps 9–11 judge it and report. A verification run before the last
edit judges a diff that no longer exists.

### 0. Bootstrap the worktree

A fresh worktree runs nothing past `implement` until it has its dependencies and
every gitignored config the later phases read.

**Derive that file list from `.claude/.gitignore`.** Copy each listed file that
exists in the main checkout and is missing in the worktree. A hardcoded list goes
stale the first time a skill gains a config.

Name the branch by the repo's own convention. A tracker's suggested name embeds
the username, which the convention does not.

Write the worktree's own `settings.local.json` holding the per-worktree opt-outs
`## Delivery` names. A repo-wide hook fires once per top-level session, so a stop
gate that runs a whole test suite runs it again for every run in flight.

Then install dependencies. Stop the run on a failed install: every later phase
rests on it.

Done when the install exits clean, every gitignored config named by `.gitignore`
sits in the worktree, and the named opt-outs are in place.

### 1. Intake and reconcile — the gate

This phase pays for the skill. A ticket-versus-design conflict found here costs
one question; found at PR time it costs a re-implementation, a re-shoot, and a
body rewrite.

Delegate the intake half: fetch the ticket, **check each blocker's real status in
the tracker rather than trusting the ticket's own list**, and collect the design
frames and design-doc references the ticket names.

**It hands back paths, not prose.** The reconcile has to *diff* acceptance
criteria against those frames and against the code and migrations, and a summary
cannot be diffed. That is why intake and reconcile are one phase and not two: a
delegate that reports what it found instead of where it is makes the next half
impossible.

Then diff the criteria against the frames, the code and the migrations.

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

### 2. Plan, and grep for reuse before writing

A reuse verdict at review time arrives after the duplicate is written. Grep
first, in the order `## Sources` documents — the shared UI package, then
app-local components.

Delegate to the built-in `Explore` agent. The brief names each component the plan
intends to build and asks one question per component: does this already exist?

Done when every component the plan names is either matched to an existing one or
proven absent.

### 3. Implement

The only phase that holds full context. Work the plan from step 2, under the
decisions from step 1.

Typecheck as you go, using the command from `## Delivery`.

### 4. Test, typecheck and lint

Invoke the skill `## Delivery` names for tests. It decides which seam a test
belongs to and what it may assert; take its judgment over your own.

Then run the repo's typecheck **and lint** commands. CI runs the full gate, so a
lint slip caught here costs seconds while the same slip caught by CI costs a
nine-to-ten-minute round trip — one per slip, and with auto-fix on the fixer
spends that round trip guessing.

Two self-fix attempts, then abort.

Done when tests, typecheck and lint all pass locally.

### 5. Verify the visuals, while the code can still change

Invoke the skill `## Delivery` names for visual verification, forked. It drives
the change in the running app, diffs it against the design, and exercises the
interactions.

**It edits code**, which is why it sits here and not beside the shots. Run after
the review and its edits go unaudited.

Done when every discrepancy is fixed, or refused with a stated reason.

### 6. Smoke the changed route

Invoke the skill `## Delivery` names for the smoke run: boot the app, load the
route the change touched, read the console.

A component that renders in a story and throws in the app is what this catches,
and nothing else in the sequence opens the real route until step 10b, which most
tickets skip.

Done when the changed route loads and the console is clean.

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

Done when every finding is applied or refused with a stated reason.

### 8. Adversarial review

The one local quality pass, and the last phase that may change code. Invocation,
output schema, review prompt and the fallback rule:
[`references/adversarial-review.md`](references/adversarial-review.md).

**Gate on the parsed findings, never on the exit code.** A blocked review has
exited 0 with nothing reviewed.

**A fix is applied only inside files the diff already touches** — the schema's
`in_scope` field says which. Everything else becomes a line in the PR body's
`Follow-ups`. `/spec-review` returns `BLOCK` on any stray, and a correctness fix
outside the ticket's scope is a stray, so an unscoped reviewer would make the run
strangle itself on its own best findings.

Two rounds. Findings still open after the second aborts the run.

Done when every finding is fixed in scope, recorded as a follow-up, or refused
with a stated reason.

### 9. Spec review — last, so it audits everything above

Run `/spec-review` against the diff.

It runs **after** every code-mutating phase. Run before simplify, it computed its
verdict against a diff that no longer existed: the anchors it cited could be
deleted by the time the PR opened, and simplify's own edits were never audited by
anything.

The two local reviews are the two a bot cannot do. The spec axis, because
CodeRabbit never sees the ticket; and step 8, because the CodeRabbit seat that
reviews the PR for free allows three CLI reviews an hour. Everything else waits
for the push, where `/address-review` works its comments.

A `BLOCK` verdict aborts the run. Opening a PR that carries a known `MISSING` row
is the failure the gate in step 1 exists to prevent, arriving eight phases later.

### 10. Shoot and assert

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

Nothing after this step changes code, so these shots stand. Re-shoot if an
earlier step is revisited: a stale image misrepresents the diff as confidently as
a fresh one.

Done when every state the change built has a shot, and every shot is `PASS`,
`FAIL`, or `UNASSERTED` with a reason.

### 10b. Verify live — only when the claim is about the wire

**Runs when the ticket's acceptance turns on what the server sends**: a
data-driven menu, a permission the API decides, an optimistic-lock version, a
refetch that has to land before a count moves. Every other ticket reports
`SKIPPED`, and the phase still appears in the report.

Invoke the skill `## Delivery` names for live verification, forked. It drives a
flow through the running app against the real API and answers with a recording,
a wire log, and a verdict per step. A clip proves the flow works end to end, so
take as many as the flow needs — one recording carrying three unrelated claims
is worse than three recordings.

**A claim in the body needs a line in the wire log.** That is what separates
this from a demo: a reviewer checks "the app runs no capability check of its
own" against a log showing the reasons came off the wire, not against footage
they are asked to trust.

Two rules the report lives by:

- **A step with no expectation reports `UNOBSERVED`** — a third state beside
  pass and fail, for the same reason an unasserted story is.
- **The clip owns its path.** A state the recording walks through earns no
  separate still from step 10; a state the flow never reaches still earns one,
  and computed style stays step 10's job because no recording can prove it.

The artifacts go to the branch and directory `## Delivery` names, never to the
PR branch: `/spec-review` greps the diff for an anchor per criterion, and binary
evidence is noise to that pass. **A run that mutated anything says so** — the
ids it created, and what was not done to them. Financial data is never deleted,
only reversed, so every row a recording creates is permanent.

Done when every claim the body will make has a step behind it, and every step is
`PASS`, `FAIL` or `UNOBSERVED` with a reason.

### 11. Open the draft PR

Write the body to the sections `## Delivery` allows, in that order, carrying the
shots from step 10, any clip from step 10b, the step-1 decisions, the
out-of-scope findings from step 8, and any `UNASSERTED` or `UNOBSERVED` state.
The markdown for a shot and for a clip is printed by the skill that produced it;
paste what it gives you.

**Aim for 300 words, or 550 with a live-verification section. The prose gate's
cap is not the budget.** That number is the p98 of the surface — a backstop for
outliers, which the gate's own source says. Written to, it produces a body
nobody reads, and an unread body fails at the only thing it is for. Two measured
bodies came in at 1016 and 808 words and lost nothing at 335 and 300.

A recorded body runs longer for a reason that is not padding: each clip costs a
caption, and the section costs a pointer to the wire log. One measured at 551
with nothing to cut. Trimming a caption to reach 300 makes the clip *less*
likely to be played, which is the failure the aim exists to prevent.

Plain words, too. The same rule as a question: name what changed and what a
reader would see, not the reasoning that got there. The reasoning belongs in the
commit messages, which is where a reviewer goes for it.

Run the prose gate. Then write the body through the config's write path and
**read the body back to prove it changed** — a write can report success and
silently leave the body untouched.

Draft, not ready-for-review: the gate decisions and the `UNASSERTED` states are
yours to read before a human reviewer is pinged.

Done when the prose gate passes and the re-read body matches what you wrote.

### 11b. The follow-ups, in a shape someone can rule on

A follow-up written as prose cannot be triaged. The reader's questions are
always the same five, and a line that answers none of them gets re-derived by
hand or dropped: **is this mine, how bad, why does it exist, what breaks if it
never ships, and what would it cost.**

So each one carries an index row and five fields, on their own lines:

| Field | Holds |
|---|---|
| Surface | `FE`, `BE`, or `BE→FE` — which half owns the fix |
| Severity | `High`, `Med`, `Low` — by what a user loses, not by how ugly the code is |
| Why it exists | the condition that produced it, in plain words |
| If it never ships | the consequence, concretely. No consequence means no follow-up |
| Effort | an `/estimate-effort` figure **and the one-line reason** |
| Anchor | `file:line` proving the claim |

**The anchor is not decoration — it is the check on your own summary.** Two
claims in a measured run ("three copies", "seven callers") were plausible,
survived drafting, and died to a grep. Write the anchor by looking, not by
recalling.

**Plain words in the description, exact terms in the anchor.** A reader deciding
whether to take a ticket is not yet reading the code.

**Then say what merges.** Follow-ups from one ticket usually are not independent:
one often dissolves another. Name the merge, give the combined estimate against
the separate ones, and name the cost of merging — a high-severity item folded
into a refactor ships later than it would alone. Five follow-ups that are really
three tickets should say so; that is the judgment the list exists to support.

**Where each copy lives.** The PR body carries the index table and one line per
item, because a reviewer scans. The full five fields go in the run report, which
has no word budget and is what `/to-tickets` reads. Never the tracker — posting
there unprompted is refused by the user's own standing preference.

Done when every follow-up names its surface, its severity, its consequence, its
cost and its anchor, and the merges are stated.

## Aborts

Each stops the run with a report and **no PR**:

| # | Condition |
|---|---|
| 1 | Residue from step 1 unanswered — park the run |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | Two adversarial rounds with findings still open |
| 4 | `/spec-review` returns `BLOCK` |
| 5 | An assert `FAIL` that survives the expectation re-check |
| 6 | A live-verification step `FAIL`, or a body claim with no wire line behind it |

Token spend is not an abort condition. The phase list fixes the cost, and a
running orchestrator cannot measure its own spend.
