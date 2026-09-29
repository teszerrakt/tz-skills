# The command center

A local page for a `/ship-epic` run: what the run ships, the questions that wait for the user, every answer they gave or the orchestrator gave while they were away, every reviewer finding and what happened to it, each session's step, and the order the PRs merge in. It listens on `127.0.0.1` only and has no dependencies beyond Node 18.

## Install

Copy this folder to `~/.claude/ship-ui/`, then name its commands in the delivery file's `### Parallel runs` (`setup-tz-skills` holds the template). Nothing starts it by hand: the first command that needs it starts it.

## Commands

| Command | Run by | Does |
|---|---|---|
| `ship-ui.mjs ask` | a session | puts one question on the page and on a toast, blocks until answered, prints `choice: <label>`, `text: <words>`, or both; then `by: orchestrator` and `decision: D<n>` when the orchestrator answered it |
| `ship-ui.mjs status` | a session | records its step, what it is doing, its model and its PR; prints `ok`, then one `revised:` line per answer the user changed |
| `ship-ui.mjs run --file <json>` | the orchestrator | says what the run ships: `id`, `title`, `summary`, `repo`, `github`, `target`, `where`, and `tickets` as `{ticket, title, group, after, url}` |
| `ship-ui.mjs followup` | the orchestrator | records one follow-up sentence and its anchor |
| `ship-ui.mjs questions` | the orchestrator | prints each open question with its id and options, `*` on the recommended one |
| `ship-ui.mjs answer --id <id> --choice <label> [--note ...] --as orchestrator` | the orchestrator, under `--afk` | answers one question as itself, recorded as a numbered unattended decision |
| `ship-ui.mjs revise --decision D<n> --choice <label> [--note ...]` | the orchestrator | passes on a change the user typed in chat; the same flow as the page's Change button |
| `ship-ui.mjs finding --ticket T --id F<n> --by <who> --severity <s> --claim ... [--anchor path:line] --outcome <o>` | a session, the orchestrator | records one reviewer finding; the same id again updates it |
| `ship-ui.mjs finding --ticket T --by <who> --verdict <v>` | a session, the orchestrator | records one whole review's result, such as `BLOCK` or `PASS_WITH_NOTES` |
| `ship-ui.mjs open` | anyone | opens the page |

`status --stopped` takes one reason: `question`, `waiting-slot`, `usage-limit`, `blocked-by-ticket`, `gate-failed`, `done` or `merged`.

`finding --severity` takes `blocker`, `major`, `minor` or `note`; `--outcome` takes `open`, `fixed`, `refused`, `withdrawn` or `held`. `--by` names the judge: `row check`, `adversarial review`, `spec review`, `second opinion`, `fallback review` or `orchestrator`.

## What it reads for itself

PR and merge state, through `gh`, every two minutes and after each `status`. A PR reads `can merge now` only when the ticket it waits for is merged, it is not a draft, its session finished, CI is green, no review thread is open, and the bot either reviewed it or was rate limited. CodeRabbit's own check is left out of CI, because it reads green on a PR it never reviewed.

## Limits

- Toasts are Windows only (`toast.ps1`, WPF). Elsewhere the page and the blocking `ask` still work; nothing pops up.
- State is one JSON file, `~/.claude/orchestrate/ui/state.json`. One run at a time.
- `SHIP_UI_PORT` moves it off 4777, `SHIP_UI_DATA` moves the state, `SHIP_UI_NO_PING` silences the toasts.
