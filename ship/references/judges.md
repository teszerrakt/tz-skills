# Judges

How `/tz-skills:ship` keeps a judge fresh. Read it before spawning any judge: step 1's row check, step 8 and its refusal re-check, step 9's fallback, and step 12's fallback reviewer and second opinions.

Fresh means three things, and each has its guard:

- **No history.** Never a `fork` subagent, a skill with `context: fork`, `claude -p --continue` or `--resume`, or an agent continued with `SendMessage` from before it saw the diff. Each of those carries the author's conversation in.
- **A clean brief.** A judge's brief is its template with the slots filled: ticket id, diff range, file paths, schema. Add no prose — no summary of what was built, no "this fixes", no reason the code is right. A brief is the one door into a fresh context, and a sentence of the author's framing through it is the anchoring the fresh context exists to avoid. The refusal re-check is the one exception: it carries the author's reason, labelled as the author's.
- **The canary.** Step 0 puts a random word in the author's context, and every judge must echo whatever canary it can see. A fresh judge sees none.

**Every subagent judge is `tz-skills:tz-fresh-reviewer`** — step 1's row check, step 8, its refusal re-check, step 9's fallback, step 12's fallback reviewer, address-review's second opinion and ship-epic's reviewer. It has no shell, no write tool and no Skill tool, so it cannot change what it judges; a tool list naming a restricted shell still grants the whole shell. So before spawning it, save what it needs as files outside the worktree and name those paths in the brief: `git diff <range>` as `diff.patch`, and `git log <range>` as `log.txt` when commits carry decisions. A skill it must apply is passed as the path of that skill's `SKILL.md`, which sits beside this skill's own folder.

**Every judge's findings reach the user, not only the author.** When `## Delivery` names a `Finding` command, run it as the config writes it, once per finding with its own `--id F<n>`, and again with the same id whenever its outcome changes — `open`, then `fixed`, `refused`, `held` or `withdrawn`. Run it once per review with `--verdict` too, for a verdict such as step 9's. A finding the author fixed silently is the same hidden judgement as one it refused silently.

**The canary check.** The judge's answer carries a `canary` value: the rest of any line in its context that begins `CANARY:`, or `none`. The brief names the prefix, never the word. A missing value, or the word itself, voids that answer as an unparsed one is voided: re-run once with a new spawn, and a second leak fails the phase through that step's own abort. Never write the word to a file, a commit, the PR or any brief — anywhere a judge can read it, it proves nothing.
