# Publish

## With the Artifact tool

1. Render into your scratchpad (`<scratch>/map/design-map.html`), since the Artifact tool takes files only from the working directory or the scratchpad. Render copies each crop beside the page and writes `design-map.files.json`: published path (`img/crops/<file>.png`, relative, no leading slash) → file on disk. Publish the page with that map as `files`, so the page holds no image data and a read or publish of it stays small. On every publish pass `capabilities: {"db": {}, "user": {"scopes": ["profile"]}, "comments": {"composer_only": true}}`: the review marks are saved in the `reviews` collection (doc id = the item's anchor, `{reviewed, by, at}`), the user scope names who marked each one, and the Comment buttons open the shell's composer. A map published before these existed gains them on its next update. Without them the page still reads; it hides the buttons and says review status can't be saved.
2. The page loads ui-sdk (rail, theme switch, Reviewed checkbox, crop viewer) from `browser/web.js` beside it, since the Artifact CSP refuses scripts from ui-sdk.dev. Once per fact base, `npm pack @ui-sdk/web@<exact version>` into `<fb>/ui-sdk/`, extract it, and record the version in `meta.json`. Publish `browser/` with the page: copy `<fb>/ui-sdk/package/browser/` beside the rendered page and add each of its files to `files` under `browser/<path>`. An update that keeps the version leaves the `browser/` entries out of `files`, since published files carry over; the crops still go in.
3. One publish carries at most 255 files and 64MB. A map with more crops goes up over several publishes to the same URL, each adding files; published files carry over, so an update may pass only the crops that are new or re-cropped.
4. On a refresh, or when `meta.json` holds an artifact URL, update that artifact rather than creating a new one. Keep the URL in `meta.json`. A review mark is keyed by the item's anchor (its page, component and part names), so it survives a refresh that keeps the names and drops off an item that was renamed.
5. After the first publish, one `ArtifactData` `list` of `reviews`: it answers, empty, when the db capability took. A `files` listing of the artifact shows `browser/web.js` when ui-sdk took.

## Without it

The session has no Artifact tool when the client runs Claude Code as an SDK session without artifacts enabled (T3 Code, other Agent SDK hosts). The tool is absent, not refused.

1. Render with `--local`: images then keep absolute local paths, which `html_render` inlines itself, and the page text stays under its 512KB limit. Call `html_render` with that HTML and a height of 2000. ui-sdk does not load there: the page reads, with the contents rail on wide screens only.
2. Add one line to the reply: the Artifact tool needs `CLAUDE_CODE_ARTIFACT=1` (and `CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0` on a remote host) in the client's Claude environment variables, then a new session.

When neither tool exists, give the path of `design-map.html` and say the page has to be opened on this machine.
