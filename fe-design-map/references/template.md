# FE Design Doc Template

Section order is fixed so reviewers keep one mental map across docs. Sections marked *(skip if empty)* are dropped, not left as stubs. Guidance notes are in blockquotes; delete them in the real doc.

**Length is a budget, decided before drafting: 5,000-8,000 words.** Past that the doc is doing the fact base's job a second time and worse. Cut in this order — token dumps (hex, padding, type ramps, spacing: those live in `figma-styles.md`, and §5 names only the deltas), gaps written as paragraphs (§10 is one bullet each: the pain, then the ask), the same fact restated in a third section, the case for a decision already settled in `decisions.md`, and any narration of how the harvest ran. Never cut verbatim copy strings, Figma node links, the gate rule as code, the endpoint samples or the role tables — a build cannot reconstruct those from anywhere else.

---

Author: {name}
Created: {YYYY-MM-DD}
Status: {Spec, not yet in build | In build | Shipped} (ticket: {parent or TODO})

---

## 1. What this page covers

> One paragraph: which page/feature this specs and where it sits in the flow.

- Route: `{path}` - {why it lives there}
- Entry point: {how the user reaches it}
- Scope: {what THIS doc owns}
- Out of scope: {adjacent things explicitly not covered, with a pointer to where they ARE covered}

Figma:

- [{Frame name} ({node-id})]({figma-url})
- ...one bullet per harvested frame

## 2. Concepts *(skip if empty)*

> Domain terms a reader needs before the spec makes sense. Bold term, dash, definition, RFC/ADR link where one exists. Use a callout for any trap (fields that look meaningful but aren't, flags never to send).

## 3. Persistence model

> The single highest-leverage paragraph: draft vs immediate-save semantics, what each button actually persists, what fires no API call. Name the open question if design copy and API behavior disagree.

## 4. Data Source

Base: `{base-url-prefix}`. Auth: {token type}. Roles per section {Roles section number}.

> One `###` per endpoint. Prose covers: what it drives in the UI, notable fields, error mapping to UI copy, gap refs (G-n). Each sample sits under its own `####` so it collapses natively in Coda.

### {METHOD} {path}

{prose}

#### Request

```jsonc
// provenance comment per capture-playbook.md
```

#### Response 200

```jsonc
```

#### Error {code} {case} *(when it drives UI copy)*

```jsonc
```

## 5. Component Inventory

> Per component: Figma node link, verdict (reuse `{ui-package}/X` | extend X | new), and ONLY the tokens that differ from the design system. Full style dump lives in the fact base `figma-styles.md`, not here.

| Component | Figma | Verdict | Deviations |
|---|---|---|---|

## 6. Page Anatomy

> One `###` per region (header, main sections, rails, empty states), top to bottom. Embed the region screenshot. Quote exact copy strings. Note which mode/state each button opens.

## 7. {Component} spec

> One numbered section per interactive component (modal, card, drawer): fields, validation rules, derived values, submit choreography (call order, failure behavior), button states, toast copy. Repeat the section per component.

## 8. {Flow} spec *(skip if empty)*

> One section per cross-component flow (delete, bulk action): trigger, confirmation copy, API call, toasts, edge cases.

## 9. Roles & Permissions

> Reads vs writes matrix sourced from the project's permissions file (link it). Note which UI affordances hide per role and who the page's main operator is.

## 10. BE Gaps *(skip if empty)*

> One bullet per gap: **G-n {short title}.** Current pain, then the concrete ask.

## 11. Related Tickets *(skip until tickets exist)*

Published {date} under parent [{ticket}]({url}). Estimates are AI-assisted implementation + buffer for code review and self-test. Total: {N} MD.

| Ticket | Title | Blocked by | Estimate |
|---|---|---|---|

## 12. TODOs & Open Questions

**Open questions**

> **OQ-n ({owner: BE | design | BE + design}).** The contradiction or unknown, the interim assumption the FE builds on, and what changes if the answer flips.

**Images to add** *(skip if screenshots were auto-embedded)*

---

## Attaching the frame renders, on a Coda or Superhuman Docs target

Place one render under the section it illustrates rather than dumping all of them at the end, and skip a close-up that is a crop of a render already on the page — say in the doc which ones were left out and why.

**The flow is FOUR calls and the first three each report success on their own.**

1. `content_modify` with `blockType: "image"` and an `altText` → returns a `blobId`.
2. `content_image_upload` with that `blobId`, a `contentType`, and **no** `imageUrl` → returns `uploadUrl`, `uploadHeaders`, `imageUrl`.
3. `curl -T <file>` to `uploadUrl` with **every** returned header as its own `-H`, `policy` included. They are signed: do not edit or omit one.
4. **`content_image_upload` again with the `blobId` AND the `imageUrl` from step 2.** This call is the attachment; nothing before it links anything.

- Skip step 4 and the bytes sit in the bucket unreferenced while the canvas renders *"The file that was referenced here has been deleted. Click to remove."*
- **A `200` on the PUT is not evidence of an attachment** — it proves only that bytes arrived. The page's block count is not evidence either: `content_read` cannot see image content, because an image block carries no text.
- So the only check that counts is **a human looking at the rendered page.** Attach ONE image, ask, and do the rest only once they confirm it renders.
- The presigned URLs expire in 30 minutes. Mint, PUT and attach one image at a time rather than minting a batch up front.
