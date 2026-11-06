# Harvest one or more flows

Read by the subagent that harvests flows. You write only your own flows' files. Every Figma call is read-only: do not load the Figma `figma-use` skill, since the scripts you paste already follow its rules.

Scripts run with Bun from the skill's base directory; `<fb>` is the fact base.

## Never type a result twice

Every Figma-side script comes from `bun scripts/figma.ts <script> --args '<json>' --tag <tag>`. Paste its output, unchanged, as `use_figma`'s `code`. Then save the result with `bun scripts/save-result.ts --tag <tag> --out <file>`, which copies it from your transcript. Do not repeat a result in a Write call. Only when `save-result.ts` reports it cannot find the result, write that one result by hand and say so in your report.

## Per flow

1. **Dump.** In chunks of at most 8 screen ids, each with the flow's first screen as `base`: `bun scripts/figma.ts dump --args '{"ids":[…],"base":"<first screen id>"}' --tag dump-<flow>-<n>`. Save each chunk with `bun scripts/save-result.ts --tag dump-<flow>-<n> --out <fb>/raw/<flow>.json --append-deltas`.
2. **Merge.** Run `bun scripts/merge.ts <fb> <flow>`. It writes `frames/<id>.json`, `merge/<flow>.json` and `signatures/<flow>.json`, and prints the layout count. When it lists screens with the same content, call `get_screenshot` on both at `maxDimension: 800` and record the visual difference (a selected row, an error border, an open dropdown) as that state's line. If there is none, it is a duplicate frame: a design issue.
3. **Read the records.** Use `frames/*.json` and `merge/<flow>.json`, never the raw dump again. Group the flow's screens into pages by their `page` label; a screen with no label joins the page its content belongs to, or names a new one from its content. A layout group's first screen's outline is the component tree; each other screen is a state or a variant row.
4. **Name the parts.** Layer names say what a container is. When fewer than half of a layout's containers have real names (most are "Container", "Frame 12", or every card has the same name), call `get_screenshot` on the layout's first screen at `maxDimension: 800` and look at it once. That is the only screenshot a layout gets, besides step 2's pairs. A container listed in `<fb>/shared-names.json` takes that name.
5. **Locate.** A record whose `outlineFrom` is another screen carries that screen's node ids. To link or crop a node inside it, run `locate` with `{ base, nodes, targets }`, batching every node you need for the flow in one call. A `null` means no node matched by path or by a unique name: crop from the base screen's node instead.
6. **Crop.** One crop per component entry, cut from the smallest node that holds the whole component. States and variants get one each only when they look different, not when only the text changes. Primitives (Button, Badge, Tabs, Avatar) get none. A shared component used on a page gets the crop of the variant that page shows. For each node, call `get_screenshot` with `{ nodeId, maxDimension: 1440, contentsOnly: true }` and curl its `image_url` to `img/crops/<flow>-<slug>.png`. The flow prefix keeps parallel harvesters' files apart.
   - The curl must run with Bash `dangerouslyDisableSandbox: true`. Inside the sandbox, Figma's CDN answers with an empty HTTP 202.
   - Check each file with `file`. Never Read a crop.
   - Do not use `download_assets`: it lists up to 20 SVG URLs per call, 1–2k tokens you never use.
7. **Reuse verdicts.** For each component, search the repo's UI package, then the app-local component paths, by name and by role (a Figma "Data table" → the table components, "Drawer" → sheet/drawer, "Select" → combobox/select, "Status" → badge). Open the file before you claim 🟢 reuse. 🟡 extend means it exists but needs a prop or a variant; 🔴 new means nothing fits. Give the reason in one clause. Link the file as `GH/<path>`, which the renderer pins to the SHA. Shared components get their verdict from the orchestrator, not from you.
8. **Write `sections/<flow>.md`** in the shape [doc-shape.md](doc-shape.md) gives, with its own `## Sources` block numbered from 1. Write pages only: no banner and no `# Shared components` block. The assembler renumbers.

## What to report back

At most 20 lines, per flow: screens → layouts → states; the crops written (slug, node id, size); every shared component you used and the variant each page shows, plus any container you think is shared but is not in `shared-names.json`; the reuse verdicts you were unsure of; design issues (typos, duplicate frames, inconsistent copy or formats); the screenshots you took; tool errors; your token total.

## Known traps

- **The text is deduped per screen.** A name repeated in a list (three approver cards) appears once. Count rows from the outline or the instances, not from `texts`.
- **Annotated layers are often hidden.** `dump` reads annotations before the visibility cut and names the visible container they sit in (`within`). Attach the annotation to that container.
- **An annotation inside an instance** points at a layer id that starts with `I`, and its `within` may too. Link the outermost instance that holds it.
- **Prototype links are optional.** Most files have few or none. Write navigation only where a link or an annotation states it. A link with no destination (`to: null`) or a missing one is not a design issue.
