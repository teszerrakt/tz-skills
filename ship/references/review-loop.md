# Step 12: working the review

**Wait on the `CodeRabbit` check's description, never its state.** The check reads `pass` for `Review completed` and for `Review rate limited` alike, and a rate-limited review posts no threads — read as clean, it passes a PR nothing looked at. Watch CI in the same wait (`gh pr checks <n> --watch`): CI takes about ten minutes, CodeRabbit about five. `--watch` can exit while the `CodeRabbit` check still reads `Review in progress`, so keep polling that check's description (`gh pr checks <n> --json name,description`, once a minute) until it reads `Review completed` or `Review rate limited`, or CI has finished ten minutes after `gh pr ready` with no `CodeRabbit` check at all.

- `Review completed` — work the threads.
- `Review rate limited` on a re-review, after the bot already completed one on this PR — ignore it. A push that only answers the bot's threads needs no second review.
- `Review rate limited` before the bot ever completed one — wait the time the bot's own comment names, then post `@coderabbitai review` once. Still limited: report `RATE_LIMITED`, a third state beside reviewed and clean, and run the fallback reviewer below.
- No `CodeRabbit` check at all — the repo runs no review bot. Report `NO_BOT` and run the fallback reviewer below.

**A PR the bot never reviewed gets step 8's reviewer instead.** Run it against the final head, with the same prompt, schema and scope rule, and work its findings exactly as step 8 does, two rounds included: fix in scope under this step's push rules, send a refused `blocker` or `major` back for the re-check, and add each refusal to the body as a `Refused:` line, then read the body back. A `blocker` or `major` still open after the second round is abort 10. The PR stays ready, and the run report may suggest posting `@coderabbitai review` once the limit lifts: the bot never re-tries on its own, and a session that re-asks only spends the shared limit. **The fallback review stands in for the bot's.** Once its findings are worked and none it raised is still open, the run reports the PR as **ready for review, backup-reviewed**, and names CodeRabbit as rate limited. While any finding is still open, it reports what is open, never "waiting on CodeRabbit": nothing is left to wait for.

Work the threads through `/tz-skills:address-review --driven <n>`: one pass, no question per thread, the fix committed and pushed by you, replies carrying the real SHA, nothing resolved. The brief carries the diff range and step 8's scope rule — a fix lands only in files the diff already touches, and anything else becomes a reply plus, only if it passes 11b's admission bar, a `Follow-ups` line in 11b's shape.

Re-run step 4's commands before each push, and on the backend track the migration check. A fix that changes a shot's state re-runs step 10 for that state, and a fix to an endpoint re-runs its step-10b flow: stale proof misrepresents the diff.

CI red gets two self-fix attempts, as in step 4. **Flake guard:** the same test failing twice with different error text is load, not a bug — stop rather than fix it a third time.

Two review rounds; CodeRabbit re-reviews each push. Threads still open after the second keep their reply and wait for the human.

Every `DISPUTED→REPLY` thread goes in the run report under what needs the user: a second opinion sided with the code, but a bug report the author argued down is still the user's to read.
