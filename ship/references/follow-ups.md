# Step 11b: follow-ups

Not admitted, however true: refactors ("move X into a module", "one path for Y"), missing or weak tests for code that works, "a future change could break this", cosmetic nits the design already accepted, and anything the ticket or the user already ruled on. These get at most one line in the PR body under `Considered, not proposed`, with no fields and never in the run report's follow-ups. A measured run proposed 16 follow-ups; the user judged 2 real and the rest noise, and the noise cost more reading than the two were worth.

A follow-up written as prose cannot be triaged. The reader's questions are always the same five, and a line that answers none of them gets re-derived by hand or dropped: **is this mine, how bad, why does it exist, what breaks if it never ships, and what would it cost.**

So each one carries an index row and five fields, on their own lines:

| Field | Holds |
|---|---|
| Surface | `FE`, `BE`, or `BE→FE` — which half owns the fix |
| Severity | `High`, `Med`, `Low` — by what a user loses, not by how ugly the code is |
| Why it exists | the condition that produced it, in plain words |
| If it never ships | the consequence, concretely. No consequence means no follow-up |
| Effort | an `/tz-skills:estimate-effort` figure **and the one-line reason** |
| Anchor | `file:line` proving the claim |

**The anchor is not decoration — it is the check on your own summary.** Two claims in a measured run ("three copies", "seven callers") were plausible, survived drafting, and died to a grep. Write the anchor by looking, not by recalling.

**Plain words in the description, exact terms in the anchor.** A reader deciding whether to take a ticket is not yet reading the code.

**Then say what merges.** Follow-ups from one ticket usually are not independent: one often dissolves another. Name the merge, give the combined estimate against the separate ones, and name the cost of merging — a high-severity item folded into a refactor ships later than it would alone. Five follow-ups that are really three tickets should say so; that is the judgment the list exists to support.

**Where each copy lives.** The PR body carries the index table and one line per item, because a reviewer scans. The full five fields go in the run report, which has no word budget and is what `/mattpocock-skills:to-tickets` reads. Never the tracker — posting there unprompted is refused by the user's own standing preference.
