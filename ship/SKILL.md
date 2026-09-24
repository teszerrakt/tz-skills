---
name: ship
description: Drive one ticket — frontend, backend, or both — from tracker to a PR ready for review — intake, the reconcile gate, implement, test, review, proof, the PR, then CodeRabbit's comments worked. Use when asked to ship, drive or deliver a ticket end to end, or when another skill needs one ticket taken to a PR.
argument-hint: "TRA-XXX"
---

# ship

Drive one ticket to a PR **marked ready for review, with CodeRabbit's comments
worked**, and stop there. No merge. The PR opens as a draft and is promoted
only after every phase passes: CodeRabbit skips a draft, so the promotion is
what starts its review.

This skill owns four things: the phase sequence, each delegate's **brief**, the
**gate** between phases, and the **aborts**. Every phase's judgment stays in the
skill or the reviewer that already owns it. Where the config names a skill,
invoke it and read its report. Contribute no testing and no screenshot or
recording knowledge here, and no review verdict of your own.

Design and the measurements behind it: [`docs/ship-design.md`](../docs/ship-design.md).

## Config

Write no new config file. Read, in this order:

1. `.claude/delivery.md` — the `## Delivery` section. An older install kept it
   inside `.claude/fe-design-map.md`; when `delivery.md` is absent and that
   section exists there, read it and offer to move it.
2. `.claude/fe-design-map.md`, when present — the tracker prefix, the ticket URL
   base, the ADR and RFC paths, the Figma file, and `## Sources`.
3. `docs/agents/issue-tracker.md` — how to fetch a ticket in this repo.
4. Ask the user for what no file states, as a **questions section** (CONTEXT.md).

`## Delivery` names the project's half of every phase:

| Key | Holds |
|---|---|
| Tracks | the paths that put a ticket on the frontend track, the backend track, or both |
| Worktree root | where step 0 puts the tree |
| Per-worktree opt-outs | the hooks or plugins step 0 disables in the worktree |
| Typecheck / Lint / Tests | the two commands, and the skill that decides what a test may assert |
| Backend URL override | the env var that points the frontend dev server at another backend |
| Backend keys, marked `(BE)` | the backend track's half of steps 4–10b — [`references/backend-track.md`](references/backend-track.md) |
| Visual verification | the skill that diffs the running app against the design, and edits code |
| Smoke | the skill that boots the app and reads the console on the changed route |
| Adversarial review | the reviewer step 8 drives |
| Screenshots | the skill that owns shot selection |
| Design assertion | the skill and flag that assert computed style against tokens |
| Live verification | the skill and flag that record a flow against the real API |
| Verification bundle | the branch and directory a recording's artifacts are committed to |
| Token file | where a colour token resolves to its name |
| PR body sections | the allowed headings, in order, and the caps |
| PR body write path | how to write a body, and how to prove it landed |
| Environment traps | the machine-specific gotchas a delegate must be told |

**A phase whose config line is absent reports `SKIPPED`.** It never disappears
from the report.

A repo with no `## Delivery` section at all: offer `/setup-tz-skills` once, then
ask for the values the phases you are about to run need.

## Tracks

A ticket runs on the **frontend track**, the **backend track**, or both, by the
paths its plan touches against the `Tracks` key. Step 2 picks; step 5 re-checks
against the real diff, and a ticket that grew a track runs that track's proof
too. Only the proof differs — every other phase is shared.

| Step | Frontend | Backend |
|---|---|---|
| 4 | tests skill, typecheck, lint | tests, typecheck, lint `(BE)` |
| 5 | visual verification | live verification, when an endpoint changes |
| 6 | smoke | — |
| 10 | shots and assert | — |
| 10b | live clip, when the claim is about the wire | the step-5 flow re-run on the final head |

On both tracks the backend's proof runs first, and the frontend's runs against
the backend this branch built.

A frontend-only ticket whose brief names a backend — a URL, or another worktree
to start one from — runs steps 5, 6 and 10b against it, through the `Backend URL
override` key. Its body opens with `Merge after #N` and the backend head SHA it
tested, because that PR is not on the base branch yet.

**On the backend track, read [`references/backend-track.md`](references/backend-track.md)
before step 4.** It holds that track's commands, the migration check, the live
target and the body's proof table.

## Briefs

Every delegate gets its brief in `$ARGUMENTS`: **the ticket id, the diff range,
and the phase's one question.** A skill fork inherits the caller's history and
still refuses when its own rules demand a file or a seam that nothing named.
Name it.

## Process

**Every code-mutating phase finishes before anything verifies.** Steps 0–8
change code; steps 9–11 judge it and report. A verification run before the last
edit judges a diff that no longer exists. Step 12 is the one exception: a bot
comments only on a pushed PR, so its fixes land after verification — minimal,
in scope, and re-checked before each push.

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

