---
type: tool_used
tool: Read
input_match: 'docs\W{1,2}agents\W{1,2}delivery\.md'
---

The review reads the committed delivery config. `\W{1,2}` matches `/` and a JSON-escaped Windows `\\` alike.
