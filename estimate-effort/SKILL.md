---
name: estimate-effort
description: Estimate AI-assisted implementation effort in MD (man-days) for frontend tickets, calibrated against this repo's own delivery history (per-ticket estimated vs actual, PR diffs, diagnosed bloat causes). Use when sizing tickets or tasks, during the estimates pass of a design-doc or ticket-breakdown skill, or when the user asks how long a ticket or feature will take.
---

# Estimate Effort

Units: MD (man-days), AI-assisted, including PR, review fixes, and self-test. Quantize to 0.25.

**Ticket = floor + one step per real driver.** The floor is the cold start: the price of a ticket with no drivers at all. Cost does not track diff size or acceptance-criterion count.

## Calibration

Read `.claude/estimate-calibration.md` in the repo root. It holds this codebase's own estimated-versus-actual table, the floor and step size the actuals support, and the diagnosed cause per miss.

If the file does not exist, estimate with the model below, use 0.25 for both the floor and the step, and **label the estimates uncalibrated**. Then offer to start the file from the repo's merged PRs and closed tickets. An estimate calibrated on another codebase's history is a guess wearing a number.

## Drivers — the only things that move a ticket off the floor

1. A first-build state machine that needs design decisions. **Not** a reducer or hook that follows an existing pattern, even the first one.
2. Two deliverables that would each stand alone as a ticket.
3. An integration unknown still open at estimate time — a contract not live-verified, or an open question the frontend must absorb. It costs nothing once resolved.

## Non-drivers — never price these

- Acceptance-criterion, rule, or edge-case count. Each is one pure branch or predicate, plus its test.
- Surface count, component count, diff volume. Tests and i18n are roughly half of every diff and are near-free.
- "No in-repo precedent, sets the pattern" when the artifact is a pure function or a documented library API.
- Risk notes and contingency. A flagged risk historically resolves before coding or gets absorbed elsewhere.
- Deferral caveats. A deferral removes scope, so it deflates the estimate.
- Visual states from the design. Those are CSS.

These are the usual causes of a 2x to 5x overestimate.

## Force the floor when

- The ticket says it reuses, clones, or extends something that already landed.
- It is the Nth ticket on a surface whose state machinery already shipped. That is a stamp: one hook, one component, i18n, tests.
- The ticket already names the files and the state location, so only the typing remains.

## Re-estimate when

Scope changes and stale numbers are half of all bloat. Re-cut when a scope note rewrites the ticket, the backend merges or changes endpoints, a contract gets live-verified, or an open question resolves.

## Sanity checks

- An estimate above the floor must name its driver.
- An estimate above 1 MD means the slice is too big. Recommend a split rather than publish a big number.
- A feature total is the sum of its tickets, with no feature-level buffer. Serial delivery compresses overhead.
- Flag an estimated but unstarted ticket as schedule risk. Do not pad estimates to cover it.

## Output

Per ticket: `<estimate> MD` plus one line naming the driver, or `floor` plus the reason — stamp, read-only, or pre-solved. Then the feature total.

## Maintenance

When an actual lands, append it and the diagnosed cause to `.claude/estimate-calibration.md`. Revise a driver only when it stops predicting, or when a new one recurs.
