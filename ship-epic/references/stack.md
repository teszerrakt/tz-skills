# `--stack`

## Stacking

**Under `--stack`, a ticket blocked by this run's own ticket builds on that ticket's branch instead.** The user asks for it when a chain of full-stack tickets would otherwise ship one PR per run. Check `gh api repos/<owner>/<repo> --jq .allow_merge_commit` at startup. Where it is false, the chain merges by squash, and each child has to be brought onto the base after its parent merges (see After the parent merges, below). Say so once at startup, then stack anyway. Spawn the child once its parent's PR is **ready**, with the parent's branch and PR number as its base in the spawn prompt; `/tz-skills:ship` treats a named base as a stacked run. Each PR targets its parent's branch, so the review bot skips every PR above the first, and the orchestrator's reviewers in `pr-reviewers.md` read those. A parent that changes after its child spawned is the child's conflict to absorb: the command center's `conflicts with <branch>` line resumes it to merge the parent's branch in.

## After the parent merges

On a squash-only repo, the child then conflicts with the base: git sees the parent's files added twice. Bring the child over yourself once the user merges the parent:

1. Merge the parent's final head (`pull/<n>/head`) into the child, so the child holds everything the squash holds.
2. Merge the base. In a file that only the parent's squash touched since the merge base, the child's side is a superset, so take it (`git log <merge-base>..origin/<base> -- <file>` proves which commits touched it). Resolve any other conflict by hand.
3. Check that the PR still shows only the child's own work: the added and removed lines of `git diff origin/<base> HEAD` must equal those of `git diff <parent head> HEAD` taken before step 2.
4. Typecheck on the merged result, because the base now holds the other merged PRs too, then push.
