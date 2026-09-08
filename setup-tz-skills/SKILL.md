---
name: setup-tz-skills
description: Scaffold the per-repo config files the tz-skills read — fe-design-map, stakeholders, standup. Use when a tz-skill reports its config file is missing, or when adopting these skills in a new repo.
---

# Setup tz-skills

Provision the per-repo config that the tz-skills read.

Every config file is **per-developer and untracked**. The one tracked change this run makes is the ignore line, so the run shows that diff and says who commits it.

This run installs nothing. Symlinking the skills happens first, through `bunx @teszerrakt/skills`.

## Process

### 1. Explore

Detect first, ask second. A value a file already states is not a question.

- `~/.claude/skills/` — which of `fe-design-map`, `ask-stakeholders`, `standup`, `estimate-effort`, `spec-review`, `ship` are installed. **Each installed skill adds one section. Each absent skill adds none.**
- The available-skills list — is `mattpocock-skills:grilling` there, and `mattpocock-skills:domain-modeling`? `fe-design-map` runs both. The plugin name is part of the id, so match what the list shows.
- `.claude/` — does it exist? Does it hold a `.gitignore`? Which config files exist already, and which sections does each hold?
- `git remote -v` — the repo owner and the repo name.
- A staging-token command — a `Makefile` target or a `package.json` script. Search for `token`.
- `docs/adr/` and `docs/rfc/` — the design-doc directories.
- The shared UI package — a `packages/*` directory that holds component primitives.
- `.claude/skills/` — the repo-scoped skills a driven run delegates to. A screenshot skill and a test-policy skill are the two `ship` asks for by name.
- The typecheck command — the task runner's config, then the app's own `package.json`. An app declaring no `typecheck` script typechecks through `build`.
- Monorepo signals — `pnpm-workspace.yaml`, a `workspaces` field, or a populated `packages/*`.

### 2. Report, then ask

State what exploration found and what stays open. Name a missing mattpocock plugin here, once: link https://github.com/mattpocock/skills and carry on. A missing plugin degrades `fe-design-map`; it does not block this run.

Then take one section per installed skill, in order. Lead each section with the value exploration found, so the user accepts it in one word. Ask only for what no file states.

**Section A — `fe-design-map`.** Read [references/config-fe-design-map.md](references/config-fe-design-map.md). Writes `.claude/fe-design-map.md`.

**Section B — `ask-stakeholders`.** Read [references/config-stakeholders.md](references/config-stakeholders.md). Writes `.claude/stakeholders.md`.

Offer to seed the people from Slack. Given a named channel, list its members and propose one persona block each, with `role`, `what they answer`, and `register` left blank. A guessed register produces a badly-pitched question, which is the failure `ask-stakeholders` exists to prevent. Write no real name without the user's confirmation.

**Section C — `standup`.** Read [references/config-standup.md](references/config-standup.md). Writes `.claude/standup.md`.

**Section D — `estimate-effort`.** Create no file. `estimate-effort` decides to label its output **uncalibrated** by testing whether `.claude/estimate-calibration.md` exists. An empty stub makes the file exist, so the skill trusts a floor that no actual supports. Say the skill runs uncalibrated, and offer to derive the file from merged PRs and closed tickets as a separate run.

**Section E — `spec-review`.** Read [references/config-review-exclusions.md](references/config-review-exclusions.md). Appends a `## Review exclusions` section to `.claude/fe-design-map.md`.

This skill writes no file of its own. It reads the tracker, the ticket URL base, and the ADR and RFC paths from Section A. So when Section A is absent, write Section A first: `spec-review` cannot fetch a ticket without it.

**Section F — `ship`.** Read [references/config-delivery.md](references/config-delivery.md). Appends a `## Delivery` section to `.claude/fe-design-map.md`.

Like Section E it writes no file of its own, and it depends on Section A the same way. It also depends on Section E: `ship` runs `spec-review` as one of its phases, so a repo with `## Delivery` and no `## Review exclusions` has a driver whose review phase falls back to defaults.

### 3. Confirm

Show the full text of every file before you write it. Let the user edit it first.

### 4. Write

**Write the ignore line before the config file it covers.** A config file that exists before its ignore line can enter a commit, and these files hold Slack handles and delivery history.

1. Append one line per file to `.claude/.gitignore`. Create that file if it is absent.
2. Show the ignore diff. Say the user commits it.
3. Write each config file from its template.

On a re-run, fill only the missing sections. A filled section is the user's source of truth: to change one, show the old text and the new text, then wait.

### 5. Verify

Re-read every file this run wrote, and prove it is complete:

```bash
grep -n 'TODO:\|{{' .claude/fe-design-map.md .claude/stakeholders.md .claude/standup.md
```

Every template placeholder is `{{like this}}`, double-braced, so this pattern cannot fire on a real value. A single brace is legitimate content — `/v1/app/{service}/{resource}` is a URL pattern, not an unfilled field.

Report every hit by file and line. **A file with a hit is incomplete, whatever this run claims.** Silence from this command is the completion criterion.

Then name which skills work now, and which stay blocked and on what.
