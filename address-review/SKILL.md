---
name: address-review
description: Address CodeRabbit and human reviewer comments on a GitHub PR. Verifies each unresolved comment against current code, applies minimal fixes with validation, then posts replies referencing the fix commit. Two-phase: triage+fix, then post replies after the user pushes. Use when the user wants to address PR review feedback, work through CodeRabbit comments, or respond to review threads.
---

# address-review

End-to-end PR review handling. Two phases because replies need to reference
the commit SHA, which only exists after the fix is committed and pushed.

## Inputs

- PR number as arg: `/address-review 142`.
- No arg: detect via `gh pr view --json number,headRefOid`. If detached HEAD
  or no PR, ask for the number.

## Setup (both phases)

1. **`gh auth status` precheck.** If unauthenticated, stop and tell the user.
2. Resolve PR number, then `owner`/`repo` (`gh repo view --json owner,name`).
3. Compute the draft path — keyed by PR so concurrent reviews don't collide:

   ```bash
   DRAFTS="${TMPDIR:-/tmp}/address-review-drafts-<owner>-<repo>-<pr>.json"
   ```

## Which phase

Check whether `$DRAFTS` exists:

- Missing → **Phase 1**.
- Present + new commits since the draft's head SHA → **Phase 2**.
- Present + no new commits → ask whether to resume, discard, or post anyway.

---

## Phase 1 — Triage and fix

### 1. Fetch unresolved threads

REST `pulls/:n/comments` does not expose resolved state; use GraphQL.

```bash
gh api graphql -f query='
  query($owner:String!, $repo:String!, $pr:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$pr) {
        reviewThreads(first:100) {
          nodes {
            id isResolved isOutdated
            comments(first:50) {
              nodes { databaseId author{login} body path line diffHunk url }
            }
          }
        }
      }
    }
  }' -F owner=<o> -F repo=<r> -F pr=<n>
```

Keep `isResolved == false`. First comment per thread = the review comment.

### 2. Verify each thread

For every unresolved thread, read the file at `path`, locate the lines (grep
the `diffHunk` snippet if `line` is stale), read ~20 lines of context, then
classify:

| Bucket   | Meaning |
| -------- | ------- |
| FIX      | Issue still present, fix is direct. |
| ADJUST   | Reviewer proposed a patch but it needs tweaks. |
| REPLY    | Nit / disagreement / not actionable — just respond. |
| OUTDATED | File gone, code already matches, or lines unfindable. |

### 3. Triage table

Print one row per thread:

```text
| # | File:Line | Reviewer | Summary (≤80c) | Bucket | Proposed action |
```

Below the table, list any threads whose lines couldn't be located.

### 4. Per-row approval

Walk row-by-row via `AskUserQuestion` (batch up to 4 per call). For each:

> Row N — `<file:line>` (<reviewer>): <summary>. Default: **<BUCKET>** — <action>. Proceed?

Options: `Apply` / `Edit` / `Reclassify to <other-bucket>` / `Skip`.

If genuinely unsure of the classification, say so in one line with the
counter-argument; let the user decide.

### 5. Apply fixes (FIX + ADJUST)

Minimum change only. No refactors, no renames of unrelated symbols, no
"while we're here" cleanups. For ADJUST, start from the reviewer's proposal
and modify; note the delta in the reply draft.

Track `files_touched` per comment for SHA mapping later.

### 6. Validate

Run whatever the repo defines (`README`, `CONTRIBUTING.md`, or root scripts):
typecheck, lint, tests scoped to touched files. One retry on failure for an
obvious follow-up (missing import, typo). Still failing → surface and stop.

### 7. Draft replies + persist

For every approved row, draft a reply (terse, soft framing for pushback).
FIX/ADJUST replies include a `{sha}` placeholder; Phase 2 fills it.

Persist to `$DRAFTS` with enough state to resume: PR number, owner/repo, head
SHA at draft time, drafted-at timestamp, and per-draft: comment ID, thread ID,
path, line, bucket, reply template, files touched, and whether to auto-resolve
(FIX/OUTDATED = true; ADJUST/REPLY = false).

### 8. Hand off

> Triage + fixes done. <N> threads will get replies after the fix lands in a
> commit. Diff is unstaged.

### 9. Offer to commit / push

Then ask via `AskUserQuestion`:

> Commit and push these fixes now, or handle it yourself?

Options:

- **Commit & push (Recommended)** — commit on the current PR branch, push,
  then continue straight into Phase 2 in this session (the SHA now exists).
- **Commit only** — commit, don't push. Stop after; Phase 2 runs once pushed.
- **Leave it to me** — do nothing. User commits/pushes, re-invokes for Phase 2.

If committing: show the proposed message first, commit on the **current PR
branch** (already checked out — do not branch), follow the repo's commit
conventions and any harness-injected trailers. Never commit silently.

---

## Phase 2 — Post replies and resolve

### 1. Map drafts to SHAs

For each FIX/ADJUST draft:

```bash
git log --oneline <head_sha_at_draft>..HEAD -- <files_touched>
```

Use the latest commit that touched any of those files. Substitute into
`{sha}`. If no matching commit (the fix wasn't pushed), ask whether to skip or
post with HEAD anyway.

### 2. Preview

```text
Will post + auto-resolve:
  - <file:line>: <reply preview>
Will post (leave open):
  - <file:line>: <reply preview>
```

Ask: post all / edit one / cancel.

### 3. Post

```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments/<comment_id>/replies -f body="$REPLY"
```

### 4. Resolve (only FIX + OUTDATED)

```bash
gh api graphql -f query='
  mutation($id:ID!) {
    resolveReviewThread(input:{threadId:$id}) { thread { id isResolved } }
  }' -F id=<thread_id>
```

Leave ADJUST and REPLY threads open — the reviewer may want to re-check.

### 5. Clean up

Delete `$DRAFTS`. Report counts: replies posted, threads resolved, threads
left open.

---

## Hard rules

- **Minimum change.** No scope creep.
- **Never commit or push without explicit opt-in.** Step 9 always asks first;
  show the message before committing. User owns the message.
- **Don't invent comment/thread IDs.** Always sourced from the current
  GraphQL/REST response.
- **Filter resolved threads at fetch.** Don't reply to closed conversations.
- **No SHA before push.** Phase 2 only fires once the fix exists in a commit.
- **`gh auth status` precheck.** If unauthenticated, stop and tell the user.
- **Redact secrets** in any echoed command or output.
