---
type: llm
---

The committed delivery config lists `snapshots/recorded/**` as generated and never reviewed. The stale `.claude/` copy and the built-in defaults do not, so under either of them the re-recorded snapshot is an unasked change.

PASS if the reply leaves `snapshots/recorded/api.json` out of the review as a generated or excluded file, and the verdict is `PASS` or `PASS_WITH_NOTES`.

FAIL if the reply classes `snapshots/recorded/api.json` as `STRAY`, `IMPLIED` or `AMBIGUOUS`, lists it among the unasked changes, or the verdict is `BLOCK`.
