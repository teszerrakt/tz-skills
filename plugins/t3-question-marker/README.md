# t3-question-marker

T3 Code marks a thread as waiting for you only when the agent asks through the AskUserQuestion tool. This plugin lets agents ask in plain text instead, and keeps the thread's title starting with `❓ ` while its last reply has open questions, so the thread list shows which threads need you.

## Install

At the prompt of a Claude Code session:

```
/plugin install t3-question-marker --marketplace teszerrakt/tz-skills
```

## Requirements

- `bun` on `PATH`.
- `notify-send` and `xdg-open` for the desktop notification (Linux). Without them the hooks still mark titles.
- T3 Code, which sets `T3CODE_THREAD_ID` in the threads it hosts. The hook reads the title with `$T3CODE_CLI_PATH` (fallback `~/.t3/bin/t3`).

Outside T3 Code the hook does nothing.

## How it works

- **The `question-marker` skill** tells the agent to put every open question in a closing `❓` section rather than calling AskUserQuestion.
- **The UserPromptSubmit hook** (`hooks/prompt.ts`) reads the thread's title (`t3 thread show`) and tells the agent: remove the mark first if it is there (the user has answered), and add it before writing a reply that ends with a `❓` section. Renaming before the reply keeps the reply as the turn's last message, the only one T3 shows.
- **The Stop hook** (`hooks/stop.ts`) is the fallback. It reads the agent's last reply and the title; when they disagree (questions but no mark, or a mark but no questions), it blocks the stop once, asks for the rename, and asks the agent to repeat its `❓` section (or its reply) so the user still sees it. The agent renames with the `mcp__t3-code__t3_thread_update` tool.

- **Notifications.** Every turn the Stop hook lets end sends a desktop notification (`notify-send`): `❓ <thread>` with the first question, or `✓ <thread>` with the reply's first line. Its "Open thread" button opens `t3code://threads/<environment>/<thread>`, which T3 Code's desktop app navigates to. For the phone, the skill asks the agent to call `PushNotification` with its question (reaches you when Remote Control is connected).

The hook never blocks twice in a row (`stop_hook_active`), and allows the stop silently if the CLI is missing, fails or takes over 10 seconds.

## Develop

```
bun test plugins/t3-question-marker
```
