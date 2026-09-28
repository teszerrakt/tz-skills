---
max_turns: 40
timeout_seconds: 900
model: sonnet
allowed_tools: [Skill, Read, Glob, Grep, Agent]
tags: [spec-review, config]
plugins: [../.., mattpocock-skills]
---

Review the branch `feat/greet-by-name` against its ticket with /tz-skills:spec-review. This session has no shell, so I exported what git shows: `.review/branch.diff` is `git diff main...feat/greet-by-name`, and `.review/commits.txt` is its `git log --oneline`. The ticket is `.scratch/greeting/issues/01-greet-by-name.md`. Take your ledger rows as confirmed, so don't stop to ask me, and give me the verdict.