Then diff the criteria against the frames, the code and the migrations. On the
backend track the design is the RFC and the schema file: diff against the
endpoint contract, the permission rules and the tables they name.

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

Pick the ticket's tracks from the paths the plan touches (see Tracks).

Done when every component the plan names is either matched to an existing one or
proven absent, and the tracks are named.

### 3. Implement

The only phase that holds full context. Work the plan from step 2, under the
decisions from step 1. On both tracks, build the backend half first: the
frontend half is proven against it.

Typecheck as you go, using each track's command from `## Delivery`.

### 4. Test, typecheck and lint

Run this step once per track. Invoke the skill `## Delivery` names for tests. It
decides which seam a test belongs to and what it may assert; take its judgment
over your own. The backend track's rule and commands: `backend-track.md`.

Then run the repo's typecheck **and lint** commands. CI runs the full gate, so a
lint slip caught here costs seconds while the same slip caught by CI costs a
nine-to-ten-minute round trip — one per slip, and with auto-fix on the fixer
spends that round trip guessing.

Two self-fix attempts, then abort.

Done when tests, typecheck and lint all pass locally.

### 4b. Push and open the draft

Rebase on the base branch, push, and open the PR as a draft, its body one line
saying the run is in progress. It opens here rather than at step 11 because the
backend's live proof can run against a preview the host builds per PR, and a
preview exists only once the PR does. CodeRabbit skips a draft, so nothing
reviews early.

On the backend track, re-check every migration number the diff adds before the
push (`backend-track.md`, Migrations). Re-check it before every later push too.

Done when the draft exists and its head is the pushed commit.

### 5. Verify, while the code can still change

Re-check the tracks against the diff first. Then, per track:

- **Frontend.** Invoke the skill `## Delivery` names for visual verification,
  forked. It drives the change in the running app, diffs it against the design,
  and exercises the interactions.
- **Backend.** Live verification, when the diff changes an endpoint —
  `backend-track.md`, Step 5.

**Both edit code**, which is why they sit here and not beside the proof. Run after
the review and their edits go unaudited.

Done when every discrepancy is fixed, or refused with a stated reason.

### 6. Smoke the changed route — frontend track

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
`.claude/fe-design-map.md` — and on the backend track, the backend's own
conventions file — and the **comment budget**: a comment exists only to
state a constraint the code cannot show; flag every comment that restates its
next line.

Done when every finding is applied or refused with a stated reason.

### 8. Adversarial review

The one local quality pass, and the last phase that may change code. Invocation,
output schema, review prompt and the parse rule:
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
for the push, where step 12 works CodeRabbit's comments.

A `BLOCK` verdict aborts the run. Opening a PR that carries a known `MISSING` row
is the failure the gate in step 1 exists to prevent, arriving eight phases later.

### 10. Shoot and assert — frontend track

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

On the backend track this step re-runs step 5's flow against the final head and
keeps its wire log — `backend-track.md`, Step 10b. The rest of this section is
the frontend track's.

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

### 11. Write the PR body

Write the body to the sections `## Delivery` allows, in that order, carrying the
shots from step 10, any clip or backend proof table from step 10b, the step-1
decisions, the
out-of-scope findings from step 8, and any `UNASSERTED` or `UNOBSERVED` state.
The markdown for a shot and for a clip is printed by the skill that produced it;
paste what it gives you.

**Every artifact offered as proof is uploaded, or it is not proof.** A file on a
local branch, in a worktree, or at a path in a report is invisible to the person
being asked to believe it — they cannot open it, so the claim it backs reverts
to your word. This bites hardest on the artifact that cost the most to make: a
recorded clip is the strongest evidence a run produces and the easiest to leave
sitting on disk, because recording it feels like the finish line.

So the producing skill runs with its upload flag, and the returned URL goes in
the body or a comment. `uploads.github.com/user-attachments/assets` takes an
mp4 on the same endpoint as a PNG — only the declared content type differs, and
a video renders as a player. The URLs inherit repo visibility, so a private
repo's evidence stays private, and it is the only host whose media renders in a
PR there; a raw or blob URL needs auth the image proxy cannot supply. An
artifact already recorded can be uploaded on its own rather than re-shot.

Keeping the bundle off the remote is about **branches**, not evidence. Commit
the flow module, the wire log and the frames wherever the config says, and
upload the thing a reviewer has to see regardless.

**Aim for 300 words, or 550 with a live-verification section.** A longer body is
one nobody reads, and an unread body fails at the only thing it is for. Two
measured bodies came in at 1016 and 808 words and lost nothing at 335 and 300.

