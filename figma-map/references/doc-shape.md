# Doc shape

The page reads top to bottom, with no jumping between sections: every page, then the components the pages share. `scripts/render.ts` turns this markdown into the published HTML.

## Levels

- `banner.md`: one `>` line: the section name in bold, what the flows cover in one clause, screens → pages, and the badge legend `🟢 reuse · 🟡 extend · 🔴 new`.
- `#` **Page**: `# Page: <page name> [n]`. Name a page for what it is. A page the designer drew once per module (Bill, Invoice, Payment) is one page named for all of them: `# Page: Transaction approval detail [4] [5] [6]`.
- `##` **Component** on that page: its name, its badge and reuse link, then its Figma marker: `## Payment picker 🔴 new {8118:49658}`.
- `###` **Sub-component**: the same pattern. Nothing nests deeper than `###`: a part of a sub-component is a bullet.
- `####` **States** or **Variants** under a component, followed by the table. Directly under a page, use `###`.
- Bullets under a heading carry only that element's copy, behaviour and rules.
- `# Shared components` closes the doc, with one `##` per shared component. Only the orchestrator writes it.

## Markers

- `{<node id>}` at the end of a component heading becomes a **Figma ↗** link to that node, not to the screen. Use the component's own node, located in the screen the entry describes.
- `[n]` cites a Figma frame or annotation, numbered in order of first appearance. Every number has one line in the piece's closing `## Sources` block: `[n] https://www.figma.com/design/<key>/?node-id=<a>-<b> — frame "<name>"` or `— annotation "<verbatim text>"`.
- `GH/<repo path>` in a link becomes the GitHub blob URL pinned to the run's SHA.
- `![<alt>](img/crops/<flow>-<slug>.png)` on its own line under the heading it shows.
- `[shared](#<anchor>)` links to a Shared heading. The anchor is the component's name in kebab case: `Approval Gate card` → `#approval-gate-card`.

## Content rules

- **Two or more values become nested bullets.** Whenever an element has a value per module, field or role, give each value its own bullet under one parent bullet. Never run them into one sentence.
- **A page drawn once per module lists what changes, grouped by the thing that changes.** Under the page, one `Per module` bullet; under it, one bullet per thing that differs; under each, one bullet per module with its verbatim copy. No variants table and no shorthand that points elsewhere ("Trigger 'Bill'").
- **A shared component on a page** gets a heading only when the page has something to say about it: `## Side panel → [shared](#side-panel) — variant "Test, empty" {<node id>}`, then that variant's crop, then the bullets. A shared component the page uses with nothing new to say is one bullet under the page: `- Uses: Action bar → [shared](#action-bar), state "Saved" [n]`. Never an empty heading.
- **Annotations are content, never a heading.** Read each one and put its meaning where it belongs, with its `[n]`: a behaviour on the element it names, a validation rule on a field, a copy rule, a data rule, a permission note or a design note. Its verbatim text goes only in Sources.
- **Behaviour on the element**: `Click a row → opens <page or state> [n]`. Prototype links and annotations both feed it. Prototype links are optional: write no navigation the file does not state, and never write that a link is missing.
- **Reached from / Leads to**: one line under a page title, only when a prototype link or an annotation states it. Otherwise leave it out.
- **Copy is verbatim and quoted.** No hex colours, spacing or type ramps.
- **A page that repeats another page's shell** says so in one bullet (`Same shell, layout and action bar as <page> [n]`) and lists only what differs.
- **States and variants of one component go in a table.** A state differing only in text gets `—` in the image column.
- **Primitives** (Button, Badge, Tabs, Input, Avatar) are bullets under their parent, with badge and link. They never get their own heading.
- **A refresh** puts its `Changed since <date>` list in `changed.md`: one bullet per changed page or component, with its `[n]`.
- Plain, terse bullets. A flow's section is usually under 1,500 words.

## Example

Angle brackets mark what a real run fills in.

```markdown
# Page: Transaction approval detail [1] [2] [3]
- Same shell as Approval Workflow, with the workflow canvas left and the side panel right [1]
- Per module
  - Title
    - Bill: "Bill Approval" [1]
    - Invoice: "Invoice Approval" [2]
    - Payment: "Payment Approval" [3]
  - Threshold field
    - Bill: "Net Payable" [1]
    - Invoice: "Net Receivable" [2]
    - Payment: "Amount" [3]
- Uses: Action bar → [shared](#action-bar), state "Saved" [1]

## Side panel → [shared](#side-panel) — variant "Test, empty" {8118:43927}
![Side panel — test, empty](img/crops/<detail-side-panel-test-empty>.png)
- Select "Select a bill" stays disabled until an approver exists [4]

## Payment picker 🔴 new {8118:49658}
Composes 🟢 [Combobox](GH/<ui package>/combobox.tsx); its `empty` slot covers both empty states.
![Payment picker — open](img/crops/<test-payment-picker-open>.png)
- Search placeholder
  - Bills and payments: "Search journal ID, vendor, or amount" [5]
  - Invoices: "Search journal ID, customer, or amount" [6]

#### States
| State | What changes | Image | Source |
|---|---|---|---|
| No payments | "No payments to try" / "Use the amount input instead." | ![No payments](img/crops/<test-picker-no-payments>.png) | [7] |
| Search typed | one matching row left | — | [5] |

## Sources
[1] https://www.figma.com/design/KEY/?node-id=8118-43846 — frame "Approval Workflow"
[6] https://www.figma.com/design/KEY/?node-id=8118-49660 — annotation "For invoices, the search is as follows: "Search journal ID, customer, or amount""
```
