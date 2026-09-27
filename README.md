# tz-skills

Personal Claude Code skills, shipped as one plugin that depends on Matt Pocock's. Every skill answers as `tz-skills:<name>`:

- **`fe-design-*`, `ask-stakeholders`, `estimate-effort`** — the frontend design-doc pipeline: chart it, ask the open questions, size the build tickets, clean up after. `estimate-effort` sizes any ticket, backend ones included.
- **`address-review`, `spec-review`** — PR review handling: address the comments a review left, and check a change against the ticket that asked for it.
- **`ship`**, **`ship-epic`** — drive one ticket, frontend or backend, from tracker to a PR ready for review, CodeRabbit's comments worked, or a whole epic's worth of them at once.
- **`verify-backend`** — drive a backend change's real endpoints and assert the persisted state; `ship`'s backend proof.
- **`standup`** — daily standup drafting.
- **`setup-tz-skills`** — scaffold the per-repo config the skills above read.

## Skills

### Design docs

`/tz-skills:fe-design-map` charts a frontend design doc as a **closed** seven-ticket map on the issue tracker, then works the tickets across sessions. The three harvest tickets and the live capture run unattended and prove their output against a gate ledger, so a lazy harvest fails a check instead of passing quietly. Capture runs before grilling, so the grilling works from live responses rather than samples derived from code.

| Skill | Invocation | What it does |
| ----- | ---------- | ------------ |
| `fe-design-map` | you type it | Charts the map, then works its tickets |
| `ask-stakeholders` | model or you | Posts a batch of open questions as one public Slack thread, tailored per persona |
| `fe-design-cleanup` | model or you | Lists the fact bases on this machine and suggests which are safe to delete |
| `estimate-effort` | model or you | Sizes a ticket in man-days, calibrated on the repo's own estimated-versus-actual history |

`fe-design-map` runs `estimate-effort` **before** it publishes the build tickets, so the estimates decide where the slices merge rather than describe a split that already happened.