A recorded body runs longer for a reason that is not padding: each clip costs a
caption, and the section costs a pointer to the wire log. One measured at 551
with nothing to cut. Trimming a caption to reach 300 makes the clip *less*
likely to be played, which is the failure the aim exists to prevent.

Plain words, too. The same rule as a question: name what changed and what a
reader would see, not the reasoning that got there. The reasoning belongs in the
commit messages, which is where a reviewer goes for it.

**Write it in CodeRabbit's shape.** Its summary is the one reviewers read to
the end, because every line is a claim and none is an argument:

```markdown
## Summary

- **Fix:** bill exception amounts show the bill's currency, e.g. `IDR 14.500.000,00`
- **Change:** the exception count is gone from the panel header

## Changes

| Area | Files | What changed |
|---|---|---|
| **Exception copy** | `utils/bill-exception-copy.ts` | Returns text and money parts |
| **Panel** | `components/bill-exceptions-panel.tsx` | Takes a currency code; restyled to Figma |

## Merge risk

⚪ Minimal: styling and one new prop, both hosts pass it.

## Test plan

- [x] Bills suite green, typecheck and lint clean
```

- `Summary`: one line per bullet, labelled `**Fix:**`, `**Feature:**` or
  `**Change:**`, saying what a user sees. No file names, token names or pixel
  values — those are the diff's job.
- `Changes`: one row per area, one sentence per row. Skip it when one file moved.
- `Merge risk`: one of `⚪ Minimal`, `🔵 Low`, `🟡 Moderate`, `🔴 High`, and one
  sentence naming what could break. Rate by what a user loses if it is wrong.

The sections `## Delivery` names win over this example where the two differ.

Write the body through the config's write path and
**read the body back to prove it changed** — a write can report success and
silently leave the body untouched.

The PR stays a draft. Step 12 promotes it once 11b has written the follow-ups,
so the body is final before anything reviews it.

Done when the re-read body matches what you wrote.

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
has no word budget and is what `/mattpocock-skills:to-tickets` reads. Never the tracker — posting
there unprompted is refused by the user's own standing preference.

Done when every follow-up names its surface, its severity, its consequence, its
cost and its anchor, and the merges are stated.

### 12. Mark ready, then work the review

Runs only when no abort fired. `gh pr ready <n>`.

**Wait on the `CodeRabbit` check's description, never its state.** The check
reads `pass` for `Review completed` and for `Review rate limited` alike, and a
rate-limited review posts no threads — read as clean, it passes a PR nothing
looked at. Watch CI in the same wait (`gh pr checks <n> --watch`): CI takes
about ten minutes, CodeRabbit about five.

- `Review completed` — work the threads.
- `Review rate limited` — wait the time the bot's own comment names, then post
  `@coderabbitai review` once. Still limited: report `RATE_LIMITED`, a third
  state beside reviewed and clean.

Work the threads through `/address-review --driven <n>`: one pass, no question
per thread, the fix committed and pushed by you, replies carrying the real SHA,
nothing resolved. The brief carries the diff range and step 8's scope rule — a
fix lands only in files the diff already touches, and anything else becomes a
reply plus a `Follow-ups` line in 11b's shape.

Re-run step 4's commands before each push, and on the backend track the
migration check. A fix that changes a shot's state re-runs step 10 for that
state, and a fix to an endpoint re-runs its step-10b flow: stale proof
misrepresents the diff.

CI red gets two self-fix attempts, as in step 4. **Flake guard:** the same test
failing twice with different error text is load, not a bug — stop rather than
fix it a third time.

Two review rounds; CodeRabbit re-reviews each push. Threads still open after
the second keep their reply and wait for the human.

Done when CI is green, the `CodeRabbit` check reads `Review completed` or the
run reports `RATE_LIMITED`, and every CodeRabbit thread has a reply.

## Aborts

Each stops the run with a report. Aborts 1–2 fire before step 4b and leave **no
PR**. Every later abort leaves the draft with one line in the body saying why;
abort 7 fires after promotion, so the PR first goes back to draft (`gh pr ready
<n> --undo`). A ready PR always means every phase passed.

| # | Condition |
|---|---|
| 1 | Residue from step 1 unanswered — park the run |
| 2 | Typecheck, lint or tests still failing after two self-fix attempts |
| 3 | Two adversarial rounds with findings still open |
| 4 | `/spec-review` returns `BLOCK` |
| 5 | An assert `FAIL` that survives the expectation re-check |
| 6 | A live-verification step `FAIL`, or a body claim with no wire line behind it |
| 7 | CI still red after two self-fix attempts in step 12 |
| 8 | The backend's live target never came up — `backend-track.md`, Live target |

Token spend is not an abort condition. The phase list fixes the cost, and a
running orchestrator cannot measure its own spend.
