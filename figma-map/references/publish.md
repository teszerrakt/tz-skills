# Publish

## With the Artifact tool

1. Publish `<fb>/design-map.html`, rendered with `--inline`, so every crop is built into the page. No asset upload is needed: a map's crops come to about 1MB, and the page limit is 16MB. On every publish pass `capabilities: {"db": {}, "user": {"scopes": ["profile"]}, "comments": {"composer_only": true}}`: the review marks are saved in the `reviews` collection (doc id = the item's anchor, `{reviewed, by, at}`), the user scope names who marked each one, and the Comment buttons open the shell's composer. A map published before these existed gains them on its next update. Without them the page still reads; it hides the buttons and says review status can't be saved.
2. The page loads ui-sdk (rail, theme switch, Reviewed checkbox, crop viewer) from `browser/web.js` beside it, since the Artifact CSP refuses scripts from ui-sdk.dev. Once per fact base, `npm pack @ui-sdk/web@<exact version>` into `<fb>/ui-sdk/`, extract it, and record the version in `meta.json`. Publish `browser/` with the page: pass every file under `<fb>/ui-sdk/package/browser/` in `files`, with `root` set to `<fb>/ui-sdk/package`. An update that keeps the version leaves `files` out, since published files carry over.
3. Above 12MB, render without `--inline`, upload each crop the page uses as an asset of the artifact (add `"assets": {}` to the capabilities above), write `<fb>/images.json` mapping each `img/crops/<file>.png` to the URL the upload returned, and render again with `--images <fb>/images.json`.
4. On a refresh, or when `meta.json` holds an artifact URL, update that artifact rather than creating a new one. Keep the URL in `meta.json`. A review mark is keyed by the item's anchor (its page, component and part names), so it survives a refresh that keeps the names and drops off an item that was renamed.
5. After the first publish, one `ArtifactData` `list` of `reviews`: it answers, empty, when the db capability took. A `files` listing of the artifact shows `browser/web.js` when ui-sdk took.

## Without it

The session has no Artifact tool when the client runs Claude Code as an SDK session without artifacts enabled (T3 Code, other Agent SDK hosts). The tool is absent, not refused.

1. Render without `--inline`: images then keep absolute local paths, which `html_render` inlines itself, and the page text stays under its 512KB limit. Call `html_render` with that HTML and a height of 2000. ui-sdk does not load there: the page reads, with the contents rail on wide screens only.
2. Add one line to the reply: the Artifact tool needs `CLAUDE_CODE_ARTIFACT=1` (and `CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0` on a remote host) in the client's Claude environment variables, then a new session.

When neither tool exists, give the path of `design-map.html` and say the page has to be opened on this machine.
