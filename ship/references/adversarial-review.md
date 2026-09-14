# The adversarial review

Reference for `/ship` step 8, the one local quality pass. Read when running it.

## The invocation

Spawn a fresh Opus subagent, restricted to reading, with the ticket id, the
diff range, and the prompt below. It answers with JSON matching
`adversarial-findings.schema.json` in this directory — findings, or an
explicit empty array.

Structured findings are the whole point — they are what lets the run branch
on severity and on scope — so the schema is passed to the subagent as part of
its brief, not inferred from prose.

## Never trust unparsed output

Gate on parsed, schema-validated output: findings present, or an explicit
empty array. A response that does not parse against the schema is a failed
review, whatever the subagent's own summary claimed.

## The prompt

Pass the ticket id, the diff range, and this text:

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

The last line matters. A reviewer asked for findings produces findings, and a
run that fixes invented ones burns two rounds and aborts on nothing.

## Why not the CodeRabbit CLI

It is installed and it works, but the seat is Free: **three reviews per
developer per hour**. A three-ticket run with one re-review each is six calls.
It also buys a duplicate, since GitHub CodeRabbit reviews every PR after the
push at no cost and no limit.
