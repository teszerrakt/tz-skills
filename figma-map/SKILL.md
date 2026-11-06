---
name: figma-map
description: Turn a Figma section of flows into a published design map — pages, the components on each, their sub-components, behaviour, states and variants, cropped images, reuse badges with GitHub links, and a link back to every Figma node. Re-runs are incremental, so a design still being edited only costs what changed. Use when the user gives a figma.com section or page URL and wants it summarised, mapped, documented or turned into a design doc, or wants a map refreshed after the designer changed the file.
---

# Figma map

Reads a Figma section without dumping it into context, and publishes one design-map artifact that reads top to bottom: each page, the components on it, their sub-components, then the components several pages share. It owns the harvest, the merge of near-identical screens, the crops and the page. It does not decide API contracts, tickets or estimates. `/tz-skills:fe-design-map` owns those and can start from this map's fact base.

## Why it is shaped this way

- **Text before pictures.** A script reads each screen's text, annotations, prototype links and component variants as compact JSON, as a delta against its flow's first screen. Copy read off pixels picks up typos.
- **Small pictures, on a budget.** Layer names usually say what a box is. When a designer left them generic ("Container", every card named "Audit Trail"), one 800px screenshot per layout names the parts. Nothing else is looked at.
- **No result is typed twice.** A `use_figma` result is already in the session transcript. `scripts/save-result.ts` copies it to the fact base, so the agent never writes the JSON out again.
- **Never `get_design_context` on a whole screen.** On a full-size screen it returns only the node tree. Use it on one component's node, and only when a sub-component stays unclear.
- **Images never enter context.** A crop is `get_screenshot` on the component's own node, downloaded to disk and built into the page.
- **Shared components are named once, before the harvest.** Subagents that name them independently give one panel three names. The orchestrator names them up front and writes the Shared section alone.

## Config

Read `.claude/fe-design-map.md` in the repo root. In a git worktree that has none, read it from the main checkout: the first `worktree` line of `git worktree list --porcelain`.

- `## Sources` → the UI package path and the app-local component paths that reuse verdicts search, in that order.
- `## figma-map` → `GitHub blob base` (for example `https://github.com/<org>/<repo>/blob`) and, optionally, `Fact base root`.

A missing `## figma-map` section: detect the GitHub remote with `git remote get-url origin`, propose the section, and write it back once the user agrees. A missing file: offer `/tz-skills:setup-tz-skills`, then carry on with what the repo shows.

## Scripts

All run with Bun from this skill's base directory. Each file's header gives its full usage.

| Script | Does |
|---|---|
| `scripts/figma.ts` | Prints a Figma-side script (`inventory`, `dump`, `locate`, `candidates`) ready to paste: arguments checked, compiled to plain JS. Paste its output verbatim as `use_figma`'s `code`. `--tag <tag>` marks the call for `save-result.ts`. |
| `scripts/save-result.ts` | Copies the newest result tagged `<tag>` from the session transcript to a file. `--append-deltas` adds a dump chunk to a flow's dump. |
| `scripts/merge.ts` | Expands a flow's dump into per-screen records and layout groups, and lists screens with the same content. |
| `scripts/assemble.ts` | Joins the banner, the sections and the Shared section into `design-map.md`, renumbering every `[n]`. |
| `scripts/render.ts` | Renders `design-map.md` to the page the Artifact tool publishes. Exits 1 on any warning. |

If `save-result.ts` cannot find a result, write that one result to its file by hand and say so in the reply.

## Fact base

`~/.claude/figma-map/<repo>/<slug>/`, where `<slug>` is the section's name in kebab case:

```
meta.json             file key, section id, page id, pinned SHA, artifact URL, run dates
flows.json            inventory: flows → screens (scripts/figma/inventory.ts)
candidates.json       containers that repeat across flows (scripts/figma/candidates.ts)
shared-names.json     the orchestrator's name for each shared candidate
signatures/<flow>.json one hash per screen, for incremental runs
runs.json             one entry per run: date, changed, added, removed, tokens
raw/<flow>.json       a flow's dump, as returned
frames/<id>.json      full per-screen records, rebuilt by merge.ts
merge/<flow>.json     layout groups, their states, and same-content pairs
img/crops/*.png       crops, prefixed with the flow's slug
sections/<flow>.md    one flow's pages, in the doc shape
banner.md             the banner line; changed.md on a refresh
shared.md             the Shared components section
design-map.md         the assembled source
design-map.html       the rendered page
```

Never push it, and never name its path in the published page. Refer to it by absolute path in briefs, so any worktree can read it.

## Steps

### 1. Open the file

Parse the URL: `figma.com/design/<fileKey>/<name>?node-id=<a>-<b>` gives the file key and node `<a>:<b>` (a `/branch/<branchKey>/` URL uses the branch key). Call `create_session` and pass its id on every Figma call. If the Figma MCP is not connected, say so and stop.

Every Figma call in this skill is read-only, and every script it pastes already follows the Plugin API rules, so skip loading the Figma `figma-use` skill: it is about writing to a file. Never write to the file.

Done when the session exists and the inventory call below resolves the node.

### 2. Inventory

Run `bun scripts/figma.ts inventory --args '{"section":"<node id>"}' --tag inventory`, paste it into `use_figma`, then `bun scripts/save-result.ts --tag inventory --out <fb>/flows.json`. Write the file key, section, page and `git rev-parse origin/main` (the pinned SHA) to `meta.json`.

