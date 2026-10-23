---
name: learn-codebase
description: Build a personal knowledge base for any codebase — linear, visual chapters published as artifacts with Claude-graded questions — and turn merged PRs into short lessons.
disable-model-invocation: true
---

# Learn a codebase

A **knowledge base** (KB) is a separate git repo of chapters about one source repo. Each chapter is one HTML page, published as a private artifact, read top to bottom, ending in questions Claude grades on the page.

- `/learn-codebase` — write the next planned chapter.
- `/learn-codebase <topic>` — write a chapter on that topic.
- `/learn-codebase prs [<numbers> | today]` — one lesson page from a batch of merged PRs.

## 1. Find the KB

Each KB holds its config in `kb.md`:

```markdown
- Source repo: <absolute path>
- Reader: reads <languages> well; new to <languages>. <how they learn>
- Boxes: <the 3–6 names chapter 1 gave the system's parts, in flow order>
```

Look in `~/codes/<source-repo-name>-kb/`, then ask. With no KB yet, ask the reader where it goes, what they already read well, and what they are new to. Then `git init` it with `kb.md`, a `README.md` holding the chapter table, and a `chapters/` folder. Add a GitHub remote only when the reader asks, and make it private.

Done when `kb.md` is read and its source repo path exists.

## 2. Pick the chapter

The README's chapter table is the plan. A new KB starts with:

1. **The map**: the boxes a typical request passes through, one real action followed end to end, the data store drawn as spreadsheets. It names the boxes; write them into `kb.md`.
2. **One primer per language the reader is new to**, teaching only the constructs this repo uses most. Count them with grep before choosing.
3. **One chapter per core flow**, starting with the flows the reader ships.

A topic the reader names becomes the next row. Otherwise take the first row not done.

## 3. Research

Read the chapter's real code: the flow's files from entry point to data store, the schema of every table you will draw, and the docs that say why. Collect excerpts with repo-relative paths.

Done when every excerpt was found verbatim in the source by grep, changed only by `…` trims, and every column you draw exists in the schema.

## 4. Write

Copy `references/template.html` to `chapters/NN-slug.html`. It holds every component once, with `{{placeholders}}`; delete the ones the chapter does not use.

- **Linear.** The page names no other chapter as a place to go. An earlier idea the reader needs comes back as a recap box, right where it is needed.
- **Plain words.** Short sentences. Explain each technical word where the chapter first uses it.
- **Concrete.** Follow one real action, with real-looking sample data, from the first box to the last.
- **Tables are spreadsheets.** Column letters, row numbers, fake rows. A foreign key is a VLOOKUP. The row the flow creates is highlighted.
- **Every code line carries its language tag.** Each language shares its box's color, so the reader can see where one language stops and another starts.
- **Flow stops.** The strip lights the current box. Plain words on the left, code on the right.
- **Verbatim code.** Show the path. Mark trims with `…`. Add no comments the code lacks. A value spliced into a string at runtime is shown spliced, with a caption saying so.
- **Check yourself.** Three questions: explain the flow back, find the bug (a made-up snippet with one bug this repo's rules forbid), and one on the data. Each gets key points in the `kb-grading` JSON and a model answer under "Show a good answer". The JSON `context` holds every fact the grader needs, since the grader sees nothing else.
- **20–30 minutes.** A longer chapter splits in two.

## 5. Publish

1. Extract the page's `<script>` and run `node --check` on it.
2. Publish with the Artifact tool: the chapter's path, `capabilities: {"sample": {}}`, a one-sentence description, and an icon on the first publish. Artifacts start private; keep them private when the source repo is.
3. Mark the README row done with the artifact link, commit in the KB repo, and push if it has a remote.

Done when the reader has the link.

## PR lessons

`prs` runs steps 1, 3, 4 and 5 on a batch of PRs: the numbers given, or the reader's PRs merged today (`gh pr list --author @me --state merged --search "merged:>=<date>"`). Skip copy-only and style-only PRs.

One page per batch, `chapters/pr-YYYY-MM-DD.html`. For each PR: the strip lighting the boxes it touched, what changed and why in plain words (the why comes from the PR body), and one excerpt. End with one find-the-bug per PR, made by re-breaking a line the PR fixed or added. Add the page under a "PR lessons" list in the README.

Run it once a day on the day's batch. One research pass for the whole batch is what keeps the cost down.
