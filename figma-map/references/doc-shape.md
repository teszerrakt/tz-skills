# Doc shape

The page reads top to bottom: each page, one component at a time with the parts that compose it nested under it, then the Shared components, the Decision list and the Question list. `scripts/render.ts` turns this markdown into the published page. It numbers everything itself, so never write a code (`P1`, `S3`, `D2`) in a heading.

## Levels

| Markdown | Is | Code on the page |
|---|---|---|
| `# Page: <name> [n]` | a page | `P1`; dropped when the map has one page |
| `## <name> <badge> {node}` | a component on that page | `P1.2`, or `P2` on a one-page map |
| `### <name> <badge> {node}` | a part of that component | `P1.2.3`, or `P2.3` |
| `#### <variant> {node} {Status}` | one variant card under the heading above | none |
| `# Shared components`, then `##` and `###` | shared components and their parts | `S1`, `S1.2` |
| `# Decisions`, `# Questions` | the two lists, each one table | `D1`, `Q1`, written in the table |
| `# Changed since <date>` | a refresh's changes, in `changed.md` | none |

Nothing nests deeper: a part of a part is a bullet. A `####` is always a variant row, never a "States" or "Variants" heading over a table.

## Under a heading, in this order

1. **Purpose**: one plain sentence saying what it is and where it sits.
2. **Rules** (optional, components mostly): a `- Rules` bullet with one child bullet per rule. A rule may open with a status: `  - {Conflict} Counts don't change after Undo [4]`.
3. **Bullets**: copy and behaviour that belong to the whole element, not to one variant.
4. **A crop**: `![<alt>](img/crops/<flow>-<slug>.png)` on its own line, cut from the heading's `{node}`. Every component and part Figma draws gets one, so a reviewer sees what a heading covers before reading its variants. A part on a shared component shows the variant it uses.
5. **Variant rows**: one `####` block each, in the order the user meets them.

## A variant row

```markdown
#### Wrong password {9089:488307} {Conflict}
![Wrong password](img/crops/<upload-pw-wrong>.png)
- Interaction
  - Unlock & Continue with a wrong password → error under the field; the modal stays open [3]
- Copy
  - Error under the field: "Wrong password. Try again." [2]
- Notes
  - The frame shows the password in clear text; keep it masked
```

- The heading's `{node}` becomes the row's **Figma ↗** link: the variant's own node, located in the screen the row describes.
- Every row Figma draws has a crop, even when only its text changes (toasts, error copy): the reviewer checks the copy against the picture. Only a `{Not drawn}` row has none.
- Only three bullets sit at the top of a row: `Interaction`, `Copy`, `Notes`, each with its own child bullets. Leave out a block with nothing in it. `- Copy: "Saved"` is the one-line form.
- **Interaction**: trigger → result, one bullet each. From prototype links and annotations only. Name an API route (`POST /statement-uploads`) only when the contract the run was given states it; never invent one. Write a route as `METHOD /path`: the renderer turns the method into a coloured badge.
- **A link, button or email CTA names where it goes**: the page, route or URL. When neither Figma nor the contract says, write `→ target not stated` and add the gap to the Question list.
- **Copy**: verbatim Figma text, quoted.
- **Notes**: issues and conflicts: typos, a frame that contradicts another, a state the contract needs that no frame draws.
- **A drawing slip is a Note, not a Conflict.** Sample data that contradicts its own label (a negative line under a "Money In" filter, "BCA" on a Mandiri frame) gets one Note: "Figma slip", then what to build. No status tag and no Question: `{Conflict}` is for a disagreement that changes what gets built.

## Status tags

`{New}` added in this revision · `{Revised}` changed in this revision · `{Settled}` a question it answers is answered · `{Conflict}` Figma disagrees with grooming, the contract or another frame · `{Not drawn}` a state that is needed but has no frame · `{Open}` still unanswered. Put one on a variant row, a rule, or a heading. Leave it off when none applies: most rows have none. Any other `{word}` is copy, such as a `{bank description}` placeholder.

## Markers

