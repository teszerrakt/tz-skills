# The adversarial review

Reference for `/ship` step 8, the one local quality pass. Read when running it.

## The invocation

Plain `codex exec`, never `codex exec review`. The `review` subcommand has a
purpose-built review prompt but **silently ignores `--output-schema`**
([openai/codex#15451](https://github.com/openai/codex/issues/15451)) and answers
in prose. Structured findings are the whole point — they are what lets the run
branch on severity and on scope — so the plain form wins and the review prompt
lives here instead.

```bash
codex exec \
  --model gpt-6-astra \
  -c model_reasoning_effort=xhigh \
  --sandbox read-only \
  --ephemeral \
  --output-schema <this dir>/adversarial-findings.schema.json \
  -o <run dir>/findings.json \
  "$(cat prompt.txt)"
```

Read the findings from the `-o` file, not from stdout: stdout carries the
session's own chatter around the final message.

`codex exec` takes no approval flag at all — non-interactive runs never ask — so
`--sandbox read-only` is what keeps the reviewer from editing the diff it is
judging. Name the model and the effort explicitly even when
`~/.codex/config.toml` already sets them; that file is the user's and moves
underneath a run. `xhigh` is a choice, not a lookup: OpenAI publishes no
code-review effort guidance, and `xhigh` is the value `gpt-6-astra` itself uses
for `multi_agent_reasoning_effort`, one rung below `max`/`ultra` where cost
climbs with no published justification. Recalibrate it against real findings.

## Never gate on the exit code

`codex exec review --base <bad-ref>` printed *"Review blocked… No diff was
reviewed"* and **exited 0**. Gate on parsed, schema-validated output: findings
present, or an explicit empty array. Anything that does not parse is a failed
review, whatever the exit code said.

## The fallback fires on quota alone

An Opus reviewer agent with this same prompt and schema, and **only** on a
matched quota message in stderr. `codex` exits 1 for every runtime error, so
triggering the fallback on any non-zero exit would let one config typo silently
downgrade every review from here on, invisibly.

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
