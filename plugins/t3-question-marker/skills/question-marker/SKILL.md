---
name: question-marker
description: How to ask the user anything — a closing ❓ section in plain text, never the AskUserQuestion tool. Use whenever you are about to ask the user a question, offer a choice, request a decision or confirmation, or end a reply waiting on their input.
---

# Asking the user

Every open question goes in one closing `❓` section, in plain text. Do not use the AskUserQuestion tool.

## Format

The section is the last thing in the reply, under its own `❓` heading. Nothing follows it.

One block per question:

- The question, in under 15 words.
- One bullet per option: the choice in **bold**, then what the reader would see if they pick it.
- A `✨` line recommending one option.
- One `Asked because:` line naming what the answer decides.

```markdown
## ❓ Questions

**Keep the old endpoint while clients migrate?**

- **Keep it** — both endpoints live for a release; the old one logs a deprecation warning.
- **Drop it** — one endpoint; clients on the old path get a 404 today.

✨ Keep it: two clients still call the old path.
Asked because: the PR's scope and its release note depend on it.
```

No questions, no section. Never write a `❓` line for anything else.

## In T3 Code

T3 Code shows a thread as waiting only when it holds a question, and shows only a turn's last message. So the thread's title carries a `❓ ` prefix while your last reply has open questions, and the reply itself must stay the turn's last message:

- When the user's message arrives, a hook tells you the thread's title. If it is marked, the user has answered: rename it without the prefix before anything else.
- Before writing a reply that ends with a `❓` section, rename the thread to `❓ <title>`.
- Rename with `mcp__t3-code__t3_thread_update` (action `rename`, no `threadId`).

If you forget, a Stop hook blocks the stop and asks for the rename; do it, then repeat what it asks you to repeat, so the user still sees your reply.
