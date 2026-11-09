# Harvest one or more flows

Read by the `tz-skills:figma-map-harvester` subagent. You write only your own flows' files. Every Figma call is read-only: do not load the Figma `figma-use` skill, since the scripts you paste already follow its rules.

Scripts run with Bun from the skill's base directory; `<fb>` is the fact base. Every command you need is on this page: do not read the scripts' source, and do not render your section, since the orchestrator renders the whole map.

## Never type a result twice

Every Figma-side script comes from `bun scripts/figma.ts`. Paste its output, unchanged, as `use_figma`'s `code`. Its result is already in your transcript, so a script copies it out: `save-result.ts` for a `use_figma` result, `shots.ts` for a `get_screenshot` image. Do not repeat a result in a Write call, and do not retype an image URL. Only when a script reports it cannot find a result, write that one result by hand and say so in your report.

## Steps

All your flows go through each step together.

1. **Dump.** `bun scripts/figma.ts dump --fb <fb> --flows <slug>,<slug> --part 1` prints the first call. Paste it as `use_figma`'s `code`. Its second line names the number of parts and the command that saves the result, `bun scripts/save-result.ts --tag <tag> --dump <fb>`. Run that, then print and paste `--part 2`, and so on.
2. **Merge.** `bun scripts/merge.ts <fb> <slug> <slug>` prints each flow's digest and saves it as `merge/<flow>.md`. Per layout: its first screen's page label, its outline with node ids and the shared components named, its texts, instances, annotations and prototype links; then every other screen of the layout as a difference. The digest is your record of the flow. Do not open `raw/`, `frames/` or `merge/*.json`, and do not re-read the dump results.
3. **Same content.** For each pair the digest lists under "same content, compare their images", call `get_screenshot` on both at `maxDimension: 800`, save them with `shots.ts` (step 6) into your scratchpad, and Read both. Record the visual difference (a selected row, an error border, an open dropdown) as that state's line. If there is none, it is a duplicate frame: a design issue.
4. **Pages and parts.** Group the screens into pages by their page label; a screen with no label joins the page its content belongs to, or names a new one from its content. A layout's outline is its component tree; each other screen is a state or a variant row. A container marked `= <name> (shared)` takes that name. When fewer than half of a layout's containers have real names (most are "Container", "Frame 12", or every card has the same name), look at one `get_screenshot` of the layout's first screen at `maxDimension: 800`, saved and Read like step 3. That is the only picture a layout gets, besides step 3's pairs.
5. **Locate.** A layout whose node ids come from another screen says so in the digest. To link or crop a node inside it, run `bun scripts/figma.ts locate --args '{"base":"<id>","nodes":[…],"targets":[…]}' --tag locate-<flow>`, batching every node you need for the flow in one call, and save it with `bun scripts/save-result.ts --tag locate-<flow> --out <fb>/locate/<flow>.json`. A `null` means no node matched by path or by a unique name: crop from the base screen's node instead.
6. **Crop.** One crop per component entry, cut from the smallest node that holds the whole component. States and variants get one each only when they look different, not when only the text changes. Primitives (Button, Badge, Tabs, Avatar) get none. A shared component used on a page gets the crop of the variant that page shows. Call `get_screenshot` with `{ nodeId, maxDimension: 1440, contentsOnly: true }` for every crop, then save them all in one command: `bun scripts/shots.ts --dir <fb>/img/crops <node id>=<flow>-<slug> …`.
   - Run `shots.ts` with Bash `dangerouslyDisableSandbox: true`. Inside the sandbox, Figma's CDN answers with an empty HTTP 202.
   - It checks each file is a PNG and prints its size. Never Read a crop.
   - Do not use `download_assets`: it lists up to 20 SVG URLs per call, 1–2k tokens you never use.
7. **Reuse verdicts.** Run `bun scripts/components.ts <repo root> <component path> …` once, with the paths from your brief: one line per file with the components it exports. Pick each component's match from it by name and by role (a Figma "Data table" → the table components, "Drawer" → sheet/drawer, "Select" → combobox/select, "Status" → badge). Before you claim 🟢 reuse, open the file, only the lines that settle it. 🟡 extend means it exists but needs a prop or a variant; 🔴 new means nothing fits. Give the reason in one clause. Link the file as `GH/<path>`, which the renderer pins to the SHA. Shared components get their verdict from the orchestrator, not from you.
8. **Write `sections/<flow>.md`** in the shape [doc-shape.md](doc-shape.md) gives, with its own `## Sources` block numbered from 1. Write pages only: no banner and no `# Shared components` block. The assembler renumbers.

## What to report back

At most 20 lines, per flow: screens → layouts → states; the crops written (slug, node id, size); every shared component you used and the variant each page shows, plus any container you think is shared but the digest does not mark; the reuse verdicts you were unsure of; design issues (typos, duplicate frames, inconsistent copy or formats); the screenshots you took; tool errors. Leave out a token count: the orchestrator reads the exact one from the harness.

## Known traps

- **The text is deduped per screen.** A name repeated in a list (three approver cards) appears once. Count rows from the outline or the instances (`×5`), not from the texts.
- **Annotated layers are often hidden.** `dump` reads annotations before the visibility cut and names the visible container they sit in (`within`). Attach the annotation to that container.
- **An annotation inside an instance** points at a layer id that starts with `I`, and its `within` may too. Link the outermost instance that holds it.
- **Prototype links are optional.** Most files have few or none. Write navigation only where a link or an annotation states it. A link to nowhere, or a missing one, is not a design issue.
