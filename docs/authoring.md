# Authoring a skill

## Layout

A skill keeps in `SKILL.md` only what every run reads: what the skill owns, its config, the step list, each step's gate (`Done when …`), and its aborts. Anything only some runs reach (one track, one flag, one step's detail) is a **reference**: a file under the skill's `references/`, behind a one-line pointer that names when to read it.

```
ship/
  SKILL.md        always read
  references/     read only by the run that reaches the pointer
  scripts/        run, not read
```

A fix lands where its rule lives. A new rule for one step goes in that step's reference, not in `SKILL.md`.

## A skill stands alone

A skill runs in someone else's repo, so a bare path in it resolves there, not here. `(CONTEXT.md)` behind a rule pointed at the project's own glossary, or at nothing, and `ship` stopped closing its reply with the questions section.

- **State the rule in the skill** when the agent must follow it: inline, or in that skill's own `references/`.
- **Link this repo by absolute GitHub URL** only for background the run can do without.
- **Name another skill by its command and step** (`/tz-skills:ship` step 11b), never by a path into its folder.

## The linter

`bun run lint:skills` fails on:

- a skill folder missing from `.claude-plugin/plugin.json`, or a frontmatter `name` that is not the folder's name, or no `description`;
- a `SKILL.md` over 5,000 words (Anthropic's 500-line ceiling, in prose that never wraps). Over 3,000 words it warns;
- a hard-wrapped line in a skill, a reference or an agent;
- a link or a backticked `references/` or `scripts/` path that does not resolve;
- a bare `/ship` or `tz-fresh-reviewer`: inside a plugin only `/tz-skills:ship` and `tz-skills:tz-fresh-reviewer` resolve;
- an eval case with no `tags`, or a tag that is not a skill.

## Eval cases

A failure a skill once had becomes a case under `evals/<name>/`, so the fix cannot quietly undo itself. A bug in a script gets a unit test beside the script instead.

```
evals/ship-no-review-bot/
  case.yaml       prompt, tags, allowed tools, graders
  scaffold.sh     copies fixture/ into the run's workspace
  fixture/        the files the prompt names
```

- **Tags** name every skill the case exercises. A push runs the cases tagged with a changed skill or any skill that names one (`ship` changed runs `ship-epic`'s cases too).
- **The prompt** puts the agent at one moment of a run and asks for the next action without running anything. A whole `/tz-skills:ship` run needs GitHub and a tracker; one step's decision does not.
- **A user-invoked skill** (`disable-model-invocation: true`) cannot be loaded by the agent, so its case starts with the slash command.
- **Graders**: a `regex` grader where a token proves the behaviour (`NO_BOT`, `--stopped review`), an `llm` grader for the rest, its criteria written as PASS when … / FAIL when … with every exception the skill allows named.
- **A new case fails first.** Run it against the skill before the fix and keep it only if it goes red, or say in the case's description that it guards behaviour that already holds.

`bun run evals` runs the cases for this branch's changes; `bun run evals --all` runs every one. Each run is a full Claude session on this machine's login, three runs per case, and every run must pass. Flags after the script name pass through to `claude plugin eval` (`--case <name>`, `--runs 1`, `--keep-temp`).

## Checking a change

A skill change is done when these pass:

- `bun run check`: the linter, typecheck, oxlint and unit tests;
- `claude plugin validate . --strict`: the manifests, as CI checks them;
- `bun run check:versions`: a change to a skill or an agent raises `version` in `.claude-plugin/plugin.json` and `package.json` together, since `claude plugin update` skips a change that keeps the version;
- `bun run evals`: the cases of every skill the branch changes or affects.

The pre-push hook runs the linter, the unit tests and the evals. A run refused only for quota warns and lets the push through; run `bun run evals` once the quota resets.
