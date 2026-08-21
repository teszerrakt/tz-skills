# Template: `.claude/fe-design-map.md`

Read by `fe-design-map`. Nine sections. The tag on each says where the value comes from.

**[detect]** — exploration already found it. Propose it; do not ask.
**[ask]** — no file states it. Ask.

Drop a section the repo has no use for. A frontend-only repo needs no `Sources` entry for a backend permissions file.

---

```markdown
# fe-design-map project config ({{REPO}})

Consumed by the `/fe-design-map` skill. Per-developer config, not tracked.

## Docs

- Platform: {{docs platform, and the MCP that reaches it}}          [ask]
- Home doc: {{uri}} ({{link}})                                        [ask]
- Reference doc (format exemplar): {{link}}                          [ask]

## API

- Staging base URL: {{url}}                                         [ask]
- App API prefix: {{pattern}} (auth: {{scheme}}, audience {{aud}})       [detect from the API code or docs]
- Response envelope: {{shape}}                                      [detect from the API code or docs]
- Token: {{command}} mints a staging token. Fall back to a paste from devtools only if that fails.   [detect a Makefile target or a package script]

## Sources

- Permissions matrix: {{path}}                                      [detect]
- Endpoint contracts: {{path}} (source of truth over code comments) [detect docs/rfc]
- FE conventions: {{path}}                                          [detect docs/adr]
- UI package for reuse verdicts: {{path}}, then app-local components under {{path}}   [detect]

## Figma

- FE workspace file: {{file key}} ({{file name}})                     [ask]

## Tracker

- {{tracker}}, team prefix {{PREFIX}}; ticket URL base {{url}}          [ask]
- Breakdown into tickets; label {{label}}; estimates in MD          [ask]

## Postman

- Workspace: {{workspace, or "ask per run"}}                        [ask]

## Doc authoring preferences

One bullet per rule the published doc must follow. These are the rules a reviewer keeps
repeating. Start with the two that apply to every repo, then add the user's own:

- Bullets over packed prose: any multi-clause rule becomes a bullet list, one fact per bullet.
- Never reference a local path (`.scratch/`, `~/.claude/fe-design-map/`, a machine dir) in the
  published doc. Link the repo file on {{remote}} and inline the relevant differences instead.

## PRD

- Platform: {{platform}}                                            [ask]
- The PRD link is given per run. It is **not** the target doc the design doc is written into.
- Harvested PRD facts land in the fact base as `prd.md`, one bullet per requirement, each
  carrying its source anchor.

## Wayfinder

Names the tracker conventions for the map. `fe-design-map` reads this to create its tickets.

- **Map**: an issue in {{team}}, labelled `wayfinder:map`, inside its own project    [ask]
- **Map ticket**: a child issue of the map, labelled `wayfinder:<type>`, title prefixed with the
  type emoji (🧭 map, 🔍 research, 🔥 grilling, 🧪 prototype, 🔧 task)
- **Build ticket**: an issue in {{team}}, label {{label}}; one gated by an open question also carries
  `needs-info`                                                                    [ask]
- **Blocking**: {{how this tracker records a blocking relation}}                    [ask]
- **Fact base**: `~/.claude/fe-design-map/{{repo}}/<slug>/` — never pushed to a remote, deleted by
  `/fe-design-cleanup` once the build tickets close
- Refer to a map or a ticket by its title, never by its id
```

## Fallback name

An older install of this pipeline wrote this config as `.claude/fe-design-doc.md`. If that file
exists and `fe-design-map.md` does not, offer to rename it and to move its ignore line. Keep the
old file only while the retired `/fe-design-doc` skill still reads it.
