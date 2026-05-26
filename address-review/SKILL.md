---
name: address-review
description: Address CodeRabbit and human reviewer comments on a GitHub PR. Verifies each unresolved comment against current code, applies minimal fixes with validation, then posts replies referencing the fix commit. Two-phase: triage+fix, then post replies after the user pushes. Use when the user wants to address PR review feedback, work through CodeRabbit comments, or respond to review threads.
---

# address-review

End-to-end PR review handling. Two phases because replies need to reference
the commit SHA, which only exists after the user pushes.

## Inputs

- PR number as arg: `/address-review 142`.
- No arg: detect via `gh pr view --json number,headRefOid`. If detached HEAD
  or no PR, ask for the number.

## Which phase

Look for `.git/skill-address-review-drafts.json`:

- Missing → **Phase 1**.
- Present + new commits since the draft → **Phase 2**.
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

```
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

Persist to `.git/skill-address-review-drafts.json` with enough state to
resume: PR number, owner/repo, head SHA at draft time, drafted-at timestamp,
and per-draft: comment ID, thread ID, path, line, bucket, reply template,
files touched, and whether to auto-resolve (FIX/OUTDATED = true; ADJUST/REPLY
= false).

### 8. Hand off

> Triage + fixes done. <N> threads will get replies after you push. Diff is
> unstaged — review, commit, push, then re-invoke me to post replies.

Do not stage, commit, or push. User owns commit messages.

---

## Phase 2 — Post replies and resolve

### 1. Map drafts to SHAs

For each FIX/ADJUST draft:

```bash
git log --oneline <head_sha_at_draft>..HEAD -- <files_touched>
```

Use the latest commit that touched any of those files. Substitute into
`{sha}`. If no matching commit (user didn't push that fix), ask whether to
skip or post with HEAD anyway.

### 2. Preview

```
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

Delete `.git/skill-address-review-drafts.json`. Report counts: replies
posted, threads resolved, threads left open.

---

## Hard rules

- **Minimum change.** No scope creep.
- **Never auto-commit or push.** User owns that.
- **Don't invent comment/thread IDs.** Always sourced from the current
  GraphQL/REST response.
- **Filter resolved threads at fetch.** Don't reply to closed conversations.
- **No SHA before push.** Phase 2 only fires once the fix exists in a commit.
- **`gh auth status` precheck.** If unauthenticated, stop and tell the user.
- **Redact secrets** in any echoed command or output.
