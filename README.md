# tz-skills

Personal Claude Code skills:

- **`fe-design-*`, `ask-stakeholders`, `estimate-effort`** — the frontend design-doc pipeline: chart it, ask the open questions, size the build tickets, clean up after.
- **`address-review`, `spec-review`** — PR review handling: address the comments a review left, and check a change against the ticket that asked for it.
- **`ship`**, **`ship-epic`** — drive one frontend ticket from tracker to draft PR, or a whole epic's worth of them at once.
- **`standup`** — daily standup drafting.
- **`setup-tz-skills`** — scaffold the per-repo config the skills above read.

## Skills

### Design docs

`/fe-design-map` charts a frontend design doc as a **closed** seven-ticket map on the issue tracker, then works the tickets across sessions. The three harvest tickets run unattended and prove their output against a gate ledger, so a lazy harvest fails a check instead of passing quietly.

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
| `spec-review` | you type it — `/spec-review`, `/spec-review 650`, `/spec-review <branch>` |
| `ship` | you type it — `/ship TRA-470` |
| `ship-epic` | you type it — `/ship-epic TRA-415` |

`spec-review` judges a diff against one contract and nothing else. Every requirement of the ticket becomes a ledger row, and a row is met only with an anchor into the diff — a `file:line` the diff actually touched. Every change the ticket did not ask for is classed a **stray** (it blocks), **implied** (a named ADR or RFC requires it), or **ambiguous** (the reviewer quotes two readings of one ticket line, so the ticket is the defect, not the diff). The strays go to the PR and the ambiguities go to the ticket, each behind its own confirmation.

It never reviews code quality — `/code-review` owns that axis — and it never fires on its own. See [ADR-0001](./docs/adr/0001-spec-review-owns-the-spec-axis-alone.md).

`ship` drives a ticket to a **draft PR** and stops there. It owns the phase sequence, each delegate's brief, the gate between phases, and the aborts — every phase's judgment stays in the skill that already owns it, named by the repo's `## Delivery` config rather than hardcoded, which is what keeps the driver portable. Its one blocking gate sits before implementation: it diffs the ticket against the design and the code, settles what documented precedence settles, and asks only about the residue. Two reviews run locally and everything else waits for the push: the spec axis, which a bot cannot cover because it never sees the ticket, and one adversarial pass whose findings come back schema-validated so the run can branch on severity and on whether a fix would land outside the ticket's scope. Its phases are ordered so every code-mutating one finishes before anything verifies — a spec review run before simplify judged a diff that simplify then edited. Design and the measurements behind it: [docs/ship-design.md](./docs/ship-design.md).

`ship-epic` drives every **takeable** ticket in one epic, each in its own background session running `/ship`. It owns which tickets it takes, how many run at once, what happens when one blocks, and the report you read afterwards — no phase judgment of its own. Sessions rather than subagents, because a subagent's grant carries no `ListAgents`, `SendMessage` or `AskUserQuestion`, and `/ship`'s gate exists to ask. Coordination is assigned in the spawn prompt rather than negotiated, since nothing reaches a session while it is working: each consumer session is told the paths it owns and the shared modules it imports rather than creates. A ticket whose gate finds residue **parks** while the others carry on, and the alarm fires only when no session can progress. It ends where `/ship` cannot: a finished ticket's PR is marked ready so CodeRabbit will look at it, and an aborted one stays a draft whose body says why. Design and the probe evidence behind it: [docs/ship-epic-design.md](./docs/ship-epic-design.md).

### Productivity

| Skill | Trigger |
| ----- | ------- |
| `standup` | "standup", "what did I do yesterday", "standup summary" |

### Learning — moved out

`learn-from-doc`, `learn-from-zero`, and `learn-by-case` are gone. Use `teach` from the [mattpocock skills](https://github.com/mattpocock/skills) plugin instead: it keeps a stateful teaching workspace with a mission, learning records, reference docs, and lessons, rather than one Obsidian note per session. The shared `save-to-vault` procedure went with them, so nothing here writes to a vault any more.

Type it with the plugin prefix — `/mattpocock-skills:teach`. It is user-invoked, so no other skill can reach it and a bare `/teach` does not resolve.

## Install

Requires [bun](https://bun.sh/).

### Recommended — one-liner via bunx

```bash
bunx @teszerrakt/skills
```

Clones the repo to `~/.local/share/tz-skills` (override with `$TZ_SKILLS_DIR`)
and symlinks every skill subdirectory into `~/.claude/skills/`. Idempotent —
re-running pulls the latest from `main` and refreshes symlinks.

To remove our symlinks (clone stays put):

```bash
bunx @teszerrakt/skills --uninstall
```

### Alternative — clone + run setup

Useful if you want the repo somewhere you'll edit frequently (e.g. `~/Codes/`).

```bash
git clone https://github.com/teszerrakt/tz-skills ~/Codes/tz-skills
cd ~/Codes/tz-skills
bun run setup
```

`bun run uninstall` removes the symlinks.

Both installers discover skills by scanning for a directory holding a `SKILL.md`, so a new skill needs no registration.

Then run `/setup-tz-skills` once per repo to write the per-repo config below.

## Per-repo config

Four skills read config from the repository you invoke them in. Every file is per-developer and stays untracked, so no workspace identifier and no delivery data lives in this repo.

| File | Read by | Holds |
| ---- | ------- | ----- |
| `.claude/fe-design-map.md` | `fe-design-map` | docs platform and home doc, API base URL, permissions source, Figma workspace, PRD home, tracker teams, doc authoring preferences |
| `.claude/stakeholders.md` | `ask-stakeholders` | per colleague: handle, public channel, role, what they answer, and the register to write in |
| `.claude/standup.md` | `standup` | standup channel id, my Slack user id, GitHub login, and which ticket system to link |
| `.claude/estimate-calibration.md` | `estimate-effort` | the repo's estimated-versus-actual table, its floor and step size, and the diagnosed cause per miss |

Run `/setup-tz-skills` in a new repo to scaffold these. It detects what the repo already states — the remote, the token command, the ADR and RFC directories, the shared UI package — and asks only for what no file holds. It writes each ignore line **before** the file it covers, so a config file cannot exist unignored, and it ends by grepping its own output for leftover placeholders.

A skill whose config file is missing also asks for the values itself, then offers to write the file so the next run skips the questions. `estimate-effort` also labels its output **uncalibrated** until the file exists — an estimate calibrated on another codebase is a guess wearing a number.

`fe-design-map` writes its harvested facts to `~/.claude/fe-design-map/<repo>/<slug>/`. That directory is throwaway and is never pushed to a remote. `fe-design-cleanup` deletes it once the build tickets close.

## Updating skills

```bash
cd ~/Codes/tz-skills && git pull
```

Symlinks resolve to the repo so changes apply immediately. No re-link needed.
