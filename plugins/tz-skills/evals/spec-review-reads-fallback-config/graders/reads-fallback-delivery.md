---
type: tool_used
tool: Read
input_match: '\.claude\W{1,2}delivery\.md'
---

With no committed delivery config, the review reads the `.claude/` fallback. `\W{1,2}` matches `/` and a JSON-escaped Windows `\\` alike.
