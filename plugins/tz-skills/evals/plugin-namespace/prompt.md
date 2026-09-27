---
max_turns: 12
timeout_seconds: 300
model: sonnet
allowed_tools: [Skill, Agent]
tags: [packaging]
plugins: [../.., mattpocock-skills]
---

This is a resolution check for the tz-skills plugin. Do not read, search or edit any file, and run no command.

1. Invoke the skill `tz-skills:ship` with the argument `RESOLVE-CHECK`. Once it loads, follow none of its steps: loading it is the whole check.
2. Spawn the agent type `tz-skills:simplify-reviewer` and the agent type `tz-skills:altitude-reviewer`, once each, without a model override. Give each exactly this prompt: "Resolution check. Use no tool and reply with the single word READY."
3. Reply with one line per id saying whether it resolved, and stop.
