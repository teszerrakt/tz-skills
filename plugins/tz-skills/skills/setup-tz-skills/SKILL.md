---
name: setup-tz-skills
description: Scaffold the per-repo config files the tz-skills read — delivery, fe-design-map, stakeholders, standup — on top of Matt Pocock's setup. Use when a tz-skill reports its config file is missing, or when adopting these skills in a new repo.
---

# Setup tz-skills

Provision the per-repo config that the tz-skills read.

It builds on Matt Pocock's setup, which describes the repo's tracker, triage labels and domain docs in `docs/agents/`. `ship` and `spec-review` fetch their tickets through his tracker file, not through anything this run writes.

This run installs nothing.

## Where each file goes

| File | Home | Holds |
|---|---|---|
| `delivery.md` | `docs/agents/`, committed beside Matt Pocock's files | `## Delivery` and `## Review exclusions`: repo facts every clone reads alike |
| `fe-design-map.md` | `.claude/`, untracked | the design-map config |
| `stakeholders.md`, `standup.md`, `estimate-calibration.md` | `.claude/`, untracked | personal ids and delivery history, never shared |

The delivery file is **committed config** (CONTEXT.md). A team repo that will not take committed config keeps the same file under the same name in `.claude/`, untracked: the **fallback config**. Every skill reads the committed path first and the `.claude/` copy only when the committed one is absent, so adopting committed config later is a plain file move.

Write the committed file unless the user says the repo will not take committed config; then write the fallback.

## Process

### 1. Require Matt Pocock's setup

Find his tracker file, `docs/agents/issue-tracker.md`.

When it is missing, stop. Say his setup has not run, tell the user to type `/mattpocock-skills:setup-matt-pocock-skills` and then run this skill again, and write nothing, not even an ignore line, however the request is worded. His setup is user-invoked, so this skill cannot run it for them.

### 2. Explore

Detect first, ask second. A value a file already states is not a question.

- The available-skills list — is `mattpocock-skills:grilling` there, and `mattpocock-skills:domain-modeling`? `fe-design-map` runs both. The plugin name is part of the id, so match what the list shows.
- `docs/agents/` and `.claude/` — which config files exist already, and which sections does each hold? Does `.claude/` hold a `.gitignore`?
- `git remote -v` — the repo owner and the repo name.
- A staging-token command — a `Makefile` target or a `package.json` script. Search for `token`.
- `docs/adr/` and `docs/rfc/` — the design-doc directories.
- The shared UI package — a `packages/*` directory that holds component primitives.
- `.claude/skills/` — the repo-scoped skills a driven run delegates to. A screenshot skill and a test-policy skill are the two `ship` asks for by name.
- The typecheck command — the task runner's config, then the app's own `package.json`. An app declaring no `typecheck` script typechecks through `build`.
- Monorepo signals — `pnpm-workspace.yaml`, a `workspaces` field, or a populated `packages/*`.

### 3. Report, then ask

State what exploration found and what stays open. Name a missing mattpocock plugin here, once: link https://github.com/mattpocock/skills and carry on. A missing plugin degrades `fe-design-map`; it does not block this run.

Then take every section below, in order: the `tz-skills` plugin installs all of its skills together. Lead each section with the value exploration found, so the user accepts it in one word. Ask only for what no file states.

**Section A — `fe-design-map`.** Read [references/config-fe-design-map.md](references/config-fe-design-map.md). Writes `.claude/fe-design-map.md`.

**Section B — `ask-stakeholders`.** Read [references/config-stakeholders.md](references/config-stakeholders.md). Writes `.claude/stakeholders.md`.

Offer to seed the people from Slack. Given a named channel, list its members and propose one persona block each, with `role`, `what they answer`, and `register` left blank. A guessed register produces a badly-pitched question, which is the failure `ask-stakeholders` exists to prevent. Write no real name without the user's confirmation.

**Section C — `standup`.** Read [references/config-standup.md](references/config-standup.md). Writes `.claude/standup.md`.

**Section D — `estimate-effort`.** Create no file. `estimate-effort` decides to label its output **uncalibrated** by testing whether `.claude/estimate-calibration.md` exists. An empty stub makes the file exist, so the skill trusts a floor that no actual supports. Say the skill runs uncalibrated, and offer to derive the file from merged PRs and closed tickets as a separate run.

**Section E — `ship`, `ship-epic`.** Read [references/config-delivery.md](references/config-delivery.md). Writes the `## Delivery` section of the delivery file, at the home [Where each file goes](#where-each-file-goes) picks. Its `### Parallel runs` subsection is `ship-epic`'s alone; write it only for a repo whose app can run several dev servers at once.

**Section F — `spec-review`.** Read [references/config-review-exclusions.md](references/config-review-exclusions.md). Appends a `## Review exclusions` section to the delivery file. A repo that runs `spec-review` without `ship` writes the delivery file with this section alone. `spec-review` fetches its ticket through Matt Pocock's tracker file, so it needs nothing from Section A.

`ship` runs `spec-review` as one of its phases, so a delivery file with no `## Review exclusions` gives the driver a review phase that falls back to defaults.

### 4. Confirm

Show the full text of every file before you write it. Let the user edit it first.

### 5. Write

**Write the ignore line before the untracked file it covers.** An untracked file that exists before its ignore line can enter a commit, and these files hold Slack handles and delivery history.

1. Append one line per untracked file to `.claude/.gitignore`. Create that file if it is absent.
2. Write each config file from its template, at its home.
3. Show the diff of every tracked change — the ignore lines, and the delivery file when it is committed config. Say the user commits it.

On a re-run, fill only the missing sections. A filled section is the user's source of truth: to change one, show the old text and the new text, then wait.

### 6. Verify

Re-read every file this run wrote, and prove it is complete. Pass the files this run wrote:

```bash
grep -n 'TODO:\|{{' docs/agents/delivery.md .claude/delivery.md .claude/fe-design-map.md .claude/stakeholders.md .claude/standup.md
```

Every template placeholder is `{{like this}}`, double-braced, so this pattern cannot fire on a real value. A single brace is legitimate content — `/v1/app/{service}/{resource}` is a URL pattern, not an unfilled field.

Report every hit by file and line. **A file with a hit is incomplete, whatever this run claims.** Silence from this command is the completion criterion.

Then name which skills work now, and which stay blocked and on what.
