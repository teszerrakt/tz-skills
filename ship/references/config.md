# `## Delivery` keys

What each key in `.claude/delivery.md`'s `## Delivery` section holds for `/tz-skills:ship`.

| Key | Holds |
|---|---|
| Tracks | the paths that put a ticket on the frontend track, the backend track, or both |
| Worktree root | where step 0 puts the tree |
| Per-worktree opt-outs | the hooks or plugins step 0 disables in the worktree |
| Typecheck / Lint / Tests | the two commands, and the skill that decides what a test may assert |
| Backend URL override | the env var that points the frontend dev server at another backend |
| Backend keys, marked `(BE)` | the backend track's half of steps 4–10b — [`references/backend-track.md`](backend-track.md) |
| Visual verification | the skill that diffs the running app against the design, and edits code |
| Smoke | the skill that boots the app and reads the console on the changed route |
| Adversarial review | the reviewer step 8 drives |
| Screenshots | the skill that owns shot selection |
| Design assertion | the skill and flag that assert computed style against tokens |
| Live verification | the skill and flag that record a flow against the real API |
| Verification bundle | the branch and directory a recording's artifacts are committed to |
| Token file | where a colour token resolves to its name |
| PR body sections | the allowed headings, in order, and the caps |
| PR body write path | how to write a body, and how to prove it landed |
| Spec-review BLOCK | `strict` or `lenient` — whether step 9 may fix a stray-only `BLOCK` once |
| Finding | the command that shows a judge's finding to the user — `judges.md` |
| Environment traps | the machine-specific gotchas a delegate must be told |
