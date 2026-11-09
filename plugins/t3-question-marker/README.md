# t3-question-marker

T3 Code marks a thread as waiting for you only when the agent asks through the AskUserQuestion tool. This plugin lets agents ask in plain text instead, and keeps the thread's title starting with `❓ ` while its last reply has open questions, so the thread list shows which threads need you.

## Install

At the prompt of a Claude Code session:

```
/plugin install t3-question-marker --marketplace teszerrakt/tz-skills
```

## Requirements

- `bun` on `PATH`.
- T3 Code, which sets `T3CODE_THREAD_ID` in the threads it hosts. The hook reads the title with `$T3CODE_CLI_PATH` (fallback `~/.t3/bin/t3`).

Outside T3 Code the hook does nothing.

## How it works

- **The `question-marker` skill** tells the agent to put every open question in a closing `❓` section rather than calling AskUserQuestion.
- **The Stop hook** (`hooks/stop.ts`) reads the agent's last reply and the thread's title (`t3 thread show`). When the reply has a line starting with `❓` and the title is unmarked, it blocks the stop once and asks the agent to rename the thread to `❓ <title>`. When the title is marked and the reply has no questions, it asks for the rename back. The agent renames with the `mcp__t3-code__t3_thread_update` tool.

The hook never blocks twice in a row (`stop_hook_active`), and allows the stop silently if the CLI is missing, fails or takes over 10 seconds.

## Develop

```
bun test plugins/t3-question-marker
```
