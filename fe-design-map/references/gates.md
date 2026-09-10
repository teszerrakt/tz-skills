# Gate ledgers

A **gate ledger** moves the definition of done out of the agent's judgment and into a file of runnable checks, written **before** the work starts. The agent does not promise it harvested everything. It proves it.

Three rules make the ledger work:

- The ledger is written at chart time, while the user is present and the counts are known.
- A gate is met only when `gate-check.mjs` ran its `CHECK` and `EXPECT` matched.
- **A ticked box with `EVIDENCE: pending` is unmet**, and worse than an unticked one. Only the runner ticks a box.

## Format

One ledger per gated ticket, at `$FB/gates/<NN>-<slug>.md`, where `$FB` is the fact base directory.

```markdown
# Gates — 01 Figma harvest

FB: /home/you/.claude/fe-design-map/myrepo/create-invoice
Frames confirmed: 7

- [ ] G1 One harvest file per confirmed frame
      CHECK: ls "$FB"/frames/*.md | wc -l
      EXPECT: 7
      EVIDENCE: pending

- [ ] G2 One PNG per confirmed frame
      CHECK: ls "$FB"/img/*.png | wc -l
      EXPECT: 7
      EVIDENCE: pending
```

A gate is a `- [ ] Gn <title>` line followed by indented `CHECK:`, `EXPECT:`, and `EVIDENCE:` lines. A blank line ends it.

`EXPECT` is a regex when it is slash-delimited (`/^[1-9][0-9]*$/`). Otherwise it matches the trimmed output exactly, then as a substring.

## Run it

```bash
FB="$HOME/.claude/fe-design-map/<repo>/<slug>" \
  node ~/.claude/skills/fe-design-map/scripts/gate-check.mjs "$FB/gates/01-figma-harvest.md"
```

It ticks the boxes, writes the first three lines of output into each `EVIDENCE`, prints a per-gate verdict, and exits non-zero while any gate is unmet. Paste the whole ledger into the ticket's resolution comment.

## Prove the gate can fail, before the work starts

A gate that cannot fail proves nothing, and it reads exactly like one that passed. So at chart time, with the fact base still empty, dry-run every ledger you just wrote:

```bash
FB="$HOME/.claude/fe-design-map/<repo>/<slug>" \
  node ~/.claude/skills/fe-design-map/scripts/gate-check.mjs --dry "$FB/gates/01-figma-harvest.md"
```

`--dry` inverts the verdict: it exits zero only when **every** gate fails. It names any gate that passes before the work exists, then resets the boxes and evidence so the dry run leaves no trace.

Two authoring habits are what it catches:

- **Guard every count against zero.** `[ "$a" -le "$b" ]` is satisfied by `0 ≤ 0`, so the gate certifies an empty directory. Write `[ "$a" -le "$b" ] && [ "$b" -gt 0 ]`.
- **Never let one echo token contain another.** `EXPECT: MATCH` against a CHECK that echoes `MISMATCH` on failure passes either way, because the runner falls back to a substring match. Use tokens that share no substring — `MATCH` and `DIFFER`. The runner now requires a word boundary, which kills this specific pair, but a token that is a whole word inside the other still slips through.

Some gates are knowingly vacuous — "no file is a stub" is trivially true of no files. Say so in the ledger rather than leaving the dry run to report it every time.

## Abandon

A gate you cannot meet has one honest exit. Add an `ABANDON:` line to it, with the reason:

```markdown
- [ ] G4 Every node id referenced in an annotation has its own harvest file
      CHECK: ...
      EXPECT: 0
      ABANDON: two references point at a deleted node (3:481, 3:502)
```

The runner reports it as abandoned and stops counting it. A quiet skip is the failure this whole mechanism exists to catch, so a missing thing must **say** it is missing. Empty content is stated, never implied: a frame with no annotations gets the literal line `No annotations on this frame`.

## Gate sets

Write the gates the ticket needs. These are the ones that pay.

### 01 Figma harvest

`N` is the frame count the user confirmed at chart time.

| Gate | Check |
|---|---|
| One harvest file per frame | `ls "$FB"/frames/*.md \| wc -l` → `N` |
| One PNG per frame | `ls "$FB"/img/*.png \| wc -l` → `N` |
| Every file states its annotations or their absence | count files holding `## Annotations` → `N` |
| No file is a stub | `find "$FB"/frames -name '*.md' -size -400c \| wc -l` → `0` |
| Every node id inside an annotation has its own file | extract referenced ids, count those with no file → `0` |
| The merged token file exists and is not empty | `wc -c < "$FB/figma-styles.md"` → `/^[1-9][0-9]{2,}$/` |

The last one is why frame confirmation belongs in the charting session. An agent that picks its own `N` writes a gate it cannot fail.

### 02 PRD harvest

| Gate | Check |
|---|---|
| `prd.md` exists and is not a stub | `wc -c < "$FB/prd.md"` → `/^[1-9][0-9]{2,}$/` |
| Every requirement carries its source anchor | count requirement bullets without a `#` anchor → `0` |

### 03 API and permissions harvest

| Gate | Check |
|---|---|
| One file per endpoint in the map | endpoint count in `api/` equals the count in the endpoint map |
| **Nothing vanishes**: UI data needs equal mapped endpoints plus declared gaps | `needs == mapped + gaps` |
| Every endpoint has a roles row | endpoints missing from `roles.md` → `0` |

The conservation gate is the load-bearing one. A data need that is neither mapped nor declared a gap is the exact thing that goes missing quietly.

### 06 Draft and publish

| Gate | Check |
|---|---|
| All 12 template sections present or marked skipped | `grep -c '^## ' "$FB/design-doc.md"` → `12` |
| Every JSONC block opens with a provenance comment | fenced `jsonc` blocks whose first line is not `//` → `0` |
| Every Figma node id carries its full URL | bare node ids → `0` |
| No fact-base path appears in the doc | `grep -c 'fe-design-map/' "$FB/design-doc.md"` → `0` |

The last one enforces the project's own authoring rule: a published doc never names a machine path.
