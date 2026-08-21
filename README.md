# tz-skills

Personal Claude Code skills. Three families:

- **`fe-design-*` + `ask-stakeholders`** — the frontend design-doc pipeline: chart it, ask the open questions, clean up after.
- **`address-review`** — PR review handling.
- **`standup`** — daily standup drafting.

## Skills

### Design docs

`/fe-design-map` charts a frontend design doc as a **closed** seven-ticket map on the issue tracker, then works the tickets across sessions. The three harvest tickets run unattended and prove their output against a gate ledger, so a lazy harvest fails a check instead of passing quietly.

| Skill | Invocation | What it does |
| ----- | ---------- | ------------ |
| `fe-design-map` | you type it | Charts the map, then works its tickets |
| `ask-stakeholders` | model or you | Posts a batch of open questions as one public Slack thread, tailored per persona |
| `fe-design-cleanup` | model or you | Lists the fact bases on this machine and suggests which are safe to delete |

The pipeline calls two skills that live elsewhere: `/grilling` and `/domain-modeling` from the [mattpocock skills](https://github.com/mattpocock/skills) plugin, and `estimate-effort`, which is not in this repo.

### Engineering

| Skill | Trigger |
| ----- | ------- |
| `address-review` | "address review", "respond to CodeRabbit", PR triage |

### Productivity

| Skill | Trigger |
| ----- | ------- |
| `standup` | "standup", "what did I do yesterday", "standup summary" |

### Learning — moved out

`learn-from-doc`, `learn-from-zero`, and `learn-by-case` are gone. Use `/teach` from the [mattpocock skills](https://github.com/mattpocock/skills) plugin instead: it keeps a stateful teaching workspace with a mission, learning records, and lessons, rather than one Obsidian note per session. The shared `save-to-vault` procedure went with them, so nothing here writes to a vault any more.

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

## Per-repo config

Two skills read config from the repository you invoke them in. Both files are per-developer and stay untracked.

| File | Read by | Holds |
| ---- | ------- | ----- |
| `.claude/fe-design-doc.md` | `fe-design-map` | docs platform and home doc, API base URL, permissions source, Figma workspace, PRD home, tracker teams, doc authoring preferences |
| `.claude/stakeholders.md` | `ask-stakeholders` | per colleague: handle, public channel, role, what they answer, and the register to write in |

`fe-design-map` writes its harvested facts to `~/.claude/fe-design-map/<repo>/<slug>/`. That directory is throwaway and is never pushed to a remote. `fe-design-cleanup` deletes it once the build tickets close.

## Updating skills

```bash
cd ~/Codes/tz-skills && git pull
```

Symlinks resolve to the repo so changes apply immediately. No re-link needed.
