# FE Design Doc Template

The doc follows the page. One `##` per screen region, top to bottom as the user sees it, and everything about a region sits inside it: renders, copy, data, interactions, API samples, access, gaps and open questions. A reader goes through it once, top to bottom, and never has to jump to another section. Human reviewers and the build agent read the same doc.

Guidance notes are in blockquotes; delete them in the real doc. Sections marked *(skip if empty)* are dropped, not left as stubs.

**Length is a budget, decided before drafting: 5,000-8,000 words.** Past that the doc is doing the fact base's job a second time and worse. Cut in this order — token dumps (hex, padding, type ramps, spacing: those live in `figma-styles.md`, and a **Build** line names only the deltas), gaps written as paragraphs (Now / Ask / Why, one line each), the same fact written twice (an endpoint sample appears once, at the first element that calls it), the case for a decision already settled in `decisions.md`, and any narration of how the harvest ran. Never cut verbatim copy strings, Figma node links, the gate rule as code, the endpoint samples or the capability table — a build cannot reconstruct those from anywhere else.

**Heading depth is capped at `####`.** Coda drops the doc's H1 and promotes every heading one level, and only H1-H3 collapse, so a `#####` never collapses.

- `##` a region, or a surface with its own fields
- `###` an element inside the region
- `####` an endpoint sample, or a small surface the element opens

---

Author: {name}
Created: {YYYY-MM-DD}
Status: {Spec, not yet in build | In build | Shipped} (ticket: {parent or TODO})

---

## What this page covers

> One paragraph: which page/feature this specs and where it sits in the flow.

- Route: `{path}` - {why it lives there}
- Entry point: {how the user reaches it}
- Scope: {what THIS doc owns}
- Out of scope: {adjacent things explicitly not covered, with a pointer to where they ARE covered}

Figma:

- [{Frame name} ({node-id})]({figma-url})
- ...one bullet per harvested frame

## Page-wide rules

> Only rules that hold across more than one region. A rule about one element goes under that element.

**Terms** *(skip if empty)* — bold term, dash, definition, RFC/ADR link where one exists.

**Saving** — draft vs immediate save, which buttons persist, what fires no API call. Elements below cite it as "saves on {trigger}" rather than restating it.

**Access** — sourced from the project's permissions file (link it). Name capabilities, never roles: a role is only a default bundle, so a role name misleads the moment an entity regrants one. Name live-capture accounts by the capabilities they held. Say who the page's main operator is, by capability.

| Capability | Gates on this page |
|---|---|

Base: `{base-url-prefix}`. Auth: {token type}.

## Page load *(skip if the page fires no call on open)*

> What loads when the page opens: the calls, the loading state, the empty state, the error state. Renders of each state first. The samples for these calls live here.

#### GET {path} — Response 200

```jsonc
// provenance comment per capture-playbook.md
```

## {Region}

> One `##` per region in screen order: header, main sections, rails, footer. Open with every render of the region — each variant and state, each one captioned with what differs. Then one `###` per element in that region.

![{Region} — {variant A}]({render})
![{Region} — {variant B}]({render})

### {Element}

> Renders of the element's own states first, when they differ from the region render. Then the fixed lines below, in this order. Drop a line that has nothing to say.

![{Element} — {state}]({render})

- **Shows:** what it displays and where each value comes from (`{endpoint}` → `data.{field}`), plus the fallback when a value is missing
- **Copy:** every string, verbatim
- **Does:** each interaction → what opens, changes or is called; call order and failure behaviour for a submit; the toast copy
- **Rules:** validation, derived values, disabled and loading states
- **Build:** reuse `{ui-package}/X` | extend X | new — plus only the tokens that differ from the design system, with the [Figma node]({node-url})
- **Access:** the capability it needs, and what happens without it (hidden, disabled, read-only)

> An open question or a BE gap sits right under the element it touches, as a `warning` callout. 🔴 blocks an FE part until it ships; 🟡 FE ships now on the server's current behaviour.

**OQ-n ({owner: BE | design | BE + design}).** The contradiction or unknown, the interim assumption the FE builds on, and what changes if the answer flips.

