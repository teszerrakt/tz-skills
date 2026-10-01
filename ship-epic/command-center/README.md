# The command center

A local page for a `/ship-epic` run: what the run ships, the questions that wait for the user, every answer they gave or the orchestrator gave while they were away, every reviewer finding and what happened to it, each session's step, and the order the PRs merge in. It listens on `127.0.0.1` only and has no dependencies beyond Node 18.

## Install

Link this folder as `~/.claude/ship-ui` (`ln -s <checkout>/ship-epic/command-center ~/.claude/ship-ui`), so an update to the checkout is the running version; on Windows, where a link needs admin rights, copy it and copy again after each update. Then name its commands in the delivery file's `### Parallel runs` (`setup-tz-skills` holds the template). Nothing starts it by hand: the first command that needs it starts it.

## Commands

| Command | Run by | Does |
|---|---|---|
| `ship-ui.mjs ask` | a session | puts one question on the page and on a toast, blocks until answered, prints `choice: <label>`, `text: <words>`, or both; then `by: orchestrator` and `decision: D<n>` when the orchestrator answered it |
| `ship-ui.mjs status` | a session | records its step, what it is doing, its model and its PR; prints `ok`, then one `revised:` line per answer the user changed |
| `ship-ui.mjs run --file <json>` | the orchestrator | says what the run ships: `id`, `title`, `summary`, `repo`, `github`, `target`, `where`, and `tickets` as `{ticket, title, group, after, url}` |
| `ship-ui.mjs followup` | the orchestrator | records one follow-up sentence and its anchor |
| `ship-ui.mjs watch [--every 30]` | the orchestrator, in the background | runs until killed; prints one line per new thing to act on: an open question, a finished ticket whose PR has review threads open, CI failing or a conflict with its base (`resume …`), a worker that stopped for any reason other than done, a worker that posted no status for 30 minutes (`quiet …`) |
| page: Needs you | the user | a finding a reviewer left open on a finished ticket gets **Accept for now** (saved as a follow-up) or **Send back to fix** (`watch` prints `resume <ticket>: the user asked to fix <id>`) |
| `ship-ui.mjs questions` | the orchestrator | prints each open question with its id and options, `*` on the recommended one |
| `ship-ui.mjs answer --id <id> --choice <label> [--note ...] --as orchestrator` | the orchestrator, under `--afk` | answers one question as itself, recorded as a numbered unattended decision |
| `ship-ui.mjs revise --decision D<n> --choice <label> [--note ...]` | the orchestrator | passes on a change the user typed in chat; the same flow as the page's Change button |
| `ship-ui.mjs finding --ticket T --id F<n> --by <who> --severity <s> --claim ... [--anchor path:line] --outcome <o>` | a session, the orchestrator | records one reviewer finding; the same id again updates it |
| `ship-ui.mjs finding --ticket T --by <who> --verdict <v>` | a session, the orchestrator | records one whole review's result, such as `BLOCK` or `PASS_WITH_NOTES` |
| `ship-ui.mjs open` | anyone | opens the page |

`status --stopped` takes one reason: `question`, `waiting-slot`, `usage-limit`, `blocked-by-ticket`, `gate-failed`, `done` or `merged`.

`finding --severity` takes `blocker`, `major`, `minor` or `note`; `--outcome` takes `open`, `fixed`, `refused`, `withdrawn` or `held`. `--by` names the judge: `row check`, `adversarial review`, `spec review`, `second opinion`, `fallback review` or `orchestrator`.

## What it reads for itself

PR and merge state, through `gh`, every two minutes and after each `status`. A PR reads `can merge now` only when the ticket it waits for is merged, it is not a draft, its session finished, it has no conflict, CI is green, no review thread is open, and the bot either reviewed it or was rate limited. CodeRabbit's own check is left out of CI, because it reads green on a PR it never reviewed.

## Limits

- A toast closes itself once its question is answered anywhere else. A run sent with `"afk": true` starts with toasts off; the header's switch turns them on or off for the live run.
- Toasts are Windows only (`toast.ps1`, WPF), from Windows itself or from WSL, which reaches `powershell.exe`. On macOS and Linux the page and the blocking `ask` still work; nothing pops up.
- Under WSL the page is at the same `http://127.0.0.1:4777` in the Windows browser. Run one command center, not one on each side. They share the address: with the Windows one started first, the browser shows it while WSL sessions write to the other; with the WSL one first, the Windows one exits without a word.
- State is one JSON file, `~/.claude/orchestrate/ui/state.json`, holding one live run. When `run` names a new id, everything that belongs to another run moves to `runs/<id>.json` beside it; the header's picker shows those read only.
- Each ticket shows its session's `claude attach <id>` and session id, read from `claude agents --json` by matching the session's name to the ticket; the orchestrator is the session whose name starts with the run id.
- A machine with more than one Claude profile (`CLAUDE_CONFIG_DIR`) lists them in `~/.claude/orchestrate/ui/profiles`, one config folder per line, such as `~/.claude` and `~/.claude-work`. Each profile sees only its own sessions, so without the file the page shows those of the profile that started the server. With it, every listed profile is read, and each session prints `CLAUDE_CONFIG_DIR=<folder> claude attach <id>` with the folder that owns it. A ticket with a session in two profiles shows the newer one.
- To open it from a phone, put it behind `tailscale serve --bg --https=8443 http://127.0.0.1:4777` and write the `https://<machine>.<tailnet>.ts.net:8443` origin into `~/.claude/orchestrate/ui/origins`, one per line. Without that line the phone can read the page but not answer. Never list a public origin: anything listed there can answer for the user. Give it a port of its own: a phone that once opened another app at the bare address keeps that app's cached copy there.
- `SHIP_UI_PORT` moves it off 4777, `SHIP_UI_DATA` moves the state, `SHIP_UI_NO_PING` silences the toasts, `SHIP_UI_QUIET_MIN` moves the `quiet` line off 30 minutes.