The pipeline also calls the grilling and domain-modeling skills from the [mattpocock skills](https://github.com/mattpocock/skills) plugin. A plugin skill's id is plugin-qualified — `mattpocock-skills:grilling`, not `grilling` — so `fe-design-map` checks the available-skills list for the real id before it invokes one, and degrades to interviewing you directly when the plugin is absent.

### Engineering

| Skill | Trigger |
| ----- | ------- |
| `address-review` | "address review", "respond to CodeRabbit", PR triage |
| `spec-review` | you type it — `/tz-skills:spec-review`, `/tz-skills:spec-review 650`, `/tz-skills:spec-review <branch>` |
| `ship` | model or you — `/tz-skills:ship TRA-470` |
| `ship-epic` | you type it — `/tz-skills:ship-epic TRA-415` |
| `verify-backend` | model or you — after server work, or from `ship` |

`spec-review` judges a diff against one contract and nothing else. Every requirement of the ticket becomes a ledger row, and a row is met only with an anchor into the diff — a `file:line` the diff actually touched. Every change the ticket did not ask for is classed a **stray** (it blocks), **implied** (a named ADR or RFC requires it), or **ambiguous** (the reviewer quotes two readings of one ticket line, so the ticket is the defect, not the diff). The strays go to the PR and the ambiguities go to the ticket, each behind its own confirmation.

It never reviews code quality — `/code-review` owns that axis — and it never fires on its own. See [ADR-0001](./docs/adr/0001-spec-review-owns-the-spec-axis-alone.md).

`ship` drives a ticket to a **PR marked ready for review**, works CodeRabbit's first comments, and stops there — it never merges. It owns the phase sequence, each delegate's brief, the gate between phases, and the aborts — every phase's judgment stays in the skill that already owns it, named by the repo's `## Delivery` config rather than hardcoded, which is what keeps the driver portable. Its one blocking gate sits before implementation: it diffs the ticket against the design and the code, settles what documented precedence settles, and asks only about the residue. Two reviews run locally and everything else waits for the push: the spec axis, which a bot cannot cover because it never sees the ticket, and one adversarial pass whose findings come back schema-validated so the run can branch on severity and on whether a fix would land outside the ticket's scope. Its phases are ordered so every code-mutating one finishes before anything verifies — a spec review run before simplify judged a diff that simplify then edited. A ticket runs on the frontend track, the backend track, or both; only the proof differs, and the backend's is a live run against the PR's preview or a local namespace, recorded as a wire log. Design and the measurements behind it: [docs/ship-design.md](./docs/ship-design.md).

`ship-epic` drives every **takeable** ticket in one epic, each in its own background session running `/ship`. It owns which tickets it takes, how many run at once, what happens when one blocks, and the report you read afterwards — no phase judgment of its own. Sessions rather than subagents, because a subagent's grant carries no `ListAgents`, `SendMessage` or `AskUserQuestion`, and `/ship`'s gate exists to ask. Coordination is assigned in the spawn prompt rather than negotiated, since nothing reaches a session while it is working: each consumer session is told the paths it owns and the shared modules it imports rather than creates. A ticket whose gate finds residue **parks** while the others carry on, and the alarm fires only when no session can progress. A finished ticket's PR comes back from `/ship` ready and reviewed; an aborted one stays a draft whose body says why. Design and the probe evidence behind it: [docs/ship-epic-design.md](./docs/ship-epic-design.md).

### Productivity

| Skill | Trigger |
| ----- | ------- |
| `standup` | "standup", "what did I do yesterday", "standup summary" |

### Learning — moved out

`learn-from-doc`, `learn-from-zero`, and `learn-by-case` are gone. Use `teach` from the [mattpocock skills](https://github.com/mattpocock/skills) plugin instead: it keeps a stateful teaching workspace with a mission, learning records, reference docs, and lessons, rather than one Obsidian note per session. The shared `save-to-vault` procedure went with them, so nothing here writes to a vault any more.

Type it with the plugin prefix — `/mattpocock-skills:teach`. It is user-invoked, so no other skill can reach it and a bare `/teach` does not resolve.

## Install

```bash
claude plugin marketplace add teszerrakt/tz-skills
claude plugin install tz-skills@teszerrakt
```

Installing `tz-skills` installs Matt Pocock's `mattpocock-skills` plugin with it, at the same scope, as a declared dependency. `bunx @teszerrakt/skills` runs the same commands; `--uninstall` removes the plugin.

**The marketplace Matt Pocock's plugin comes from has to be added first** where it is missing. The dependency is `mattpocock-skills@claude-plugins-official`, from Claude's official marketplace, and installing `tz-skills` does not add that marketplace. Tested on a config with no marketplaces: the install succeeded but `tz-skills` failed to load, with `Dependency "mattpocock-skills@claude-plugins-official" is not installed`. With the official marketplace added first, the same install brought Matt's plugin along (`+ 1 dependency: mattpocock-skills`). `claude plugin marketplace list` shows whether it is there; when it is not:

```bash
claude plugin marketplace add anthropics/claude-plugins-official
```

`bunx @teszerrakt/skills` adds it for you.

Skills are namespaced: `/tz-skills:ship`, `/tz-skills:spec-review`, and so on. The two reviewer agents `/tz-skills:ship` runs are `tz-skills:simplify-reviewer` and `tz-skills:altitude-reviewer`, both pinned to Opus.

Then run `/tz-skills:setup-tz-skills` once per repo to write the per-repo config below.

### Moving off the symlink installer

Releases before the plugin linked each skill into `~/.claude/skills/` and each agent into `~/.claude/agents/`. Those links still answer as a bare `/ship` beside `/tz-skills:ship`, so delete every link there that points into a tz-skills clone. Deleting a link leaves the clone alone, but never delete one recursively: on Windows that follows a directory link into the clone. On macOS and Linux:

```bash
find ~/.claude/skills ~/.claude/agents -maxdepth 1 -type l -lname '*tz-skills*' -delete
```

### Developing the skills

Point the marketplace at your checkout instead of GitHub:

```bash
claude plugin marketplace add ~/Codes/tz-skills
claude plugin install tz-skills@teszerrakt
```

A session then loads the plugin in place from the checkout's `plugins/tz-skills/`, so an edit takes effect at the next session start, or after `/reload-plugins`, with no reinstall.

The repo root is the marketplace, and the plugin is `plugins/tz-skills/`: its skills, its agents, and its eval suite. What never ships stays at the root: `CLAUDE.md`, `CONTEXT.md`, `docs/`, `bin/`. A `CLAUDE.md` at a plugin's root is never loaded, and strict validation fails on it.

Before a PR:

```bash
bun run validate   # claude plugin validate --strict, on the marketplace and on the plugin
bun run eval       # claude plugin eval plugins/tz-skills
```

`claude plugin validate --strict .` checks only the marketplace file, never the skills and agents, so the plugin directory gets its own run. Every eval case must fail on the code before its change and pass after it, the rule `gate-check.mjs --dry` already applies to a gate.

## Per-repo config

Several skills read config from the repository you invoke them in. Every file is per-developer and stays untracked, so no workspace identifier and no delivery data lives in this repo.

| File | Read by | Holds |
| ---- | ------- | ----- |
| `.claude/fe-design-map.md` | `fe-design-map` | docs platform and home doc, API base URL, permissions source, Figma workspace, PRD home, tracker teams, doc authoring preferences |
| `.claude/delivery.md` | `ship`, `ship-epic` | the project's half of every phase, per track: commands, delegate skills, live target, migrations, parallel-run limits |
| `.claude/stakeholders.md` | `ask-stakeholders` | per colleague: handle, public channel, role, what they answer, and the register to write in |
| `.claude/standup.md` | `standup` | standup channel id, my Slack user id, GitHub login, and which ticket system to link |
| `.claude/estimate-calibration.md` | `estimate-effort` | the repo's estimated-versus-actual table, its floor and step size, and the diagnosed cause per miss |

Run `/tz-skills:setup-tz-skills` in a new repo to scaffold these. It detects what the repo already states — the remote, the token command, the ADR and RFC directories, the shared UI package — and asks only for what no file holds. It writes each ignore line **before** the file it covers, so a config file cannot exist unignored, and it ends by grepping its own output for leftover placeholders.

A skill whose config file is missing also asks for the values itself, then offers to write the file so the next run skips the questions. `estimate-effort` also labels its output **uncalibrated** until the file exists — an estimate calibrated on another codebase is a guess wearing a number.

`fe-design-map` writes its harvested facts to `~/.claude/fe-design-map/<repo>/<slug>/`. That directory is throwaway and is never pushed to a remote. `fe-design-cleanup` deletes it once the build tickets close.

## Updating

```bash
claude plugin marketplace update teszerrakt
claude plugin update tz-skills@teszerrakt
```

`update` moves only when the `version` in `plugins/tz-skills/.claude-plugin/plugin.json` changes, so a release bumps it. A checkout-backed install needs neither command: it already loads in place.
