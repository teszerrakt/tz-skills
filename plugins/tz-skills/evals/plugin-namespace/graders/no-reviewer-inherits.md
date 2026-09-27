---
type: regex
target: trace
pattern: '"resolvedModel":\s*"claude-(?!opus)'
match: not_contains
---

No agent launch resolves to a model other than Opus.
