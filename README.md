# tz-skills

Personal Claude Code skills. Two families:

- **`learn-*`** — learning-mode sessions that save to an Obsidian vault.
- **`address-review`** — PR review handling (no vault output).

## Skills

### Learning

| Skill              | Trigger                                             | Output                                          |
| ------------------ | --------------------------------------------------- | ----------------------------------------------- |
| `learn-from-doc`   | "digest this doc", "summarize this URL"             | `<vault>/Learning/<Topic>/NN - Doc - <slug>.md` |
| `learn-from-zero`  | "teach me X from scratch", "onboard me on X"        | `<vault>/Learning/<Topic>/NN - <topic>.md`      |
| `learn-by-case`    | "study case on X", "quiz me on X", "give me a case" | `<vault>/Learning/<Topic>/NN - Case - <slug>.md`|

All three learning skills maintain a per-topic `Glossary.md` with backlinks.

### Engineering

| Skill            | Trigger                                              |
| ---------------- | ---------------------------------------------------- |
| `address-review` | "address review", "respond to CodeRabbit", PR triage |

## Install

Requires [bun](https://bun.sh/).

### Recommended — one-liner via bunx

```bash
bunx tz-skills
```

Clones the repo to `~/.local/share/tz-skills` (override with `$TZ_SKILLS_DIR`)
and symlinks every skill subdirectory into `~/.claude/skills/`. Idempotent —
re-running pulls the latest from `main` and refreshes symlinks.

To remove our symlinks (clone stays put):

```bash
bunx tz-skills --uninstall
```

### Alternative — clone + run setup

Useful if you want the repo somewhere you'll edit frequently (e.g. `~/Codes/`).

```bash
git clone https://github.com/teszerrakt/tz-skills ~/Codes/tz-skills
cd ~/Codes/tz-skills
bun run setup
```

`bun run uninstall` removes the symlinks.

## Config

First skill invocation prompts for the Obsidian vault path. Result cached at
`~/.claude/tz-skills/config.json`. Edit that file directly to change the vault
later.

```json
{
  "vault": "/Users/<you>/Documents/<vault-name>"
}
```

## File conventions

Inside `<vault>/Learning/<Topic>/`:

- `NN - <topic>.md` — concept summary
- `NN - Doc - <slug>.md` — digest of an external doc
- `NN - Case - <slug>.md` — interactive Q&A case study
- `Glossary.md` — alphabetized terms with `[[NN - ...]]` backlinks

`NN` (session number) is computed by counting existing `NN - ` prefixed files
in the topic folder and incrementing.

## Updating skills

```bash
cd ~/Codes/tz-skills && git pull
```

Symlinks resolve to the repo so changes apply immediately. No re-link needed.
