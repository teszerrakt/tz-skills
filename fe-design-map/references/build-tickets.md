# Build-ticket breakdown

Break the approved doc into build tickets, each one a vertical slice: a narrow but complete path through every layer, demoable on its own.

Then merge. A default breakdown produces slices smaller than a session, and every session pays a **cold start** — the warm-up in which it rediscovers the route, the endpoint, and the component family before it writes a line. The floor in `estimate-effort` is that cold start: 0.25 MD, the price of a ticket that has no drivers at all. Three floor-only tickets cost 0.75 MD. Merged into one they cost about 0.5 MD.

## Estimate first

Run `estimate-effort` **before** the tickets are published, not after. An estimate produced after the split cannot inform the split. The estimate is the merge input.

## Merge on shared context

Merge two slices only when they share their warm-up:

- the same route or screen,
- the same endpoint set,
- or the same component family.

Stop merging when either limit hits:

1. the merged ticket reaches **0.5 MD**, or
2. the next merge would pull in a context set the ticket does not already need.

Never merge two slices that each already carry a driver.

The second limit is the one that keeps this honest. Merging two unrelated slices saves one cold start but loads two context sets into one session, and a session's accuracy falls with the share of its context that is irrelevant to the work in front of it. Shared context saves the warm-up **and** keeps the session dense. Unshared context buys the first and pays for it with the second.

**Set no token cap and no context-window budget.** Pricing is flat across the full 1M window, and the measured effect tracks relevance density rather than length. Merge on shared context, not on token count.

## Wide refactors

One mechanical change whose blast radius fans across the codebase does not fit a vertical slice. Sequence it expand–contract: add the new form beside the old, migrate the call sites in batches sized by blast radius, then delete the old form in a ticket blocked by every batch. Each batch keeps CI green because the old form still exists.

## Publish

Publish in dependency order so each ticket's blocking edges can name real ids. Use the tracker's native blocking relation. Apply the project's agent-ready label.

A build ticket gated by an unresolved `OQ` gets the `needs-info` label and one line naming the `OQ` and its owner. No ticket is created **for** the question — the block is an attribute of the ticket that already exists.

Then update the doc's Related Tickets section: the parent link, the per-ticket links, each estimate, and the total. Write the same ticket ids into the fact base's `meta.json`, because `fe-design-cleanup` reads them to decide when the fact base can go.
