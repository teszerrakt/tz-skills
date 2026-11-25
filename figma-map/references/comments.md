# Comment round

Read when the user asks you to address review comments on a published map. Every fix lands in the fact base and is re-rendered, so the next refresh keeps it.

## 1. Find the fact base

Read the artifact (`Artifact` read) and its threads (`ArtifactComments` read). The page's first line is the generator stamp: `<meta name="figma-map" content="render.ts <version>; host=<host>; fact-base=<repo>/<slug>">`.

- **Stamped, and `~/.claude/figma-map/<repo>/<slug>/` is on this machine:** work there.
- **Stamped, but the fact base is on another host:** say which host holds it. Continue on that host through a linked environment when one exists. Otherwise ask before hand-patching: a later refresh from that host overwrites hand patches.
- **No stamp:** the page was built by hand. Offer a rebuild (SKILL.md steps 1–9); patch by hand only when the user declines, and say that each fix is then a one-off.

Done when you know where the fact base is, or the user has chosen how to patch without it.

## 2. Settle before asking

Read every thread, open question, `{Conflict}` and `{Not drawn}` against the contract and the grooming notes first. An answer the contract already gives becomes `{Settled}`, citing its clause. A typo or contradictory sample data becomes a Figma slip note. Only what is still undecided goes to the user, as a grilling round when there are more than four.

Done when every remaining question is one the contract and the notes cannot answer.

## 3. Fix, render, publish

Edit `sections/*.md`, `shared.md` and `lists.md`, then run steps 7–9 of SKILL.md. A comment asking for a picture gets a crop (harvest.md step 6), never a note.

Done when render prints no warning and the publish succeeded.

## 4. Reset review marks

An item whose content changed loses its review mark: after the publish, set `reviewed: false` on its `reviews` document, pinned to the version you read (`ArtifactData` batch). Content means text, a crop, a tag or a route. A change of styling, badges or links only keeps the mark.

Done when every changed item that was reviewed is unreviewed, and no other mark moved.

## 5. Close the threads

Reply on each thread that is activated for Claude, saying what changed, and resolve it. List the threads that are not activated: the user resolves those in the page.

Done when every thread is resolved or listed.