The inventory places each screen (a frame at least 400px tall) under the label frames drawn above it. The outermost band names the flow; the bands and labels nested under it name the page (`Bill › 1 Approver`). A label with a row of screens between it and a screen does not name that screen. Labels that read like a sentence are copy, listed in `copyLabels`, and never name anything. A screen whose `page` is null is named from its content in the harvest. Screens with no label at all are grouped by row.

If `meta.json` already lists a run, this is a **refresh**. For each flow, dump with `"sigOnly": true` and tag `sig-<flow>`, save it to `<fb>/sigs-<flow>.json`, then run `bun scripts/merge.ts --changed <fb> <flow> <fb>/sigs-<flow>.json`. A flow with no changed, added or removed screen is skipped in step 5.

Done when `flows.json` lists every screen in the section, each under one flow.

### 3. Pick the flows

Close the reply with a questions section: the flows as a numbered list with their screen count and a cost estimate (about 4k tokens per screen, plus about 1k per crop), and the question of which to run. On a refresh, list only the flows that changed, with what changed. Recommend all flows when the total is under about 60 screens, otherwise the flows a named ticket or the user's message points at.

The questions section is the one shape for asking: its own section at the end of the reply under a `❓` heading, one block per question. A block is the question in under 15 words, one option per bullet (the choice in bold, then what the reader would see), a `✨` line recommending one, and one `Asked because:` line. Nothing follows it.

Done when the user has answered. Do not start step 4 before.

### 4. Name the shared components

Run `candidates` over every chosen screen (`--args '{"screens":[{"id":"…","flow":"<slug>"}, …]}' --tag candidates`) and save it to `<fb>/candidates.json`. Each candidate is a container whose name and children's names repeat, in order, across two or more flows.

For each candidate, decide whether the same code component would render it on every page it appears on. Name the ones that are, from their layer names, or, when those are generic, from one `get_screenshot` of one of its nodes at `maxDimension: 800`. Design-system primitives (Button, Badge, Tabs, Input, Avatar) are never shared entries. Write `shared-names.json`: one `{ name, signature, nodes }` per shared component. Its anchor is the name in kebab case (`Approval Gate card` → `#approval-gate-card`).

Done when every candidate is named or dropped.

### 5. Harvest

Dispatch subagents in parallel, each with flows totalling about 20 screens. A flow is never split; a flow over about 30 screens gets a subagent of its own. Each brief holds: this skill's base directory, the file key, the session id, the fact base path, its flows from `flows.json` (slugs, screen ids, page labels), the repo's component paths from config, the pinned SHA, and [references/harvest.md](references/harvest.md) and [references/doc-shape.md](references/doc-shape.md) by absolute path. Nothing else: the conversation is not a brief. `shared-names.json` is in the fact base.

Each subagent writes only its own flows' `raw/`, `frames/`, `merge/`, `signatures/`, `img/crops/` and `sections/` files, and returns what harvest.md asks for.

On a refresh, a subagent gets only the changed flows, the changed screen ids, and the flow's previous `sections/<flow>.md` to edit in place.

Done when every chosen flow has a `sections/<flow>.md` and `merge.ts` printed its layout count.

### 6. Shared components

One writer, you, writes `shared.md` from `shared-names.json` and the subagents' reports: one `##` per shared component under `# Shared components`, its badge, reuse link, crop, behaviour and its variants table. Variants are listed only here; page entries name the variant they use and show its crop.

Where two flows' sections describe a shared component differently, re-read both flows' frame records and settle it. Write one verdict, and edit the losing section to match.

Done when no component has a variants table in two places, and every page link to `#<anchor>` has a heading.

### 7. Assemble and render

Write `banner.md` (the banner line from [references/doc-shape.md](references/doc-shape.md)) and, on a refresh, `changed.md`. Then:

```bash
bun <base>/scripts/assemble.ts <fb>
bun <base>/scripts/render.ts <fb> <fb>/design-map.md <fb>/design-map.html --file <file key> --gh <GitHub blob base>/<pinned SHA> --inline --title "<section name> Design Map"
```

Append the run to `runs.json`, with the tokens the harvest subagents reported.

Done when both print no problem or warning. Render warns on an `[n]` with no Sources line, a crop missing from disk, and a link to an anchor no heading has. Its page holds at phone width by construction: tables scroll in their own box and four-column tables fold to two.

### 8. Check

- Every GitHub link resolves: `git cat-file -e <SHA>:<path>` for each linked path.
- Every crop is a non-empty PNG (`file img/crops/*.png`).
- Every `{node}` heading marker points at a node id in a frame record, `candidates.json`, or a `locate` result the subagent reported.

Done when all three pass, or the reply names the one that could not run and why.

### 9. Publish

Read [references/publish.md](references/publish.md) and follow it.

Done when the user has the artifact link, or the rendered page.

## Reply

Close with: the artifact link, screens → pages → states, the crops written, the design issues the harvest found (typos, duplicate frames, inconsistent copy or formats) as one bullet each, and what the run cost against the step 3 estimate. Anything that needs the user goes in a questions section at the very end.

## Aborts

- No Figma MCP, or the node does not resolve: say which, and stop.
- A `use_figma` call errors twice on the same script: stop that flow, report the error, and carry on with the others.
- A crop download returns an empty file outside the sandbox too: keep the `[n]` link, skip the image, and say so.