- `{<node id>}` → a **Figma ↗** link to that node. On a component or part heading it links the component's own node.
- `[n]` cites a Figma frame or annotation, numbered in order of first appearance. Every number has one line in the piece's closing `## Sources` block: `[n] https://www.figma.com/design/<key>/?node-id=<a>-<b> — frame "<name>"` or `— annotation "<verbatim text>"`.
- `GH/<repo path>` in a link → the GitHub blob URL pinned to the run's SHA.
- A list code in text (`D1`, `Q16`, `T2`) → a link to that row of the Decision or Question list. Every code a section cites must be a row: render warns on one with no row. A list the grooming notes keep under another letter goes in the Questions table with its own codes.
- Badge after the name: `🟢 reuse [<Component>](GH/<path>)`, `🟡 extend …`, `🔴 new`. Shared components get theirs from the orchestrator.
- **A part that uses a shared component**: `### Bank account card → [shared](#bank-account-card) — variant "In Progress" {<node>}`. It renders "Shared component, variant "In Progress" · variants in S1 →". Its variants live only in Shared. The anchor is the shared component's name in kebab case. In a bullet, `[shared](#bank-account-card)` renders as the code, `S1`.

## Content rules

- **Two or more values become nested bullets.** A value per module, field or role gets its own child bullet under one parent. Never one sentence.
- **A page drawn once per module** (Bill, Invoice, Payment) is one page named for all of them, with one `Per module` bullet: under it one bullet per thing that differs, under each one bullet per module with its verbatim copy.
- **Annotations are content, never a heading.** Put each one's meaning where it belongs, with its `[n]`: an Interaction on the row it names, a rule on the component, a note. Its verbatim text goes only in Sources.
- **Reached from / Leads to**: one bullet under the page, only when a prototype link or annotation states it.
- **A page that repeats another page's shell** says so in one bullet and lists only what differs.
- **Primitives** (Button, Badge, Tabs, Input, Avatar) are bullets or variant rows under their parent, never their own heading.
- No hex colours, spacing or type ramps. A flow's section is usually under 1,500 words.

## Banner, refresh and lists

`banner.md` is the page's header: one `>` line saying what the flows cover, then one bullet per fact: the date, screens → pages, the contract the routes came from, a PRD link.

```markdown
> The upload, matching and review screens of Bank Reconciliation, top to bottom.
- Revised 19 Nov 2026
- 178 screens → 1 page
- Routes from RFC-024
```

`changed.md` on a refresh: `# Changed since <date>`, then one bullet per changed page or component with its `[n]`.

`lists.md`, only when the user gave grooming notes: a short intro line, then one table each. The status column takes a bare status word.

```markdown
# Decisions
Agreed in grooming. The middle column says whether the Figma follows it yet.

| # | Decision | Figma today | Status |
|---|---|---|---|
| D1 | Zero money shows as "IDR 0,00", not padded. | Still "00,00" in every summary row | Conflict |

# Questions
| # | Question | Answer | Status |
|---|---|---|---|
| Q1 | How are bank cards sorted? | Active first, then In Progress, Not Started, Reconciled. | Settled |
```

Keep the user's own D/Q numbers, so a rule that says "(Q15)" still points at the right row. Rows from another of the notes' lists (`T1`…) keep their letter in the Questions table.

## Example

Angle brackets mark what a real run fills in.

```markdown
# Page: Bank reconciliation [1]
Matches the books against bank statements, one account at a time.

## Bank account cards 🔴 new {8791:1577546}
A row of cards, one per registered bank.
- Rules
  - {Settled} Active first, then In Progress, Not Started, Reconciled (Q2) [2]
  - Three cards show; the fourth slot reads "+2" "more accounts" "View all" [1]

### Bank account card → [shared](#bank-account-card) — variant "In Progress" {8791:1567021}
One per registered bank.
- Footer "Period: 1-20 Sep 2026" · "26 lines (26 to be resolved)" [1]

### All Bank Accounts drawer {New}
Opens from "View all".

#### Default {8791:1577546}
![Drawer](img/crops/<bank-recon-drawer>.png)
- Interaction
  - Click a card → selects the account and closes the drawer [3]
- Copy
  - "All Bank Accounts"; compact cards with "Period: …" · "N lines" or "No statement yet"
- Notes
  - No balances in the drawer

## Sources
[1] https://www.figma.com/design/KEY/?node-id=8791-1567021 — frame "Bank Reconciliation"
[2] https://www.figma.com/design/KEY/?node-id=9089-380873 — annotation "Sort: active first, then in progress, not started, reconciled"
[3] https://www.figma.com/design/KEY/?node-id=8791-1577546 — annotation "Click a card to select it"
```
