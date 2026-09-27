---
type: regex
target: trace
pattern: '"resolvedModel":\s*"claude-opus[\s\S]*"resolvedModel":\s*"claude-opus'
---

Both reviewer launches resolve to an Opus model while the session runs on Sonnet, so each is pinned rather than inherited.
