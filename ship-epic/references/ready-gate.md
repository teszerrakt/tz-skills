# Ready gate: `hold`

Read at startup when `### Parallel runs` sets `Ready gate` to `hold`.

## Why

A draft runs no CI and gets no bot review on a repo whose workflows and bot skip drafts. A ready PR re-runs all of CI on every push. On a measured six-ticket run every PR went ready at step 12, then took fix rounds pushed one at a time, a bring-over push after each sibling merged, and an empty commit for a flaky job: it spent most of the team's daily CI allowance by midday. Held as drafts, the same pushes cost nothing, and each PR gets one CI run and one bot review, on the diff that merges.

## The flow

1. **Every spawn prompt says: hold the PR as a draft.** `/tz-skills:ship` step 12 then reports `--stopped held-draft` instead of marking it ready. A held draft holds no place, like `review`.
2. **Review the draft.** Run the three reviewers in `pr-reviewers.md` on every held PR, whatever its base, and whether or not the bot will review it later: the bot now reviews late, so this pass catches what it used to catch early. Hand the confirmed findings to the session; it fixes them, runs the local CI gate, pushes to the draft, and stops `held-draft` again.
3. **Mark ready when it is next to merge.**
   - A PR **nothing depends on** (its base is the main branch, and no sibling's work has to be brought onto it) is next as soon as its review is clean: tell its session "mark ready".
   - A **dependent** PR (stacked, or its body says what mounts at bring-over) waits for its turn. Give it the ticket it merges after as `after` in `Run context`; `watch` prints `next <ticket>: <after> merged; …` once that ticket merges. Then bring it over (`stack.md`, After the parent merges), push to the draft, run one more fresh `tz-skills:tz-fresh-reviewer` on the merged result (`git diff origin/<base> HEAD`, with the ticket as the spec) and have its findings fixed, and only then tell the session "mark ready".
4. **After ready**, step 12 runs as usual: one push per review round, never a push to re-run CI.

## Pushes

Where the config names `Push stagger`, space every "mark ready" and every bring-over push so the jobs they start stay under the CI's per-minute limit. Over that limit a job queues or fails at runner setup, and a refused job is re-run with `gh run rerun <run-id> --failed`, never a push.

## Shared files

Where the config names `Shared files`, the first ticket in the run that touches one splits it into the per-ticket layout the key names (an index plus one file per ticket), and every other spawn prompt names that session's own file. Siblings appending to one file conflict at every bring-over; one import line in an index conflicts at most once.
