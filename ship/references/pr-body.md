# Step 11: the PR body

**A refusal is one `Refused:` line**: the finding's claim word for word, then the reason in one clause. A refusal the reviewer of the PR never sees is the author's word closing its own finding. `Refused:` lines and `Considered, not proposed` lines go under the section `## Delivery` names for out-of-scope work, `Out of scope` when it names none. The markdown for a shot and for a clip is printed by the skill that produced it; paste what it gives you, reshaped only where `## Delivery`'s body rules forbid its form.

**Every artifact offered as proof is uploaded, or it is not proof.** A file on a local branch, in a worktree, or at a path in a report is invisible to the person being asked to believe it — they cannot open it, so the claim it backs reverts to your word. This bites hardest on the artifact that cost the most to make: a recorded clip is the strongest evidence a run produces and the easiest to leave sitting on disk, because recording it feels like the finish line.

So the producing skill runs with its upload flag, and the returned URL goes in the body or a comment. `uploads.github.com/user-attachments/assets` takes an mp4 on the same endpoint as a PNG — only the declared content type differs, and a video renders as a player. The URLs inherit repo visibility, so a private repo's evidence stays private, and it is the only host whose media renders in a PR there; a raw or blob URL needs auth the image proxy cannot supply. An artifact already recorded can be uploaded on its own rather than re-shot.

Keeping the bundle off the remote is about **branches**, not evidence. Commit the flow module, the wire log and the frames wherever the config says, and upload the thing a reviewer has to see regardless.

**Aim for 300 words, or 550 with a live-verification section**, counting prose only: an image or clip line and its one-line label add no words. A longer body is one nobody reads, and an unread body fails at the only thing it is for. Two measured bodies came in at 1016 and 808 words and lost nothing at 335 and 300.

A recorded body runs longer for a reason that is not padding: each clip costs a caption, and the section costs a pointer to the wire log. One measured at 551 with nothing to cut. Trimming a caption to reach 300 makes the clip *less* likely to be played, which is the failure the aim exists to prevent.

Plain words, too. The same rule as a question: name what changed and what a reader would see, not the reasoning that got there. The reasoning belongs in the commit messages, which is where a reviewer goes for it.

**Write it in CodeRabbit's shape.** Its summary is the one reviewers read to the end, because every line is a claim and none is an argument:

```markdown
## Summary

- **Fix:** bill exception amounts show the bill's currency, e.g. `IDR 14.500.000,00`
- **Change:** the exception count is gone from the panel header

## Changes

| Area | Files | What changed |
|---|---|---|
| **Exception copy** | `utils/bill-exception-copy.ts` | Returns text and money parts |
| **Panel** | `components/bill-exceptions-panel.tsx` | Takes a currency code; restyled to Figma |

## Merge risk

⚪ Minimal: styling and one new prop, both hosts pass it.

## Test plan

- [x] Bills suite green, typecheck and lint clean
```

- `Summary`: one line per bullet, labelled `**Fix:**`, `**Feature:**` or `**Change:**`, saying what a user sees. No file names, token names or pixel values — those are the diff's job.
- `Changes`: one row per area, one sentence per row. Skip it when one file moved.
- `Merge risk`: one of `⚪ Minimal`, `🔵 Low`, `🟡 Moderate`, `🔴 High`, and one sentence naming what could break. Rate by what a user loses if it is wrong.

The sections `## Delivery` names win over this example where the two differ.
