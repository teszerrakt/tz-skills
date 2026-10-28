## Agent skills

### Issue tracker

Issues live in GitHub Issues on teszerrakt/tz-skills, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Writing skills

Before you create or edit a skill, a reference, an agent or an eval case, read `docs/authoring.md`: where a rule belongs, what a skill may point at, what the linter fails, how an eval case is built, and the checks that make a change done.

Never hard-wrap markdown in a skill, its references, or an agent file: one paragraph or one list item per line, however long. A line break inside a paragraph is a wrap to remove, not a style to match.
