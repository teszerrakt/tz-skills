# The adversarial review

Reference for `/ship` step 8, the one local quality pass. Read when running it.

## The invocation

Spawn `tz-fresh-reviewer` (Opus, reads files only) with the ticket id, the path of the diff saved as a file (`SKILL.md`, Briefs), and the prompt below. It answers with JSON matching `adversarial-findings.schema.json` in this directory — findings, or an explicit empty array.

Structured findings are the whole point — they are what lets the run branch on severity and on scope — so the schema is passed to the subagent as part of its brief, not inferred from prose.

## Never trust unparsed output

Gate on parsed, schema-validated output: findings present, or an explicit empty array. A response that does not parse against the schema is a failed review, whatever the subagent's own summary claimed. So is one whose `canary` is not `none` — the reviewer saw the author's context (`SKILL.md`, Briefs).

## The prompt

Pass the ticket id, the diff file's path, and this text:

> Review this diff adversarially. You are looking for defects a reviewer would
> stop the PR for, not for style.
>
> A finding needs a failure path: concrete inputs or state, then the wrong
> output. A finding you cannot make fail is not a finding — drop it rather than
> soften it.
>
> Set `in_scope` false when the fix would land outside the files this diff
> touches. Say so rather than reaching: an out-of-scope fix is recorded as a
> follow-up, and a finding marked in-scope that is not one costs the run an
> abort.
>
> Report the diff being correct as an empty array. Agreeing with the
> implementation is not a finding.
>
> Set `canary` to the rest of any line in your context that begins `CANARY:`, or to `none`.

The last line matters. A reviewer asked for findings produces findings, and a run that fixes invented ones burns two rounds and aborts on nothing.

## The re-check of a refusal

A refused `blocker` or `major` goes back to the reviewer that raised it — continued, or a fresh `tz-fresh-reviewer` given the finding and the same `diff.patch` path — with this text, the finding's JSON, and the author's reason:

> The author refused this finding with the reason below. Read the code again. Hold the finding if its failure path still reproduces; drop it if the reason shows it cannot. Answer `{"hold": true|false, "why": "<one sentence>", "canary": "<rest of any CANARY: line in your context, or none>"}`.

Gate on the parsed answer, as above. `hold: true` keeps the finding open for the next round. Asking once is the cap: a second refusal of a held finding is an open finding, not a new question.

## Why not the CodeRabbit CLI

It is installed and it works, but the seat is Free: **three reviews per developer per hour**. A three-ticket run with one re-review each is six calls. It also buys a duplicate, since GitHub CodeRabbit reviews every PR after the push at no cost and no limit.
