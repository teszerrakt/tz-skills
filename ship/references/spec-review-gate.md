# Step 9: the spec-review gate

```bash
claude -p "/tz-skills:spec-review --driven <base>...<head> --rows <dir>/rows.json --ticket <dir>/ticket.md" \
  --add-dir <dir> --allowedTools "Read,Grep,Glob,Agent,Bash(git:*),Bash(awk:*),Bash(head:*),Bash(gh pr list:*)" > <dir>/spec-review.md
```

A session, not a subagent: spec-review spawns its own two agents, and a subagent cannot spawn agents. A `-p` session cannot ask for a tool, so the grant covers every command spec-review runs. **When the spawn is refused** — an auto-mode parent cannot always start a child with its own grant (`docs/ship-epic-design.md`) — give `tz-skills:tz-fresh-reviewer` the same driven arguments instead, plus the path of spec-review's `SKILL.md`, `log.txt`, and the diff saved three ways — `diff.patch`, `git diff --unified=0 <range>` as `diff-u0.patch`, and `git diff --name-only <range>` as `names.txt` — and capture its answer the same way. Fresh context is what this step needs; the session only buys spec-review its own two agents. Gate on the first line of that file, `VERDICT: <verdict>`, never on the exit code, as step 8 gates on parsed JSON, and on its second, `CANARY: none` (`judges.md`). A missing verdict line — both spawns refused, a crash, or none printed — or a leaked canary after the one re-run, is a failed review, and so are `NEEDS_ROWS` and `NO_CONTRACT`: all abort 9. Every `AMBIGUOUS` row the report returns goes to the run report's questions section, never to the PR.

It runs **after** every code-mutating phase. Run before simplify, it computed its verdict against a diff that no longer existed: the anchors it cited could be deleted by the time the PR opened, and simplify's own edits were never audited by anything.

The two local reviews are the two a bot cannot do. The spec axis, because CodeRabbit never sees the ticket; and step 8, because the CodeRabbit seat that reviews the PR for free allows three CLI reviews an hour. Everything else waits for the push, where step 12 works CodeRabbit's comments.

A `BLOCK` verdict aborts the run. Opening a PR that carries a known `MISSING` row is the failure the gate in step 1 exists to prevent, arriving eight phases later.

**`Spec-review BLOCK: lenient` buys one fix-and-rerun, for strays only.** When every row behind the `BLOCK` is a stray the ticket never asked for, delete those changes, re-run step 4's typecheck, lint and tests, then run step 9's command once more — never `/tz-skills:spec-review` in this session. A second `BLOCK` aborts. A `MISSING` criterion aborts at once, lenient or not: deleting code cannot supply a criterion. An absent key reads as `strict`. Name every deleted stray in the PR body, so the reviewer sees what the run took back out.

**A `BLOCK` the user rules on resumes here.** Add the ruling to `ticket.md`'s `## Decisions` with its own row, and record it in an empty commit (`git commit --allow-empty`) whose message carries the ruling, since `ticket.md` lives outside the worktree. A ruling that only settles scope re-runs step 9's command at once. A ruling that asks for code goes back to step 3, and every step from there runs again. Rename the blocked report to `spec-review.run1.md` beside the new one: it is the run's record of what the gate caught. Remove the draft's abort line once the run resumes.
