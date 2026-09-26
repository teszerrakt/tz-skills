---
name: fe-design-map
description: Chart a frontend design doc as a bounded seven-ticket map on Linear, then work the tickets across sessions. Harvests run AFK against a gate ledger.
disable-model-invocation: true
---

# FE Design Map

Chart a frontend design doc as a **closed** map of tickets on Linear, then work them across sessions. The harvests run AFK and prove their output against a **ledger**. The decisions stay with the user.

This is wayfinder's shape with three rules changed:

- The ticket set is **closed**. New questions never become new tickets.
- A session **can** resolve several tickets.
- Harvest output is **proved**, not promised.

## Vocabulary

**Map ticket** — a child issue of the map that resolves one decision or one harvest.
**Build ticket** — an issue that one coding session implements.
**Fact base** — the machine-local directory that holds every harvested fact.

The tracker teams for each are domain config, not skill content. Read them from the project config.

## Config

Read `.claude/fe-design-map.md` in the repo root. It holds the docs platform and home doc, the API base URL, the permissions source, the Figma workspace file, the PRD home, the tracker teams, and the doc authoring preferences. If a section is missing, ask, then offer to write it back — or run `/setup-tz-skills`, which writes the whole file.

An older install wrote this config as `.claude/fe-design-doc.md`. If that name exists and `fe-design-map.md` does not, read it and offer to rename it.

## External skills

