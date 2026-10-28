# Frontend proof: steps 10 and 10b

## Step 10. Shoot and assert

Invoke the skill `## Delivery` names for screenshots, forked, so the images stay out of this context. The same run asserts computed geometry and style against the design's own numbers.

Three rules keep the assertion honest:

- **The report names its own coverage.** "Asserted vs tokens: 2 elements × {color, font-size, line-height} — 6/6 pass. Not checked: spacing, borders, radius, hover." That sentence, not "verified against the design".
- **A story with no assert spec reports `UNASSERTED`.** It is a third state beside pass and fail.
- **Assert token identity.** A browser reports a colour as `oklch(…)`, never as the hex the design names, so resolve against the token file from `## Delivery`. That proves the right token was used, which is the stronger claim anyway.

**On a `FAIL`, re-check the expectation before believing the defect.** An assertion measured against a padded cell or a bordered harness fails while the code is right.

Nothing after this step changes code, so these shots stand. Re-shoot if an earlier step is revisited: a stale image misrepresents the diff as confidently as a fresh one.

## Step 10b. Verify live

Invoke the skill `## Delivery` names for live verification, forked. It drives a flow through the running app against the real API and answers with a recording, a wire log, and a verdict per step. A clip proves the flow works end to end, so take as many as the flow needs — one recording carrying three unrelated claims is worse than three recordings.

**A claim in the body needs a line in the wire log.** That is what separates this from a demo: a reviewer checks "the app runs no capability check of its own" against a log showing the reasons came off the wire, not against footage they are asked to trust.

Two rules the report lives by:

- **A step with no expectation reports `UNOBSERVED`** — a third state beside pass and fail, for the same reason an unasserted story is.
- **The clip owns its path.** A state the recording walks through earns no separate still from step 10; a state the flow never reaches still earns one, and computed style stays step 10's job because no recording can prove it.

The artifacts go to the branch and directory `## Delivery` names, never to the PR branch: `/tz-skills:spec-review` greps the diff for an anchor per criterion, and binary evidence is noise to that pass. **A run that mutated anything says so** — the ids it created, and what was not done to them. Financial data is never deleted, only reversed, so every row a recording creates is permanent.
