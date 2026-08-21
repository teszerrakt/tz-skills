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

Read `.claude/fe-design-doc.md` in the repo root. It holds the docs platform and home doc, the API base URL, the permissions source, the Figma workspace file, the PRD home, the tracker teams, and the doc authoring preferences. If a section is missing, ask, then offer to write it back.

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
├── roles.md
├── figma-styles.md
└── design-doc.md
```

Never push any of it to a remote. It is throwaway, and it is deleted by `fe-design-cleanup` once the build tickets close. Reference it by absolute path so any worktree can read it. Never name this path in a published doc, a commit message, or a code comment.

## The closed ticket set

Seven tickets, never more. Four are mandatory.

| # | Ticket | Mode | Status | Created when |
|---|---|---|---|---|
| 1 | 🔍 Figma harvest | AFK | mandatory | always |
| 2 | 🔍 PRD harvest | AFK | optional | the user gives a PRD doc link |
| 3 | 🔍 API and permissions harvest | AFK | optional | the feature touches an endpoint |
| 4 | 🔥 Synthesis grilling | with the user | mandatory | always |
| 5 | 🔧 Live capture | with the user | optional | an endpoint has no saved example |
| 6 | 🔧 Draft and publish | with the user | mandatory | always |
| 7 | 🔧 Build-ticket breakdown | with the user | mandatory | always |

Blocking edges: 4 waits on 1, 2, 3. 5 waits on 3. 6 waits on 4, 5. 7 waits on 6.

A new question found while a ticket runs becomes `OQ-n` in the doc. It never becomes a ticket on this map.

## Mode: chart

The user gives a feature and a Figma summary page URL.

1. **Name the destination.** One or two lines: which page or feature this doc specs. Run the grilling skill only if the scope is unclear.
2. **Confirm the frames.** `get_metadata` on the Figma page, list the top-level frames, then `AskUserQuestion` (multiSelect) to confirm which belong to this feature. This step must happen here, with the user present — the confirmed **count** is what makes the harvest gates countable.
3. **Ask for the optional inputs**: PRD doc link, Postman collection, target doc URL, parent build ticket.
4. **Create the fact base** and write `meta.json`.
5. **Write the gate ledgers** for tickets 1, 2, 3, and 6, before any harvest runs. Read [references/gates.md](references/gates.md).
6. **Create the map** and its tickets on the tracker, then wire the blocking edges in a second pass.
7. **Fire the harvests.** Dispatch one subagent per created harvest ticket, in parallel. Each subagent gets the ticket body, the fact base path, and its ledger path — nothing else.
8. **Stop.** Charting resolves no decision.

## Mode: work

The user gives a map, and optionally a ticket.

1. Load the map body. Do not fetch every ticket.
2. Choose the ticket: the one named, or the first on the frontier. Assign it to the user's tracker account before any work.
3. **Re-run the ledger of every closed harvest this ticket depends on** before trusting its facts: `node ~/.claude/skills/fe-design-map/scripts/gate-check.mjs <ledger>`. A gate that now fails means the harvest is unmet, whatever its comment says.
4. Resolve the ticket. Read the reference the ticket names.
5. Post the resolution as a comment, close the ticket, and add one line to the map's Decisions-so-far.
6. Continue to the next ticket in the same session when it is sequential and cheap. Tickets 5, 6, and 7 are one sitting.

## Ticket work

**Tickets 1 to 3 — harvest (AFK).** Read [references/gates.md](references/gates.md). Write facts to the fact base, run the ledger, and paste it into the resolution comment with the command output as evidence.

**Ticket 4 — synthesis grilling.** Run the grilling and domain-modeling skills (see [External skills](#external-skills)), seeded with the harvested facts. Classify every answer: a resolved decision goes into the doc as behavior, an unknown becomes `OQ-n` with an owner, a missing endpoint becomes `G-n`. Then present the open-question table — one row per `OQ`, marked `decide`, `ask open`, or `ask with default`. `ask open` is the default mark. Rows marked to ask go to `/ask-stakeholders` as one batch.

**Ticket 5 — live capture.** Read [references/capture-playbook.md](references/capture-playbook.md).

**Ticket 6 — draft and publish.** Read [references/template.md](references/template.md). Iterate in the fact base until the user approves. Run the ledger before you publish. Publish only after approval. More than three blocking `OQ`s means the doc is not ready — say so and stop.

**Ticket 7 — build-ticket breakdown.** Read [references/build-tickets.md](references/build-tickets.md).