**🔴 G-n {Short title}**

- **Now:** {what the server does today}
- **Ask:** {the change, concrete}
- **Why:** {source}. Blocks {the FE part}. Overrides RFC-x §y ({clause id})

#### {METHOD} {path} — Request

> Samples sit at the first element that fires the call. A later element names the endpoint and the fields it reads. One `####` per sample so each collapses.

```jsonc
// provenance comment per capture-playbook.md
```

#### {METHOD} {path} — Response 200

```jsonc
```

#### {METHOD} {path} — Error {code} {case} *(when it drives UI copy)*

```jsonc
```

#### {Small surface} *(menu, popover, confirm dialog)*

> A surface the element opens that has no fields of its own nests here, under its trigger: render, copy, what each option does. A multi-element flow (delete, bulk action) lives under the element that starts it.

## {Surface with fields} (opens from {Region} → {Element})

> A modal, drawer or sub-form with its own fields gets its own `##`, placed right after the region that opens it. Inside, the same shape as a region: renders, then one `###` per field or control.

---

Example — a header region with a logo and an avatar:

```markdown
## Header

![Header — signed in](…)
![Header — no entity selected](…)

### Avatar

![Avatar — dropdown open](…)

- **Shows:** `GET /v1/app/me` → `data.avatar_url`; initials when null
- **Does:** click → opens the account menu below; no API call
- **Build:** reuse `@klay/ui/Avatar`, size 32 (design system default is 40) — [Figma](…)

#### Account menu

- **Copy:** "Settings", "Switch entity", "Log out"
- **Does:** Log out → Auth0 logout, back to `/login`
```

---

## Open questions and gaps

> An index only. Each item's full text lives in the section where it applies; here it is one line and a link. Write `— none.` beside a heading with nothing under it.

**Open questions** — `OQ-n` ({owner}) {one line} → [{section}](#)

**BE gaps** — grouped by where the backend fixes them, one `###` per code area; each group becomes one backend ticket at the breakdown.

### {Code area} — `{file or package}`

- [ ] 🔴 **G-n {Short title}** → [{section}](#)

**TODOs**

- [ ] {Work someone outside FE owes this build, e.g. a Figma rename} — owner: {design | backend | author}

**Accepted risks**

- {The cost the author accepted, and the rule it breaks.}

**Images to add** *(skip if every render was embedded)*

## Related Tickets *(skip until tickets exist)*

Published {date} under parent [{ticket}]({url}). Estimates are AI-assisted implementation + buffer for code review and self-test. Total: {N} MD.

| Ticket | Title | Blocked by | Estimate |
|---|---|---|---|

---

## Attaching the frame renders, on a Coda or Superhuman Docs target

Place each render under the region or element it shows rather than dumping all of them at the end, and skip a close-up that is a crop of a render already on the page — say in the doc which ones were left out and why.

**The flow is FOUR calls and the first three each report success on their own.**

1. `content_modify` with `blockType: "image"` and an `altText` → returns a `blobId`.
2. `content_image_upload` with that `blobId`, a `contentType`, and **no** `imageUrl` → returns `uploadUrl`, `uploadHeaders`, `imageUrl`.
3. `curl -T <file>` to `uploadUrl` with **every** returned header as its own `-H`, `policy` included. They are signed: do not edit or omit one.
4. **`content_image_upload` again with the `blobId` AND the `imageUrl` from step 2.** This call is the attachment; nothing before it links anything.

- Skip step 4 and the bytes sit in the bucket unreferenced while the canvas renders *"The file that was referenced here has been deleted. Click to remove."*
- **A `200` on the PUT is not evidence of an attachment** — it proves only that bytes arrived. The page's block count is not evidence either: `content_read` cannot see image content, because an image block carries no text.
- So the only check that counts is **a human looking at the rendered page.** Attach ONE image, ask, and do the rest only once they confirm it renders.
- The presigned URLs expire in 30 minutes. Mint, PUT and attach one image at a time rather than minting a batch up front.