Two skills this one runs come from the [mattpocock skills](https://github.com/mattpocock/skills) plugin. A plugin skill's id is **plugin-qualified**, so a bare name never resolves:

- `mattpocock-skills:grilling`
- `mattpocock-skills:domain-modeling`

**Check the available-skills list for the exact id before you invoke one.** The plugin name is part of the id and can differ per install, so match what the list shows rather than the ids written above.

If neither is listed, the plugin is not installed. Say so once, point the user at https://github.com/mattpocock/skills, and carry on without it — interview the user directly instead of stopping. A missing plugin degrades this skill; it does not block it.

## Fact base

```
$HOME/.claude/fe-design-map/<repo>/<slug>/
├── meta.json          map issue id, doc URL, build ticket ids
├── gates/             one ledger per gated ticket
├── frames/            one file per Figma frame
├── img/               PNG exports
├── api/               one file per endpoint
├── prd.md
├── capabilities.md   one row per endpoint, keyed by capability
├── figma-styles.md
└── design-doc.md
```

Access is keyed by **capability, never role**. A role is only a default bundle of capabilities that an entity can regrant, so a role name is seed data: list it only to pick test users.

Never push any of it to a remote. It is throwaway, and it is deleted by `fe-design-cleanup` once the build tickets close. Reference it by absolute path so any worktree can read it. Never name this path in a published doc, a commit message, or a code comment.

## The closed ticket set

Seven tickets, never more. Four are mandatory.

| # | Ticket | Mode | Status | Created when |
|---|---|---|---|---|
| 1 | 🔍 Figma harvest | AFK | mandatory | always |
| 2 | 🔍 PRD harvest | AFK | optional | the user gives a PRD doc link |
| 3 | 🔍 API and permissions harvest | AFK | optional | the feature touches an endpoint |
| 4 | 🔧 Live capture | AFK | optional | an endpoint has no saved example |
| 5 | 🔥 Synthesis grilling | with the user | mandatory | always |
| 6 | 🔧 Draft and publish | with the user | mandatory | always |
| 7 | 🔧 Build-ticket breakdown | with the user | mandatory | always |

Blocking edges: 4 waits on 3. 5 waits on 1, 2, 3, 4. 6 waits on 5. 7 waits on 6.

Capture runs before grilling for two reasons. It needs no human once its limits are set, so it belongs with the other AFK tickets. And a grilling seeded with live responses settles questions a derived sample would have left open, or opened falsely: a gap the code reading predicted turns out confirmed, sharper, or wrong.

A new question found while a ticket runs becomes `OQ-n` in the doc. It never becomes a ticket on this map.

## Mode: chart

The user gives a feature and a Figma summary page URL.

1. **Name the destination.** One or two lines: which page or feature this doc specs. Run the grilling skill only if the scope is unclear.
2. **Confirm the frames.** `get_metadata` on the Figma page, list the top-level frames, then `AskUserQuestion` (multiSelect) to confirm which belong to this feature. This step must happen here, with the user present — the confirmed **count** is what makes the harvest gates countable.
3. **Ask for the optional inputs**: PRD doc link, Postman collection, target doc URL, parent build ticket.

   When ticket 4 will exist, also settle its **capture limits** here, in one question: the staging entity, the logins by the capabilities they hold, and whether undeletable leftovers are acceptable (a record that reached an approved or active state often cannot be deleted). This answer is the capture playbook's one approval, given up front, so the capture can run with no one watching. Pick the entity every login shares before you ask.
4. **Create the fact base** and write `meta.json`.
5. **Write the gate ledgers** for tickets 1, 2, 3, 4, and 6, before any harvest runs, then **dry-run every one** (`gate-check.mjs --dry`) and confirm each gate fails on the empty fact base. A gate that already passes proves nothing later. Read [references/gates.md](references/gates.md).
6. **Create the map** and its tickets on the tracker, then wire the blocking edges in a second pass.
7. **Fire the harvests.** Dispatch **one subagent per created harvest ticket**, in parallel. Each subagent gets the ticket body, the fact base path, and its ledger path — nothing else.

   Splitting a harvest finer than its ticket — one agent per frame, per endpoint — buys speed and costs consistency, and the trade is worse than it looks. Independent writers contradict each other reliably: they hand each other wrong facts, and repairing a file leaves every sibling still citing the disproved claim, so one round of fixes produces about as many contradictions as it closes. The gates do not catch this, because each file passes on its own.

   If you split anyway, the split is not finished until a **single writer** has reconciled it: one agent, resolving every disputed claim to one verdict re-derived from source, writing that to `_canon.md`, and only then a pass that makes each file agree. Budget for that pass up front — it is not optional cleanup.
8. **Fire the capture when its input exists.** Ticket 4 reads ticket 3's `api/live-capture.md` work list, so it cannot start with the harvests. Once ticket 3's ledger passes on your own re-run, dispatch **one** capture subagent with the ticket body, the fact base path, its ledger path and the capture limits. One writer covers every endpoint: a capture walks one fixture through many endpoints, so splitting it has the same contradiction cost as splitting a harvest. Sibling maps that share an entity and a fixture cycle can share one capture run, with that one agent writing each fact base.
9. **Stop.** Charting resolves no decision.

## Mode: work

The user gives a map, and optionally a ticket.

1. Load the map body. Do not fetch every ticket.
2. Choose the ticket: the one named, or the first on the frontier. Assign it to the user's tracker account before any work.
3. **Re-run the ledger of every closed harvest this ticket depends on** before trusting its facts: `node ~/.claude/skills/fe-design-map/scripts/gate-check.mjs <ledger>`. A gate that now fails means the harvest is unmet, whatever its comment says.
4. Resolve the ticket. Read the reference the ticket names.
5. Post the resolution as a comment, close the ticket, and add one line to the map's Decisions-so-far.
6. Continue to the next ticket in the same session when it is sequential and cheap. Tickets 6 and 7 are one sitting.

## Ticket work

**Tickets 1 to 3 — harvest (AFK).** Read [references/gates.md](references/gates.md). Write facts to the fact base, run the ledger, and paste it into the resolution comment with the command output as evidence.

**Ticket 4 — live capture (AFK).** Read [references/capture-playbook.md](references/capture-playbook.md). The agent works inside the capture limits set at chart time and never widens them. A surprise it cannot place inside those limits stops the run: it reports what it created and cleaned and hands back, since no one is there to ask. The ticket closes when ledger 04 passes and ticket 3's ledger still passes.

**Ticket 5 — synthesis grilling.** Run the grilling and domain-modeling skills (see [External skills](#external-skills)), seeded with the harvested facts and the live captures. Classify every answer: a resolved decision goes into the doc as behavior, an unknown becomes `OQ-n` with an owner, a missing endpoint becomes `G-n`. Then present the open-question table — one row per `OQ`, marked `decide`, `ask open`, or `ask with default`. `ask open` is the default mark. Rows marked to ask go to `/ask-stakeholders` as one batch.

**Ticket 6 — draft and publish.** Read [references/template.md](references/template.md). Draft in the fact base; the author reads it in the [review artifact](#review-artifact), frame renders included, and iterates there until they approve. Run the ledger before you publish. Publish only after approval. More than three blocking `OQ`s means the doc is not ready — say so and stop.

Two rules the template carries and this step keeps getting wrong. **The doc has a word budget** — 5,000-8,000 — and a first draft over it is the fact base restated, not a longer spec. And **attaching the frame renders takes four calls, three of which succeed on their own**, so a `200` on the upload proves nothing and neither does the block count: attach one image, have the author confirm it renders, then do the rest.

**Ticket 7 — build-ticket breakdown.** Read [references/build-tickets.md](references/build-tickets.md). Put the draft breakdown — every ticket's title, body, blockers and estimate — in a [review artifact](#review-artifact) and get the author's approval there before anything reaches the tracker.

## Review artifact

A draft the author must approve — the doc at ticket 6, the breakdown at ticket 7 — is shown as an artifact, not pasted into the terminal.

1. `Artifact` with `action: "quickstart"`, `intent: "document"`. It names the Docs type.
2. Create from that type (`type_url`, a `title`, no files), then fill it through the Claude Docs connector the create result names. The fact-base draft stays the source; the artifact is its view.
3. Embed each frame render from `img/` under the section it illustrates: upload it to the doc's link (`Artifact`, `asset: true`), record it as a blob in the doc, then cite `![alt](blob/<id>)` in that section's markdown. The connector's `topic.uploads` guide has the calls. The author confirming one render shows is the only proof the upload worked.
4. Apply the author's edits to the fact-base draft first, then mirror them into the artifact.

The artifact is private review space. The published doc still goes to the docs platform in the config, and the tickets to the tracker, only after approval. When no Docs type or connector is available, fall back to an HTML artifact built from the same draft.
