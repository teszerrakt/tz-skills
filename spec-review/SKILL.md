---
name: spec-review
description: Adversarially review a branch or PR against its ticket and spec. Every acceptance criterion becomes a ledger row that needs an anchor in the diff, and every unasked change is classed as a stray, an implied change, or the symptom of an ambiguous ticket. Use when the user asks whether a change did what its ticket asked and nothing else, or asks to review a branch or PR for scope creep.
---

# spec-review

Judge one diff against one contract. Two questions, no others:

- **Did it do what the ticket asked?** Each requirement becomes a ledger row. A row is `MET` only with an anchor into the diff.
- **Did it do anything the ticket did not ask?** Each unasked change gets a class. An unasked change with no defence blocks.

The burden of proof sits on the diff. Silence is never proof. A reviewer who cannot anchor a row writes `MISSING`, not `MET`.

This skill does not review code quality. `/code-review` (CodeRabbit) owns that axis. See [ADR-0001](https://github.com/teszerrakt/tz-skills/blob/main/docs/adr/0001-spec-review-owns-the-spec-axis-alone.md).

## Vocabulary

The terms below are defined in [CONTEXT.md](https://github.com/teszerrakt/tz-skills/blob/main/CONTEXT.md): **contract**, **ledger row**, **prohibition row**, **anchor**, **stray**, **implied**, **ambiguous**, **declared deferral**, **verdict**, **questions table**.

## Config

Write no new config file. Read, in this order:

1. `.claude/fe-design-map.md` — the tracker, the team prefix, the ticket URL base, the ADR and RFC paths, the docs platform, and the `## Review exclusions` section.
2. `docs/agents/issue-tracker.md` — how to fetch a ticket in this repo.
3. Ask the user for what neither file states, as a **questions table** (CONTEXT.md).

A missing `## Review exclusions` section is not a blocker. Fall back to the defaults in step 4, name the fallback in the report, and offer `/setup-tz-skills` once.

## Process

### 1. Resolve the diff

Three input forms. Each resolves to one three-dot diff and one commit list.

| Input | Base | Head |
|---|---|---|
| none | `origin/main` | `HEAD` |
| a branch name | `origin/main` | that branch |
| a PR number | `gh pr view <n> --json baseRefName,headRefName,body,commits` | the head ref |

```bash
git diff <base>...HEAD
git log <base>..HEAD --oneline
```

A ticket id is **not** an input form. One ticket can produce several PRs — `TRA-417` produced #640 and #641. On a ticket id, run `gh pr list --search "<ID>" --state all --json number,title,headRefName`, show the matches, and ask which one. Never review the union diff. No PR ever contained it.

Confirm the ref resolves and the diff is non-empty before anything else runs.

### 2. Resolve the contract

Read the ticket id from the branch name (`feat/tra-418-…`) or from the commit subjects (`(TRA-418)`). Fetch four sources:

| Source | Role |
|---|---|
| The ticket | **The contract.** Every requirement row comes from here. |
| Its comments | Scope changes written after the ticket. Read them always — a scope note in a comment is the most common reason a stray is not a stray. |
| The design doc | Detail, binding **only** for the sections the ticket names. |
| ADRs and RFCs | Constraints. A diff can violate one. An ADR never adds scope. |

The tracker caveat in `docs/agents/issue-tracker.md` applies: work lands here without a ticket. When no ticket resolves, stop with the `NO_CONTRACT` verdict in step 6. Do not infer a contract from the branch name. A review against a guessed ticket manufactures both the misses and the strays.

### 3. Extract the ledger rows, then confirm them

A ticket in prose is normal. Convert it to rows, and **quote on every row**. A row with no quote never enters the ledger.

```jsonc
// ticket text: "The table should keep its state in the URL so a reload doesn't
// lose the user's sort and filters. Page size stays a client concern."
[
  { "id": "R-1", "quote": "keep its state in the URL", "row": "sort and filters serialize to the URL" },
  { "id": "R-2", "quote": "a reload doesn't lose the ... sort and filters", "row": "a reload restores both" },
  { "id": "R-3", "quote": "Page size stays a client concern", "row": "page size is NOT in the URL", "kind": "prohibition" }
]
```

A **prohibition row** is a first-class row. A prose ticket states what the diff must not do more often than an AC list does.

Print the rows and wait for the user to correct them, under a `❓` row saying that is what you are waiting for. The rows are the reviewer's paraphrase, so this is the one step where a wrong reading is cheap to fix — and a paraphrase printed without a visible question reads as a statement and goes unchecked.

For a PR that declares several tickets, build one ledger per ticket.

### 4. Fix the noise floor

Three kinds of changed file, three treatments. Read the globs from config; these are the defaults.

| Kind | Default globs | Treatment |
|---|---|---|
| Generated | `**/routeTree.gen.ts`, `**/package-lock.json` | Excluded. The tool wrote them. |
| Implied by convention | `**/*.test.*`, `**/*.stories.tsx`, `**/i18n/locales/*.json` | `IMPLIED` by default. |
| Everything else | — | Reviewed. |

**The caveat on the second kind binds.** A test that asserts a behaviour no ticket row asks for is a `STRAY`, and it names that behaviour. A test file reads as obligatory, so it is the easiest place to hide unasked work.

### 5. Run two sub-agents in parallel

The two halves bias each other inside one context. An agent that just proved eight rows met has a motive to read the ninth change as necessary. Give each agent its own inputs and its own `must not`.

**Agent A — completeness.**
- Inputs: the diff command, the confirmed rows, the cited design-doc sections.
- Brief: "One line per row. `MET` needs an anchor — `file:line` inside this diff, never elsewhere in the repo. No anchor means `MISSING`. `PARTIAL` needs an anchor too, plus one line saying what is missing. Quote the row's ticket text on every finding."
- Must not: class unasked changes.

**Agent B — strays.**
- Inputs: the diff command, the full ticket text, the ticket comments, the ADR and RFC list, the exclusion globs.
- Brief: "List every change no ticket line asks for. Class each one."
- Must not: judge whether the rows are met.

The three classes for agent B:

| Class | Test | Blocks |
|---|---|---|
| `STRAY` | The ticket reads one way and the change breaks it, or the ticket is silent. | Yes |
| `AMBIGUOUS` | The agent quotes **two readings of one ticket line**, and the change satisfies one. The ticket is the defect, not the diff. | No |
| `IMPLIED` | A named ADR, RFC, or design-doc line requires the change. Cite it. | No |

**An `AMBIGUOUS` finding with no second reading quoted is an unproven claim. Downgrade it to `STRAY`.** This is the rule that stops the class from becoming an excuse.

Add the sub-label `other-ticket` to a `STRAY` that belongs to another ticket's scope. Find the owner:

```bash
git log --oneline -- <path> | head
gh pr list --search "<keyword>" --state all --json number,title
```

A `STRAY(other-ticket: TRA-442)` still blocks. A change owned by a ticket the PR itself declares is not a stray at all.

### 6. Verify every anchor, then take the verdict

The parent verifies. An agent can write an anchor for a line that this diff never touched — that is the `EVIDENCE: pending` failure the gate ledgers already guard against.

```bash
git diff <base>...HEAD --unified=0 \
  | awk '/^\+\+\+ /{f=substr($2,3)}
         /^@@/{n=split($3,a,","); s=substr(a[1],2)+0; c=(n>1?a[2]+0:1);
               if (c>0) print f":"s"-"(s+c-1)}'
```

- The anchor's file is absent from `git diff --name-only` → the row becomes `MISSING`.
- The anchor's line falls outside every added range → the row becomes `PARTIAL`, noted "the behaviour predates this diff".

State each downgrade in the report. A weak reviewer must be visible.

A **declared deferral** removes a row from the verdict only when the PR body or a commit names **which** row it defers and its successor ticket:

- `Defers AC-3 (backfill) to TRA-411.` → `AC-3` is `DEFERRED`, cited, and does not block.
- The bare word "partial" defers nothing. Every unanchored row stays `MISSING`.

Then take one verdict:

| Verdict | When |
|---|---|
| `BLOCK` | Any `MISSING` row, or any `STRAY`. |
| `PASS_WITH_NOTES` | Every row `MET`, `PARTIAL` with an anchor, or `DEFERRED`; every unasked change `IMPLIED` or `AMBIGUOUS`. |
| `PASS` | Every row `MET`, no unasked change. |
| `NO_CONTRACT` | No ticket resolves. Report the PR body's own claimed intent, say no contract exists, and stop. |

With several tickets, take the worst verdict across the ledgers.

### 7. Report

Write the report to the scratchpad, never into the repo. It is session output.

```markdown
## TRA-418 — BLOCK (2 findings)

| # | Requirement (quoted) | Verdict | Anchor |
|---|---|---|---|
| R-1 | "the page reads `?sort=` on load" | MET | `url-state.ts:41` |
| R-2 | "sort persists across reload" | MISSING | — |
| R-3 | "page size stays a client concern" (prohibition) | MET | — |

### Unasked changes

| # | Change | Class | Defence |
|---|---|---|---|
| S-1 | the currency separator changed | STRAY(other-ticket: TRA-442) | none |
| S-2 | `eslint` rule added | IMPLIED | ADR-030 §3 |
| S-3 | the empty branch returns early | AMBIGUOUS | A: "handle no rows" = render nothing. B: = render the empty state. |
```

Those two tables are the record. **They are not how a question reaches the user** — see step 8.

### 8. The questions table first, then offer the PR post

Never post anywhere automatically. The findings split by audience, and one half is a question rather than feedback.

**Lead the reply with a `❓` table.** Every `AMBIGUOUS` row, every `MISSING` row the user must rule on, one row each, at the top — before the ledger, before the prose. A question that arrives after the explanation reads as part of the explanation and gets scrolled past.

| ❓ | Question | What each answer changes |
|---|---|---|
| ❓1 | When a list comes back empty, should the page show nothing at all, or a "no results" message? | **Nothing** — the area stays blank, matching what the ticket's wording implies. **A message** — the reader is told the search worked and found none, which is what the design frame draws. |

**Plain words inside that table.** No field names, no file paths, no `AMBIGUOUS`/`STRAY`/`MISSING`. Say what a person would see differently under each answer. The row's file, class and both quoted readings go on a line *underneath* the table, tagged with the row number — a reader who cannot picture the choice cannot make it, and deciding it is the only reason the row exists.

Then, and only then:

- **To the PR** — the `MISSING` rows and the `STRAY` rows. These are feedback on the diff. Offer it and take one confirmation.
  ```bash
  gh pr comment <n> --body-file <report>
  ```
- **Never to the ticket**, and do not offer to: a tracker comment goes unread, and the routing is the user's call — answered in conversation and fixed in the branch, or raised as an open question on a *new* ticket, never on the one about to close.

An `AMBIGUOUS` row on the PR blames the author for the ticket's defect. Keep the split.

Write no `❓` table when nothing needs deciding. An empty one trains the reader to ignore the marker.
