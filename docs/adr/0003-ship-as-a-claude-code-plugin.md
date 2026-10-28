# Ship the skills as a Claude Code plugin

The skills install as one plugin, `tz-skills`, from this repo's own marketplace. `.claude-plugin/plugin.json` lists each skill folder where it already sits, so no folder moved, and the agents in `agents/` ship with it. Every command and agent now carries the plugin's name (`/tz-skills:ship`, `tz-skills:tz-fresh-reviewer`), and a bare name does not resolve inside a plugin, so the skill linter fails any skill that names one bare.

The reason is the tooling. `claude plugin validate` and `claude plugin eval` only see skills a manifest declares, and the eval suite is what stops a skill change from breaking behaviour that once worked.

## Considered Options

- Add the manifest and keep the symlink installer. Rejected: a machine with both lists every skill twice, `/ship` and `/tz-skills:ship`.
- Keep the symlinks and write our own validator. Rejected: no eval runner, and a second validator to keep in step with Claude Code's.
- Move every skill under `skills/`, the default plugin layout. Rejected: it renames every path in the history for no gain, since `plugin.json` can list the folders.
