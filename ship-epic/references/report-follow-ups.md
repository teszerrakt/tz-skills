# The report: follow-ups

**Filter before you gather.** Carry only follow-ups that pass `/tz-skills:ship` 11b's admission bar: a problem a user can notice today, or a known unfixed bug, named in one sentence. Drop refactors, coverage gaps for working code, "a future change could break this", accepted cosmetic nits, and orchestrator-review notes that were verified as not defects — even when a session listed them. Aim for zero to five per run, ranked by what a user loses. A measured run carried 16 and the user kept 2; the other 14 were noise that buried them.

**Say it is a proposal.** End the section with one line: the list is for the user to grill, not to hand to `to-tickets` as is. Never suggest running `to-tickets` on the list before the user has ruled on each item.

**Carry every field, not the one-line summary.** `/tz-skills:ship` step 11b fixes the shape — surface, severity, why it exists, what breaks if it never ships, effort with its reason, and a `file:line` anchor. The PR body holds the short form because a reviewer scans; this report is the long form, and it is what `/mattpocock-skills:to-tickets` reads. A report that copies the PR's one-liners throws away the half that makes a follow-up rulable.

**Re-check the anchors before writing them down.** A session's own summary of its follow-ups is the least verified prose it produced — it is written last, after the gates, and nothing audits it. Counts and file references stated there have been wrong in a measured run. Grep each one.

**Merge across tickets, not just within one.** A session sees only its own diff, so it cannot notice that two tickets raised the same follow-up, or that one ticket's refactor dissolves another's bug. That judgment exists only here. Merging never promotes an item: two refactor notes merged are still a refactor note, and still dropped.
