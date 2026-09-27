## Agent skills

### Issue tracker

Issues live in GitHub Issues on teszerrakt/tz-skills, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Writing skills

Never hard-wrap markdown in a skill, its references, or an agent file: one paragraph or one list item per line, however long. A line break inside a paragraph is a wrap to remove, not a style to match.

## Validate and eval

The plugin is `plugins/tz-skills/`; the repo root is its marketplace. Before a PR, run `bun run validate`, `bun run eval` and `bun test`. The README's "Developing the skills" says why validation runs twice and what an eval case must prove.
