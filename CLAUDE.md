## Agent skills

### Issue tracker

Issues live in GitHub Issues on teszerrakt/tz-skills, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Writing skills

Never hard-wrap markdown in a skill, its references, or an agent file: one paragraph or one list item per line, however long. A line break inside a paragraph is a wrap to remove, not a style to match.

## Proof

The plugin is `plugins/tz-skills/`; the repo root is its marketplace. `bun run validate` runs `claude plugin validate --strict` on both, because a run on the root checks only the marketplace file. `bun run eval` runs the eval suite in `plugins/tz-skills/evals/`. A new eval case must fail on the code before its change and pass after it.
