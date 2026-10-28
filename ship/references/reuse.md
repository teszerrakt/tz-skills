# Reuse: widen, else ask

A duplicate shipped because its fix sat outside the ticket stays forever: a follow-up rarely gets picked up. So reuse wins over the ticket's edge whenever the other callers cannot tell.

**Widen an existing helper that nearly fits.** Add what this ticket needs as an option whose default is the current behaviour, and move the copies onto it. Every other caller keeps its behaviour, its call site, and its tests green. Editing those callers to drop a copy is part of this change.

**It is `IMPLIED`, not a stray.** `/tz-skills:spec-review` classes a widened helper with every other caller's behaviour unchanged as `IMPLIED`, so the widening cannot trip its stray `BLOCK`. Name the helper and its callers in the PR body's scope section.

**Ask when widening would change another caller's behaviour**: its output, its timing, or its errors. That trade is the user's, so it goes in the questions section, with the copy and the shared helper as the options. Under `/tz-skills:ship-epic --afk`, ask through the run's `Ask` command like any other question.

## At each step

- **Step 2.** A component the grep matches only partly is a widen, not a new file. Name the option the plan adds and its default.
- **Step 7.** A simplify finding that removes a duplicate this diff adds is never refused for scope. Apply it by widening, or ask.
