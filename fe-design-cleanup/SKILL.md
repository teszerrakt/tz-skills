---
name: fe-design-cleanup
description: List the design-map fact bases on this machine and suggest which are safe to delete, by build-ticket state and by age. Use when the user asks to clean up design scratch, free space from harvested Figma or API facts, or check which design efforts are finished.
disable-model-invocation: true
---

# FE Design Cleanup

Every `fe-design-map` effort leaves a **fact base** — harvested Figma annotations, PNG exports, endpoint notes, JSONC samples. It is throwaway by design: once the build tickets close, the published doc is the record and the fact base is dead weight.

Fact bases live under:

```
$HOME/.claude/fe-design-map/<repo>/<slug>/
```

## Two signals

**State is the real signal.** Each slug holds a `meta.json`:

```json
{
  "map_issue": "WF-42",
  "doc_url": "https://docs.example.com/d/...",
  "build_tickets": ["ABC-401", "ABC-402", "ABC-403"]
}
```

Read the build ticket ids and query the tracker. Every ticket closed means the effort has landed, whatever the dates say.

**Age is the fallback**, for a slug that never reached a ticket. A slug is old when its newest file has not changed for **one month**.

A slug can be untouched for three weeks with its build tickets still open. That is why state comes first.

## Timestamps

The filesystem carries them, so no file records them.

```bash
stat --printf='created=%w\n' "$SLUG"
find "$SLUG" -type f -printf '%T@\n' | sort -n | tail -1   # newest change
du -sh "$SLUG"
```

## Flow

1. List every slug under the fact base root. Report nothing found and stop, if the root does not exist.
2. Per slug: read `meta.json` if it exists, query the tracker for its build tickets, and measure size, created date, and newest change.
3. Present one table — slug, repo, size, age, ticket state, and a verdict of **landed**, **stale**, or **live**.
4. Ask which slugs to delete. Delete nothing until the user names them.
5. Delete one slug directory at a time with `rm -rf`, and report the space freed.

Never sweep. A slug is deleted because the user named it, never because it matched a rule. The rules only decide what to suggest.

A `live` slug is never suggested, even when it is old. Open build tickets mean the facts are still being read.

## Verdicts

| Verdict | Meaning |
|---|---|
| **landed** | every build ticket in `meta.json` is closed — safe to delete |
| **stale** | no `meta.json`, or no build tickets, and untouched for a month — probably abandoned |
| **live** | at least one build ticket is open — keep |
